import { EndpointDef } from "./types"
import { webEndpoints } from "./web"
import { mailboxEndpoints } from "./mailbox"
import { brandEndpoints } from "./brand"
import { packageEndpoints } from "./package"
import { securityEndpoints } from "./security"
import { mediaEndpoints } from "./media"
import { agentEndpoints } from "./agent"

import { discoveryEndpoints } from "./discovery"

export const ENDPOINTS: EndpointDef[] = [
  ...webEndpoints,
  ...mailboxEndpoints,
  ...brandEndpoints,
  ...packageEndpoints,
  ...securityEndpoints,
  ...mediaEndpoints,
  ...agentEndpoints,
  ...discoveryEndpoints
]

export const ENDPOINTS_BY_PATH: Record<string, EndpointDef> = Object.fromEntries(
  ENDPOINTS.map((endpoint) => [endpoint.path, endpoint])
)

export function paidEndpoints() {
  return ENDPOINTS.filter((endpoint) => !endpoint.free)
}

export function freeEndpoints() {
  return ENDPOINTS.filter((endpoint) => endpoint.free)
}
