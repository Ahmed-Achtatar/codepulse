#!/usr/bin/env node
// CodePulse Agent Kit — MCP server.
// Exposes pay-per-call tools for AI agents. Every tool call makes an x402
// micropayment (USDC on Base) from the operator's own wallet to CodePulse.
// Bring your own funded burner wallet via EVM_PRIVATE_KEY. No API key, no signup.

import { privateKeyToAccount } from "viem/accounts";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm/exact/client";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const BASE = process.env.CODEPULSE_BASE_URL || process.env.STATEPULSE_BASE_URL || "https://codepulse-api.hahavoid0.workers.dev";
const PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;

// Build the paying fetch once (only if a wallet is configured).
let payFetch = null;
let walletAddress = null;
if (PRIVATE_KEY && !PRIVATE_KEY.includes("YOUR_")) {
  const account = privateKeyToAccount(PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`);
  walletAddress = account.address;
  const client = new x402Client();
  client.register("eip155:*", new ExactEvmScheme(account));
  payFetch = wrapFetchWithPayment(fetch, client);
}

async function callPaid(path, body) {
  if (!payFetch) {
    throw new Error(
      "No wallet configured. Set EVM_PRIVATE_KEY (a funded Base burner wallet) in the MCP server env to enable pay-per-call tools."
    );
  }
  const res = await payFetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  let payment = null;
  const pr = res.headers.get("x-payment-response");
  if (pr) {
    try { payment = JSON.parse(Buffer.from(pr, "base64").toString("utf8")); } catch {}
  }
  return { status: res.status, data, payment };
}

const TOOLS = [
  {
    name: "web_search",
    description:
      "Performs search queries via DuckDuckGo and parses organic results as plain text. Useful for real-time web search without paid keys. Costs ~$0.02 USDC on Base.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Search keywords or query" }
      }
    },
    run: (a) => callPaid("/web/search", { query: a.query })
  },
  {
    name: "web_scrape",
    description:
      "Extracts readable text contents from any public web page URL locally. Useful for scraping articles, blogs, or documentation. Costs ~$0.03 USDC on Base.",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string", description: "Target public URL to scrape" }
      }
    },
    run: (a) => callPaid("/web/scrape", { url: a.url })
  },
  {
    name: "temp_mailbox",
    description:
      "Disposable temporary email mailbox utility. Actions: 'create' (generates a temporary address) or 'messages' (polls inbox for OTP codes/messages, requires email). Costs ~$0.01 USDC on Base.",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["create", "messages"], description: "Action to perform: 'create' or 'messages'" },
        email: { type: "string", description: "The email address generated via 'create' (only required for 'messages')" }
      }
    },
    run: (a) => {
      if (a.action === "create") {
        return callPaid("/mailbox/create", {});
      } else if (a.action === "messages") {
        if (!a.email) throw new Error("email is required for action 'messages'");
        return callPaid("/mailbox/messages", { email: a.email });
      } else {
        throw new Error(`Unknown action: ${a.action}`);
      }
    }
  },
  {
    name: "secret_scan",
    description:
      "Runs heuristic audits on text blocks to detect potential secrets, private keys, or API keys leaks. Costs ~$0.03 USDC on Base.",
    inputSchema: {
      type: "object",
      required: ["text"],
      properties: {
        text: { type: "string", description: "The raw text block to audit" }
      }
    },
    run: (a) => callPaid("/security/secret-scan", { text: a.text })
  }
];

const server = new Server(
  { name: "codepulse-agent-kit", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }] };
  }
  try {
    const result = await tool.run(req.params.arguments || {});
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    return { isError: true, content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `codepulse-agent-kit MCP server running (wallet: ${walletAddress || "NOT CONFIGURED — set EVM_PRIVATE_KEY"})`
);
