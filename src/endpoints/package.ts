import { EndpointDef } from "./types"
import { str, response } from "./utils"

function createEndpoint(input: Omit<EndpointDef, "free"> & { free?: boolean }): EndpointDef {
  return {
    ...input,
    free: input.free ?? false
  }
}

const REGISTRY_UA = "CodePulse Agent support@codepulse.dev"

// Helper to fetch registry JSON
async function fetchRegistry(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": REGISTRY_UA }
  })
  if (!res.ok) {
    if (res.status === 404) return null
    throw new Error(`Registry API returned HTTP ${res.status}`)
  }
  return res.json()
}

// 1. NPM LIBRARY RESOLVER
export const registryNpmEndpoint = createEndpoint({
  path: "/registry/npm",
  operationId: "registryNpm",
  summary: "NPM Library Resolver",
  description: "Retrieves version history, dependencies, and author details from the official NPM registry.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["package"],
    properties: {
      package: { type: "string", description: "NPM package name" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "npm"],
  category: "package",
  whenToUse: "Use to retrieve the latest version, dependencies, or download tags for an NPM package.",
  doNotUseFor: "Do not use for downloading package tarball streams.",
  exampleInput: () => ({ package: "hono" }),
  exampleOutput: () => response({ version: "4.0.0", description: "Hono framework" }, "high"),
  logic: async (args) => {
    const pkg = str(args, "package")
    const data = await fetchRegistry(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`)
    if (!data) return response({ found: false, package: pkg }, "high")
    
    const latestVersion = data["dist-tags"]?.latest || ""
    const latestDetails = data.versions?.[latestVersion] || {}
    
    return response({
      found: true,
      name: data.name,
      version: latestVersion,
      description: data.description || "",
      dependencies: Object.keys(latestDetails.dependencies || {}),
      license: data.license || "",
      author: data.author?.name || ""
    }, "high")
  },
  skillId: "registryNpm",
  skillName: "NPM Library Resolver",
  skillExamples: ["Get npm stats for zod", '{"package":"zod"}']
})

// 2. PYPI PACKAGE RESOLVER
export const registryPypiEndpoint = createEndpoint({
  path: "/registry/pypi",
  operationId: "registryPypi",
  summary: "PyPI Package Resolver",
  description: "Fetches package descriptions, requirements, and release version numbers from PyPI.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["package"],
    properties: {
      package: { type: "string", description: "Python package name" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "pypi"],
  category: "package",
  whenToUse: "Use to query PyPI library metadata or requirements.",
  doNotUseFor: "Do not use for executing python scripts.",
  exampleInput: () => ({ package: "requests" }),
  exampleOutput: () => response({ version: "2.31.0", author: "Kenneth Reitz" }, "high"),
  logic: async (args) => {
    const pkg = str(args, "package")
    const data = await fetchRegistry(`https://pypi.org/pypi/${encodeURIComponent(pkg)}/json`)
    if (!data) return response({ found: false, package: pkg }, "high")
    
    const info = data.info || {}
    return response({
      found: true,
      name: info.name,
      version: info.version || "",
      summary: info.summary || "",
      author: info.author || "",
      requires_python: info.requires_python || "",
      project_urls: info.project_urls || {},
      license: info.license || ""
    }, "high")
  },
  skillId: "registryPypi",
  skillName: "PyPI Package Resolver",
  skillExamples: ["Get package info for pydantic", '{"package":"pydantic"}']
})

// 3. RUST CRATES.IO RESOLVER
export const registryCratesEndpoint = createEndpoint({
  path: "/registry/crates",
  operationId: "registryCrates",
  summary: "Rust Crates.io Resolver",
  description: "Looks up Rust crate details, downloads history, and dependencies from Crates.io.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["crate"],
    properties: {
      crate: { type: "string", description: "Rust crate name" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "crates"],
  category: "package",
  whenToUse: "Use to verify Rust library registry statuses.",
  doNotUseFor: "Do not use for running cargo commands.",
  exampleInput: () => ({ crate: "tokio" }),
  exampleOutput: () => response({ crate: "tokio", version: "1.35.1", downloads: 10000000 }, "high"),
  logic: async (args) => {
    const crate = str(args, "crate")
    const data = await fetchRegistry(`https://crates.io/api/v1/crates/${encodeURIComponent(crate)}`)
    if (!data || !data.crate) return response({ found: false, crate }, "high")
    
    const c = data.crate
    return response({
      found: true,
      name: c.name,
      max_version: c.max_version || "",
      description: c.description || "",
      downloads: c.downloads || 0,
      homepage: c.homepage || "",
      repository: c.repository || "",
      keywords: data.keywords?.map((k: any) => k.id) || []
    }, "high")
  },
  skillId: "registryCrates",
  skillName: "Rust Crates.io Resolver",
  skillExamples: ["Check rust crate details for serde", '{"crate":"serde"}']
})

// 4. GOLANG PROXY CONFIG CHECKER
export const registryGolangEndpoint = createEndpoint({
  path: "/registry/golang",
  operationId: "registryGolang",
  summary: "Go Proxy Config Checker",
  description: "Queries Go release tags and modules list from proxy.golang.org.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["module"],
    properties: {
      module: { type: "string", description: "Golang module URL (e.g. github.com/gin-gonic/gin)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "golang"],
  category: "package",
  whenToUse: "Use to verify release modules available on Go proxy pipelines.",
  doNotUseFor: "Do not use for executing go build commands.",
  exampleInput: () => ({ module: "github.com/gin-gonic/gin" }),
  exampleOutput: () => response({ module: "github.com/gin-gonic/gin", versions: ["v1.9.1"] }, "high"),
  logic: async (args) => {
    const module = str(args, "module")
    const res = await fetch(`https://proxy.golang.org/${module}/@v/list`, {
      headers: { "User-Agent": REGISTRY_UA }
    })
    if (!res.ok) {
      if (res.status === 404) return response({ found: false, module }, "high")
      throw new Error(`Go Proxy returned HTTP ${res.status}`)
    }
    const text = await res.text()
    const versions = text.split("\n").map(v => v.trim()).filter(Boolean)
    return response({
      found: true,
      module,
      versions: versions.slice(-15),
      latest: versions[versions.length - 1] || ""
    }, "high")
  },
  skillId: "registryGolang",
  skillName: "Go Proxy Config Checker",
  skillExamples: ["Verify gin module versions", '{"module":"github.com/gin-gonic/gin"}']
})

// 5. PHP COMPOSER PACKAGIST LOOKUP
export const registryPackagistEndpoint = createEndpoint({
  path: "/registry/packagist",
  operationId: "registryPackagist",
  summary: "PHP Composer Packagist Lookup",
  description: "Resolves PHP library requirements and tags from Packagist.org.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["package"],
    properties: {
      package: { type: "string", description: "Composer package slug (vendor/name, e.g. monolog/monolog)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "packagist"],
  category: "package",
  whenToUse: "Use verifying PHP library versions.",
  doNotUseFor: "Do not use for downloading composer payloads.",
  exampleInput: () => ({ package: "monolog/monolog" }),
  exampleOutput: () => response({ package: "monolog/monolog", downloads: 50000000 }, "high"),
  logic: async (args) => {
    const pkg = str(args, "package")
    const data = await fetchRegistry(`https://packagist.org/packages/${pkg}.json`)
    if (!data || !data.package) return response({ found: false, package: pkg }, "high")
    
    const p = data.package
    return response({
      found: true,
      name: p.name,
      description: p.description || "",
      downloads: p.downloads?.total || 0,
      favers: p.favers || 0,
      repository: p.repository || "",
      language: p.language || ""
    }, "high")
  },
  skillId: "registryPackagist",
  skillName: "PHP Composer Packagist Lookup",
  skillExamples: ["Check composer packages stats", '{"package":"laravel/framework"}']
})

// 6. JAVA MAVEN PACKAGE RESOLVER
export const registryMavenEndpoint = createEndpoint({
  path: "/registry/maven",
  operationId: "registryMaven",
  summary: "Java Maven Package Resolver",
  description: "Queries Java package group and artifact structures from Maven Central.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["artifact"],
    properties: {
      artifact: { type: "string", description: "Artifact name (e.g. log4j)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "maven"],
  category: "package",
  whenToUse: "Use to retrieve the Maven coordinates for a Java artifact.",
  doNotUseFor: "Do not use for executing jar targets.",
  exampleInput: () => ({ artifact: "log4j" }),
  exampleOutput: () => response({ group: "log4j", artifact: "log4j", version: "1.2.17" }, "high"),
  logic: async (args) => {
    const artifact = str(args, "artifact")
    const data = await fetchRegistry(`https://search.maven.org/solrsearch/select?q=a:${encodeURIComponent(artifact)}&rows=1&wt=json`)
    const doc = data?.response?.docs?.[0]
    if (!doc) return response({ found: false, artifact }, "high")
    
    return response({
      found: true,
      groupId: doc.g,
      artifactId: doc.a,
      latestVersion: doc.v,
      p: doc.p || "",
      timestamp: doc.timestamp ? new Date(doc.timestamp).toISOString() : ""
    }, "high")
  },
  skillId: "registryMaven",
  skillName: "Java Maven Package Resolver",
  skillExamples: ["Search maven repository for log4j", '{"artifact":"log4j"}']
})

// 7. CDNJS PUBLIC LIBRARIES FINDER
export const registryCdnjsEndpoint = createEndpoint({
  path: "/registry/cdnjs",
  operationId: "registryCdnjs",
  summary: "CDNJS File Paths Resolver",
  description: "Resolves Javascript/CSS file paths hosted on cdnjs.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["library"],
    properties: {
      library: { type: "string", description: "Library name (e.g. jquery)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "cdnjs"],
  category: "package",
  whenToUse: "Use to lookup CDN urls to import libraries in web layouts.",
  doNotUseFor: "Do not use for downloading source code locally.",
  exampleInput: () => ({ library: "react" }),
  exampleOutput: () => response({ library: "react", filename: "umd/react.production.min.js" }, "high"),
  logic: async (args) => {
    const library = str(args, "library")
    const data = await fetchRegistry(`https://api.cdnjs.com/libraries/${encodeURIComponent(library)}?fields=version,filename,description`)
    if (!data || data.error) return response({ found: false, library }, "high")
    
    return response({
      found: true,
      name: data.name,
      version: data.version || "",
      filename: data.filename || "",
      description: data.description || "",
      url: `https://cdnjs.cloudflare.com/ajax/libs/${data.name}/${data.version}/${data.filename}`
    }, "high")
  },
  skillId: "registryCdnjs",
  skillName: "CDNJS File Paths Resolver",
  skillExamples: ["Get jquery cdn links", '{"library":"jquery"}']
})

// 8. GITHUB REPOSITORY STATS LOOKUP
export const registryGithubRepoEndpoint = createEndpoint({
  path: "/registry/github/repo",
  operationId: "registryGithubRepo",
  summary: "GitHub Repository Stats Lookup",
  description: "Reads star counts, issues, forks, and description for a GitHub repository.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["repo"],
    properties: {
      repo: { type: "string", description: "Repository slug (owner/name, e.g. facebook/react)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "github"],
  category: "package",
  whenToUse: "Use checking repository popularity metrics or health indicators.",
  doNotUseFor: "Do not use for cloning git files.",
  exampleInput: () => ({ repo: "honojs/hono" }),
  exampleOutput: () => response({ stars: 15000, open_issues: 100 }, "high"),
  logic: async (args) => {
    const repo = str(args, "repo")
    const data = await fetchRegistry(`https://api.github.com/repos/${repo}`)
    if (!data) return response({ found: false, repo }, "high")
    
    return response({
      found: true,
      name: data.full_name,
      description: data.description || "",
      stars: data.stargazers_count || 0,
      forks: data.forks_count || 0,
      open_issues: data.open_issues_count || 0,
      watchers: data.watchers_count || 0,
      homepage: data.homepage || "",
      created_at: data.created_at || ""
    }, "high")
  },
  skillId: "registryGithubRepo",
  skillName: "GitHub Repository Stats Lookup",
  skillExamples: ["Get github stats for react", '{"repo":"facebook/react"}']
})

// 9. GITHUB RELEASES VERSION RESOLVER
export const registryGithubReleaseEndpoint = createEndpoint({
  path: "/registry/github/release",
  operationId: "registryGithubRelease",
  summary: "GitHub Tag Release Resolver",
  description: "Retrieves the latest tag release and release notes for a GitHub repository.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["repo"],
    properties: {
      repo: { type: "string", description: "Repository slug (owner/name)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "github"],
  category: "package",
  whenToUse: "Use to verify recent version tags and release note details.",
  doNotUseFor: "Do not use for downloading binary releases.",
  exampleInput: () => ({ repo: "honojs/hono" }),
  exampleOutput: () => response({ tag_name: "v4.0.0", name: "Version 4 Release" }, "high"),
  logic: async (args) => {
    const repo = str(args, "repo")
    const data = await fetchRegistry(`https://api.github.com/repos/${repo}/releases/latest`)
    if (!data) return response({ found: false, repo }, "high")
    
    return response({
      found: true,
      tag_name: data.tag_name || "",
      name: data.name || "",
      published_at: data.published_at || "",
      body: (data.body || "").slice(0, 1000)
    }, "high")
  },
  skillId: "registryGithubRelease",
  skillName: "GitHub Tag Release Resolver",
  skillExamples: ["Check latest release notes for rust", '{"repo":"rust-lang/rust"}']
})

// 10. GITHUB REPO LICENSE RESOLVER
export const registryGithubLicenseEndpoint = createEndpoint({
  path: "/registry/github/license",
  operationId: "registryGithubLicense",
  summary: "GitHub Repository License Resolver",
  description: "Scrapes and parses repository license configurations from GitHub.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["repo"],
    properties: {
      repo: { type: "string", description: "Repository slug (owner/name)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["registry", "github"],
  category: "package",
  whenToUse: "Use when an agent needs to audit open-source license compliance.",
  doNotUseFor: "Do not use for legal licensing clearances.",
  exampleInput: () => ({ repo: "honojs/hono" }),
  exampleOutput: () => response({ license: "MIT" }, "high"),
  logic: async (args) => {
    const repo = str(args, "repo")
    const data = await fetchRegistry(`https://api.github.com/repos/${repo}/license`)
    if (!data || !data.license) return response({ found: false, repo }, "high")
    
    return response({
      found: true,
      name: data.license.name || "",
      key: data.license.key || "",
      spdx_id: data.license.spdx_id || "",
      url: data.license.url || ""
    }, "high")
  },
  skillId: "registryGithubLicense",
  skillName: "GitHub Repository License Resolver",
  skillExamples: ["Verify repository license for lodash", '{"repo":"lodash/lodash"}']
})

export const packageEndpoints = [
  registryNpmEndpoint,
  registryPypiEndpoint,
  registryCratesEndpoint,
  registryGolangEndpoint,
  registryPackagistEndpoint,
  registryMavenEndpoint,
  registryCdnjsEndpoint,
  registryGithubRepoEndpoint,
  registryGithubReleaseEndpoint,
  registryGithubLicenseEndpoint
]
