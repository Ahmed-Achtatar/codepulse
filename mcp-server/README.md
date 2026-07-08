# CodePulse Agent Kit (MCP server)

Four pay-per-call tools for AI agents, over the [x402](https://x402.org) protocol — **bring your own wallet, no API key, no signup.** Every tool call makes a USDC micropayment on Base from your wallet to the CodePulse API.

| Tool | What it does | ~Cost |
|---|---|---|
| `web_search` | Performs web searches via DuckDuckGo and returns results as plain text | $0.02 |
| `web_scrape` | Scrapes raw text content from public webpage URLs | $0.03 |
| `temp_mailbox` | Creates a temporary disposable mailbox or polls messages/OTPs | $0.01 |
| `secret_scan` | Audits text blocks to scan for private keys or API key leaks | $0.03 |

## Setup

1. Install: `npm install` (or run via `npx codepulse-agent-kit` once published).
2. Fund a **burner** wallet with a little USDC on Base (this pays per call).
3. Configure your MCP client with the wallet key:

```json
{
  "mcpServers": {
    "codepulse": {
      "command": "npx",
      "args": ["-y", "codepulse-agent-kit"],
      "env": {
        "EVM_PRIVATE_KEY": "0xYOUR_BURNER_PRIVATE_KEY"
      }
    }
  }
}
```

Use a dedicated burner key with only a few dollars of USDC — never a primary wallet.

## Environment

| Var | Required | Default |
|---|---|---|
| `EVM_PRIVATE_KEY` | yes (to pay) | — |
| `CODEPULSE_BASE_URL` | no | `https://codepulse-api.hahavoid0.workers.dev` |

## How payment works

The server wraps `fetch` with x402 payment (`@x402/fetch`). On a `402 Payment Required`, it signs and submits a USDC transfer on Base for the exact amount the endpoint asks, then retries. You pay only for calls that succeed. No accounts, no subscriptions.

## Notes

Outputs are informational (each response carries a `confidence` and disclaimer) — surface them to your agent's reasoning/risk layer, don't auto-execute value transfers on them.
