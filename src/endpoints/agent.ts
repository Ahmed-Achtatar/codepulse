import { EndpointDef } from "./types"
import { str, response } from "./utils"

function createEndpoint(input: Omit<EndpointDef, "free"> & { free?: boolean }): EndpointDef {
  return {
    ...input,
    free: input.free ?? false
  }
}

// 1. AGENT DATA REQUEST
export const agentRequestDataEndpoint = createEndpoint({
  path: "/agent/request-data",
  operationId: "agentRequestData",
  summary: "Request Missing Data",
  description: "Logs an agent's request for new live data sources.",
  priceUsd: "0.000",
  free: true,
  requestSchema: {
    type: "object",
    required: ["description"],
    properties: {
      description: { type: "string", description: "Description of the missing data or endpoint needed" },
      agent_id: { type: "string", description: "Optional agent identifier" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["agent", "support"],
  category: "agent",
  whenToUse: "Use when an agent needs live data that this API does not serve yet.",
  doNotUseFor: "Do not use for polling existing endpoints.",
  exampleInput: () => ({ description: "Live train arrivals for Tokyo Metro" }),
  exampleOutput: () => response({
    status: "recorded",
    message: "Thank you. Frequently requested data becomes a real endpoint soon."
  }, "high"),
  logic: async (args, c) => {
    const description = str(args, "description")
    const agentId = str(args, "agent_id", false) || "anonymous"
    
    // In a real implementation we would write this to KV or send an email to the admin.
    if (c?.env?.CACHE) {
      await c.env.CACHE.put(`request-data:${Date.now()}:${agentId}`, description)
    }
    
    return response({
      status: "recorded",
      message: "Thank you. Frequently requested data becomes a real endpoint soon."
    }, "high")
  },
  skillId: "agentRequestData",
  skillName: "Request Missing Data",
  skillExamples: ["Request a new API endpoint", '{"description":"Need an endpoint for stock ticker symbol resolution"}']
})

// 2. AGENT FEEDBACK
export const agentFeedbackEndpoint = createEndpoint({
  path: "/agent/feedback",
  operationId: "agentFeedback",
  summary: "Report Bad Data or Broken Endpoints",
  description: "Accepts structured feedback about broken endpoints or stale data.",
  priceUsd: "0.000",
  free: true,
  requestSchema: {
    type: "object",
    required: ["endpoint", "issue"],
    properties: {
      endpoint: { type: "string", description: "The path of the endpoint (e.g. /web/search)" },
      issue: { type: "string", description: "Description of the problem, stale data, or unexpected error" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["agent", "support", "feedback"],
  category: "agent",
  whenToUse: "Use when an endpoint returns incorrect, stale, or severely malformed data.",
  doNotUseFor: "Do not use for general support inquiries.",
  exampleInput: () => ({ endpoint: "/web/search", issue: "Results were 5 years old" }),
  exampleOutput: () => response({
    status: "recorded",
    message: "Feedback recorded and prioritized for fixing."
  }, "high"),
  logic: async (args, c) => {
    const endpointPath = str(args, "endpoint")
    const issue = str(args, "issue")
    
    if (c?.env?.CACHE) {
      await c.env.CACHE.put(`feedback:${Date.now()}:${endpointPath}`, issue)
    }
    
    return response({
      status: "recorded",
      message: "Feedback recorded and prioritized for fixing."
    }, "high")
  },
  skillId: "agentFeedback",
  skillName: "Report Bad Data or Broken Endpoints",
  skillExamples: ["Report that an endpoint is broken", '{"endpoint":"/web/history","issue":"Always returns 404"}']
})

// 3. AGENT DISCOVERY BROADCAST
export const agentDiscoveryBroadcastEndpoint = createEndpoint({
  path: "/agent/discovery-broadcast",
  operationId: "agentDiscoveryBroadcast",
  summary: "Agent Capability Broadcast",
  description: "Broadcasts an agent's capabilities to a public registry KV store to enable agent-to-agent discovery.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["agent_name", "capabilities_url", "description"],
    properties: {
      agent_name: { type: "string", description: "Name of the agent" },
      capabilities_url: { type: "string", description: "URL to the agent's well-known metadata (e.g. /agent-card.json)" },
      description: { type: "string", description: "A brief description of what the agent can do" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["agent", "discovery", "registry"],
  category: "agent",
  whenToUse: "Use when an agent wants to be discovered by other agents on the CodePulse network.",
  doNotUseFor: "Do not use for submitting private URLs or internal endpoints.",
  exampleInput: () => ({ 
    agent_name: "Example Researcher", 
    capabilities_url: "https://example.com/agent.json",
    description: "An AI researcher agent that can write reports."
  }),
  exampleOutput: () => response({
    status: "broadcasted",
    message: "Agent capabilities added to the public discovery registry.",
    registry_url: "https://codepulse-api.hahavoid0.workers.dev/agent-directory"
  }, "high"),
  logic: async (args, c) => {
    const name = str(args, "agent_name")
    const url = str(args, "capabilities_url")
    const desc = str(args, "description")
    
    if (c?.env?.CACHE) {
      await c.env.CACHE.put(`directory:agent:${Date.now()}`, JSON.stringify({ name, url, desc }))
    }
    
    return response({
      status: "broadcasted",
      message: "Agent capabilities added to the public discovery registry.",
      registry_url: "https://codepulse-api.hahavoid0.workers.dev/agent-directory"
    }, "high")
  },
  skillId: "agentDiscoveryBroadcast",
  skillName: "Agent Capability Broadcast",
  skillExamples: ["Broadcast agent to registry", '{"agent_name":"TraderBot","capabilities_url":"https://traderbot.local/a2a","description":"Executes trades"}']
})

export const agentEndpoints = [
  agentRequestDataEndpoint,
  agentFeedbackEndpoint,
  agentDiscoveryBroadcastEndpoint
]
