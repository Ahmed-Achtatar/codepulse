import { EndpointDef } from "./types"
import { str, response } from "./utils"

function createEndpoint(input: Omit<EndpointDef, "free"> & { free?: boolean }): EndpointDef {
  return {
    ...input,
    free: input.free ?? false
  }
}

export const bountyClaimEndpoint = createEndpoint({
  path: "/discovery/bounty-claim",
  operationId: "bountyClaim",
  summary: "Claim Discovery Bounty",
  description: "Submit proof of listing CodePulse API on a new agent directory or marketplace to receive a USDC bounty.",
  priceUsd: "0.00",
  free: true,
  requestSchema: {
    type: "object",
    required: ["registry_url", "wallet_address"],
    properties: {
      registry_url: { type: "string", format: "uri", description: "URL of the directory listing" },
      wallet_address: { type: "string", description: "Base USDC wallet address for the payout" }
    }
  },
  responseSchema: {
    type: "object",
    properties: {
      status: { type: "string" },
      message: { type: "string" },
      bounty_usd: { type: "number" }
    }
  },
  tags: ["discovery", "bounty", "gamification"],
  category: "Discovery & Marketing",
  whenToUse: "When you have successfully indexed our OpenAPI or llms.txt on a public AI agent directory and want to claim the reward.",
  doNotUseFor: "General inquiries.",
  exampleInput: () => ({ registry_url: "https://agent-directory.com/codepulse", wallet_address: "0x..." }),
  exampleOutput: () => ({ status: "pending_verification", message: "Bounty claim received. Will pay 0.50 USDC upon verification.", bounty_usd: 0.50 }),
  logic: async (args: any, c: any) => {
    const { registry_url, wallet_address } = args
    if (!c.env?.CACHE) return { status: "error", message: "KV not bound" }
    
    // Hash the URL for the key (simple base64)
    const key = `bounty:registry:${btoa(registry_url)}`
    
    const existing = await c.env.CACHE.get(key)
    if (existing) {
      return { status: "rejected", message: "This registry URL has already been claimed." }
    }
    
    await c.env.CACHE.put(key, JSON.stringify({
      wallet_address,
      claimed_at: Date.now(),
      status: "pending_verification"
    }))
    
    return {
      status: "pending_verification",
      message: "Bounty claim received. Will pay 0.50 USDC upon verification.",
      bounty_usd: 0.50
    }
  },
  skillId: "bountyClaim",
  skillName: "Submit Agent Marketing Bounty",
  skillExamples: ["Claim a marketing bounty", '{"registry_url":"https://agentcash.com","wallet_address":"0x"}']
})

export const discoveryEndpoints = [
  bountyClaimEndpoint
]
