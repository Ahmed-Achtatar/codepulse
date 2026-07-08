# Agentic API Development Playbook: Enterprise-Grade Production Guide

This playbook documents the complete architecture, coding patterns, and discovery standards used to build, host, and monetize paid micro-utility APIs for AI agents (via the `x402` and prepaid key protocols).

---

## 1. Project Scaffolding & Setup

When initializing a new Worker, structure the codebase to keep routes, registry details, and middleware separate:

```
my-agent-api/
├── .dev.vars                  # Local dev secrets (mock keys, wallet addresses)
├── package.json               # Node packages
├── tsconfig.json              # TypeScript configuration
├── wrangler.toml              # Cloudflare Worker config with KV namespaces
├── scripts/
│   └── generate-bait.js       # GitHub Action SEO utility
├── buyer/
│   ├── package.json
│   ├── simulate.mjs           # Programmatic transaction runner
│   └── buy.mjs                # Buyer testing client
└── src/
    ├── index.ts               # Router, middleware registry, metadata endpoints
    ├── html.ts                # Branding and human landing page templates
    └── endpoints/
        ├── registry.ts        # Dynamic catalog of all endpoints
        └── [domain].ts        # Logic groupings (e.g., web.ts, security.ts)
```

---

## 2. Core Server & x402 Payment Flow

AI agents settle payments per call in USDC on Base. To support this natively, integrate `@x402/hono` and Coinbase's `HTTPFacilitatorClient`.

### Gas-Based Congestion Multiplier
Base transaction fees fluctuate. Implement a dynamic pricing multiplier that reads live gas levels from a Base RPC and scales your endpoint prices to cover on-chain costs:

```typescript
async function getGasMultiplier(env: Env): Promise<number> {
  const cached = await env.CACHE.get("congestion_multiplier");
  if (cached) return parseFloat(cached);

  try {
    const res = await fetch("https://mainnet.base.org", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] })
    });
    if (res.ok) {
      const data: any = await res.json();
      const gasPriceWei = parseInt(data.result, 16);
      const gasPriceGwei = gasPriceWei / 1_000_000_000;

      let multiplier = 1.0;
      if (gasPriceGwei > 2.0) multiplier = 1.5;
      else if (gasPriceGwei > 0.5) multiplier = 1.25;

      await env.CACHE.put("congestion_multiplier", String(multiplier), { expirationTtl: 120 });
      return multiplier;
    }
  } catch (err) {
    console.error("Failed to fetch Base gas price", err);
  }
  return 1.0;
}
```

### Free Preflight Schema Checks
To prevent charging agents for invalid requests, validate parameters *before* they hit the payment middleware:
1. Parse the request body in Hono.
2. If invalid, reject the request with `HTTP 400 Bad Request`.
3. Provide a free `/preflight` path for dry-running payloads.

---

## 3. Prepaid Credits & API Keys

Since some agents cannot sign on-chain transactions dynamically, implement a **Prepaid Credits** system. Users deposit USDC directly to a designated settlement wallet and generate a persistent `sp_...` API key.

### Verifying Deposits via JSON-RPC
When a user calls `POST /credits/deposit` with a transaction hash:
1. Fetch the transaction receipt from the Base RPC.
2. Verify the status is successful (`0x1`).
3. Scan logs for the EIP-20 `Transfer` topic matching your contract address and settlement wallet:

```typescript
const usdcContract = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const ourWalletTopic = "0x000000000000000000000000" + settlementWallet.substring(2).toLowerCase();
const transferEventTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

let depositAmount = 0;
for (const log of receipt.logs || []) {
  if (
    log.address?.toLowerCase() === usdcContract.toLowerCase() &&
    log.topics?.[0]?.toLowerCase() === transferEventTopic &&
    log.topics?.[2]?.toLowerCase() === ourWalletTopic
  ) {
    const rawAmount = parseInt(log.data, 16);
    depositAmount += rawAmount / 1_000_000; // USDC has 6 decimals
  }
}
```

4. If valid, issue a unique API key (`sp_` + UUID) and store the balance inside the Worker's KV storage.

---

## 4. Referral Commissions & Admin Rewards

To grow your API organically, build reward logic into your prepaid system.

### Referrals
*   When a user deposits, check for a referrer address.
*   Allocate **5%** of the transaction price to the referrer's balance:
    ```typescript
    const refShare = Number((finalPrice * 0.05).toFixed(4));
    const refKey = `referrer:${referrerAddr.toLowerCase()}:balance`;
    const currentRefBal = parseFloat(await env.CACHE.get(refKey) || "0");
    await env.CACHE.put(refKey, String((currentRefBal + refShare).toFixed(4)));
    ```
*   Let users claim their rewards to top up their API key balances via `POST /credits/claim-reward`.

### Admin Data Shipment Rewards
*   Implement a `/agent/request-data` endpoint where agents request missing data.
*   Once you ship an endpoint, trigger `POST /admin/ship-endpoint` (gated by `ANALYTICS_TOKEN`) to reward the requesting wallet with a USDC bonus balance.

---

## 5. KV Analytics & Traffic Classification

Detailed telemetry helps you understand which agents use your API. Route all requests through a classification middleware:

### User-Agent Grouping
Categorize traffic based on the client's `User-Agent` header:
*   `cdp-bazaar`: Coinbase crawler.
*   `agent402`: Dedicated agent clients.
*   `x402-client`: Standard protocol wrappers.
*   `browser`: Human visitors.

### Referrer Grouping
Track traffic sources using the `Referer` header:
*   `x402scan`: System registry explorer.
*   `github`: Repository views.
*   `direct`: Programmatic requests.

### Route-Level SLA Calculations
Store success/error counters in KV (`analytics:route:${route}:endpoint_success` vs `endpoint_error`). Expose a `/status` page calculating live uptime:
$$\text{SLA} = \frac{\text{Successes}}{\text{Successes} + \text{Errors}} \times 100$$

---

## 6. Escrow & On-Chain Bounties

Integrate coordination features allowing agents to lock funds into an escrow registry contract before resolving tasks:
*   **Deposit**: Locks USDC via EIP-3009 `receiveWithAuthorization`.
*   **Release**: Authorizes payouts from the smart contract hot wallet.

---

## 7. Aggressive Metadata Discovery

Indexers and crawlers must be able to discover your endpoints without authentication. Host these **8 canonical metadata paths** on your worker:

1.  **`llms.txt` & `/llms.txt`**: Plain-text description of all endpoints, price rules, and code instructions.
2.  **`openapi.json` & `/openapi.json`**: OpenAPI 3.1.0 registry with x402 security definitions.
3.  **`.well-known/x402.json` & `/x402/discovery`**: Maps wallets, facilitator endpoints, and accepted assets (Base/Solana).
4.  **`.well-known/mcp.json` & `/mcp`**: Exposes the API as a remote HTTP Model Context Protocol stream.
5.  **`.well-known/agent-card.json` & `/a2a`**: Describes the agent-to-agent protocol and capabilities array.
6.  **`.well-known/oasf.json` & `/oasf`**: Integrates with the Open Agent Service Format taxonomy.
7.  **`agenterc-metadata.json`**: Connects the worker to EIP-8004 registries.
8.  **`marketplace-listing.json`**: Provides submission metadata payloads.

---

## 8. Programmatic Activity Simulators

To index correctly in directories and verify production stability, set up **automated buyers**:
*   Configure a GitHub Action (`.github/workflows/simulate-activity.yml`) on a cron schedule (`0 */12 * * *`).
*   The action executes a Node script (`simulate.mjs`) that pulls a random cheap endpoint path (e.g. `/calendar/holidays`), signs an x402 payment using a burner private key, and calls the production API.
*   This creates a steady stream of organic telemetry, keeps your cache warm, and proves endpoint viability to crawls.
