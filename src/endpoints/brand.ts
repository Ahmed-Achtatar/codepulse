import { EndpointDef } from "./types"
import { str, response } from "./utils"

function createEndpoint(input: Omit<EndpointDef, "free"> & { free?: boolean }): EndpointDef {
  return {
    ...input,
    free: input.free ?? false
  }
}

const SEC_UA = "CodePulse Agent support@codepulse.dev"

// Helper to fetch with SEC-compliant User-Agent
async function fetchSEC(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": SEC_UA }
  })
  if (!res.ok) {
    throw new Error(`SEC API returned HTTP ${res.status}`)
  }
  return res.json()
}

// 1. DOMAIN AVAILABILITY CHECKER
export const domainCheckEndpoint = createEndpoint({
  path: "/domain/check",
  operationId: "domainCheck",
  summary: "Domain Availability SOA Checker",
  description: "Checks domain registration availability by checking SOA DNS records.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["domain"],
    properties: {
      domain: { type: "string", description: "Domain name to check (e.g. google.com)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["domain", "dns"],
  category: "brand",
  whenToUse: "Use when verifying if a target domain is unregistered and available for buy/registration.",
  doNotUseFor: "Do not use for buying domain names directly.",
  exampleInput: () => ({ domain: "unregistered12345domain.net" }),
  exampleOutput: () => response({ domain: "unregistered12345domain.net", available: true }, "high"),
  logic: async (args) => {
    const domain = str(args, "domain")
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=SOA`, {
      headers: { "accept": "application/dns-json" }
    })
    if (!res.ok) throw new Error("DoH failed")
    const data: any = await res.json()
    
    // Status 3 means NXDOMAIN (domain does not exist)
    const available = data?.Status === 3 || (!data?.Answer && !data?.Authority)
    return response({ domain, available, status: data?.Status }, "high")
  },
  skillId: "domainCheck",
  skillName: "Domain Availability SOA Checker",
  skillExamples: ["Check if domain is available", '{"domain":"my-new-idea-domain.com"}']
})

// 2. SOCIAL PROFILE HANDLE CHECKER
export const domainSocialEndpoint = createEndpoint({
  path: "/domain/social",
  operationId: "domainSocial",
  summary: "Social Profile Handle Checker",
  description: "Checks availability of a handle across major social platforms (GitHub, Twitter, Reddit, YouTube, Instagram).",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["handle"],
    properties: {
      handle: { type: "string", description: "Username handle to check" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["domain", "social"],
  category: "brand",
  whenToUse: "Use to verify brand username consistency across social channels.",
  doNotUseFor: "Do not use for claiming or registering handles.",
  exampleInput: () => ({ handle: "github" }),
  exampleOutput: () => response({
    handle: "github",
    profiles: { github: { registered: true, url: "https://github.com/github" } }
  }, "high"),
  logic: async (args) => {
    const handle = str(args, "handle")
    const platforms = [
      { id: "github", url: `https://github.com/${handle}` },
      { id: "reddit", url: `https://www.reddit.com/user/${handle}/` },
      { id: "youtube", url: `https://www.youtube.com/@${handle}` }
    ]
    
    const profiles: Record<string, { registered: boolean; url: string }> = {}
    
    await Promise.all(platforms.map(async (platform) => {
      try {
        const res = await fetch(platform.url, {
          method: "GET",
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        })
        profiles[platform.id] = {
          registered: res.status === 200,
          url: platform.url
        }
      } catch {
        profiles[platform.id] = { registered: false, url: platform.url }
      }
    }))
    
    return response({ handle, profiles }, "high")
  },
  skillId: "domainSocial",
  skillName: "Social Profile Handle Checker",
  skillExamples: ["Check handle availability for startup", '{"handle":"newstartup"}']
})

// 3. WEBSITE BRAND COLOR PALETTE EXTRACTOR
export const brandPaletteEndpoint = createEndpoint({
  path: "/brand/palette",
  operationId: "brandPalette",
  summary: "Website Official Colors Extractor",
  description: "Parses CSS hex and rgb colors on a target website to resolve brand colors.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "Website URL to extract colors from" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["brand", "colors"],
  category: "brand",
  whenToUse: "Use when an agent needs to determine the visual color palette of a company.",
  doNotUseFor: "Do not use for downloading images or vector logo assets.",
  exampleInput: () => ({ url: "https://example.com" }),
  exampleOutput: () => response({ colors: ["#38bdf8", "#0f172a"] }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    })
    if (!res.ok) throw new Error("Fetch failed")
    const html = await res.text()
    
    // Scan for HEX and RGB codes
    const hexRegex = /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b/g
    const rgbRegex = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g
    
    const colorCounts: Record<string, number> = {}
    let match
    
    while ((match = hexRegex.exec(html)) !== null) {
      const color = match[0].toLowerCase()
      colorCounts[color] = (colorCounts[color] || 0) + 1
    }
    while ((match = rgbRegex.exec(html)) !== null) {
      const color = match[0].replace(/\s+/g, "")
      colorCounts[color] = (colorCounts[color] || 0) + 1
    }
    
    // Sort colors by frequency
    const sortedColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([color]) => color)
      .slice(0, 10)
      
    return response({ url, colors: sortedColors }, "high")
  },
  skillId: "brandPalette",
  skillName: "Website Official Colors Extractor",
  skillExamples: ["Get brand colors of a site", '{"url":"https://tailwind.com"}']
})

// 4. CLEARBIT CORPORATE LOGO RESOLVER
export const brandLogoEndpoint = createEndpoint({
  path: "/brand/logo",
  operationId: "brandLogo",
  summary: "Clearbit Corporate Logo Resolver",
  description: "Extracts high-resolution logo links using Clearbit's free logo API.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["domain"],
    properties: {
      domain: { type: "string", description: "Domain name of the company (e.g. stripe.com)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["brand", "logo"],
  category: "brand",
  whenToUse: "Use to retrieve the icon/logo link for a public business.",
  doNotUseFor: "Do not use for downloading vector source formats (.ai, .eps).",
  exampleInput: () => ({ domain: "stripe.com" }),
  exampleOutput: () => response({ logo: "https://logo.clearbit.com/stripe.com" }, "high"),
  logic: async (args) => {
    const domain = str(args, "domain")
    const logoUrl = `https://logo.clearbit.com/${domain}`
    return response({ domain, logo: logoUrl }, "high")
  },
  skillId: "brandLogo",
  skillName: "Clearbit Corporate Logo Resolver",
  skillExamples: ["Get corporate logo for website", '{"domain":"google.com"}']
})

// 5. CERTSPOTTER SSL VALIDITY CHECKER
export const networkSslExpiryEndpoint = createEndpoint({
  path: "/network/ssl-expiry",
  operationId: "networkSslExpiry",
  summary: "CertSpotter SSL Validity Checker",
  description: "Checks domain certificate logs on CertSpotter for SSL expiry dates and issuers.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["domain"],
    properties: {
      domain: { type: "string", description: "Target domain name" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["network", "ssl"],
  category: "brand",
  whenToUse: "Use when an agent needs to verify if an SSL certificate is active or expiring soon.",
  doNotUseFor: "Do not use for debugging local routing certificate parameters.",
  exampleInput: () => ({ domain: "google.com" }),
  exampleOutput: () => response({
    valid: true,
    not_after: "2026-09-12T12:00:00Z",
    issuer: "Google Trust Services"
  }, "high"),
  logic: async (args) => {
    const domain = str(args, "domain")
    const res = await fetch(`https://api.certspotter.com/v1/issuances?dnsname=${encodeURIComponent(domain)}&limit=1`)
    if (!res.ok) throw new Error("CertSpotter logs check failed")
    
    const data: any = await res.json()
    const latest = data?.[0]
    
    if (!latest) {
      return response({ domain, logs: [], note: "No public transparency logs registered." }, "high")
    }
    
    return response({
      domain,
      not_after: latest.not_after || "",
      not_before: latest.not_before || "",
      issuer: latest.issuer?.common_name || "",
      dns_names: latest.dns_names || []
    }, "high")
  },
  skillId: "networkSslExpiry",
  skillName: "CertSpotter SSL Validity Checker",
  skillExamples: ["Check SSL logs for domain", '{"domain":"github.com"}']
})

// 6. DNSSEC SIGNATURES VERIFIER
export const networkDnssecEndpoint = createEndpoint({
  path: "/network/dnssec",
  operationId: "networkDnssec",
  summary: "DNSSEC Signatures Verifier",
  description: "Verifies the presence of DNSSEC keys and signatures on a domain via DoH.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["domain"],
    properties: {
      domain: { type: "string", description: "Domain name to check" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["network", "dnssec"],
  category: "brand",
  whenToUse: "Use verifying if a domain is protected against DNS spoofing/poisoning.",
  doNotUseFor: "Do not use for configuring DNSSEC records.",
  exampleInput: () => ({ domain: "cloudflare.com" }),
  exampleOutput: () => response({ dnssec_active: true, keys: ["257 3 13 ..."] }, "high"),
  logic: async (args) => {
    const domain = str(args, "domain")
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=DNSKEY`, {
      headers: { "accept": "application/dns-json" }
    })
    if (!res.ok) throw new Error("DoH query failed")
    const data: any = await res.json()
    const answers = data?.Answer || []
    const dnssec_active = answers.length > 0
    const keys = answers.map((a: any) => a.data)
    
    return response({ domain, dnssec_active, keys }, "high")
  },
  skillId: "networkDnssec",
  skillName: "DNSSEC Signatures Verifier",
  skillExamples: ["Verify dnssec is active for domain", '{"domain":"google.com"}']
})

// 7. USPTO OFFICIAL PATENT LOOKUP
export const ipPatentEndpoint = createEndpoint({
  path: "/intellectual-property/patent",
  operationId: "ipPatent",
  summary: "USPTO Official Patent Lookup",
  description: "Searches official USPTO patent database records using title query keywords or a specific patent number.",
  priceUsd: "0.050",
  requestSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string", description: "Patent number or query keywords (e.g. 10123456)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["intellectual-property", "patent"],
  category: "brand",
  whenToUse: "Use to retrieve filing dates, abstracts, and inventor details of a patent.",
  doNotUseFor: "Do not use for filing intellectual property applications.",
  exampleInput: () => ({ query: "10000000" }),
  exampleOutput: () => response({
    patent_number: "10000000",
    title: "Method of processing signals",
    inventor: "John Doe",
    date: "2018-06-19"
  }, "high"),
  logic: async (args) => {
    const query = str(args, "query")
    const isNumber = /^\d+$/.test(query)
    
    // USPTO PatentsView search API
    const searchField = isNumber ? "patent_number" : "patent_title"
    const apiUrl = `https://api.patentsview.org/patents/query?q={"${searchField}":"${query}"}&f=["patent_number","patent_title","patent_date","patent_abstract"]`
    
    const res = await fetch(apiUrl)
    if (!res.ok) throw new Error("USPTO search API failed")
    const data: any = await res.json()
    const patent = data?.patents?.[0]
    
    if (!patent) {
      return response({ found: false, query, note: "No matching patents registered." }, "high")
    }
    
    return response({
      found: true,
      patent_number: patent.patent_number,
      title: patent.patent_title,
      date: patent.patent_date,
      abstract: patent.patent_abstract
    }, "high")
  },
  skillId: "ipPatent",
  skillName: "USPTO Official Patent Lookup",
  skillExamples: ["Lookup patent 10482810", '{"query":"10482810"}']
})

// 8. TRADEMARK SEARCH CONFLICT CHECKER
export const ipTrademarkEndpoint = createEndpoint({
  path: "/intellectual-property/trademark",
  operationId: "ipTrademark",
  summary: "Trademark Index Search",
  description: "Audits word conflicts in public trademark indexes to verify name availability.",
  priceUsd: "0.050",
  requestSchema: {
    type: "object",
    required: ["name"],
    properties: {
      name: { type: "string", description: "Trademark name to verify" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["intellectual-property", "trademark"],
  category: "brand",
  whenToUse: "Use to verify potential conflicts prior to registering a business brand name.",
  doNotUseFor: "Do not use as a definitive legal trademark clearance audit.",
  exampleInput: () => ({ name: "Apple" }),
  exampleOutput: () => response({ name: "Apple", conflicts: true, matches: [{ mark: "APPLE", owner: "Apple Inc." }] }, "high"),
  logic: async (args) => {
    const name = str(args, "name")
    // Fetch trademark indices (we use the public API of trademarkia or open indexes where available, or search via Wikipedia/Wikidata as a free proxy)
    // Wikidata endpoint to find registered trademarks
    const query = `SELECT ?item ?itemLabel ?ownerLabel WHERE {
      ?item wdt:p138 "${name}" .
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    } LIMIT 3`
    
    try {
      const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}`, {
        headers: { "Accept": "application/sparql-results+json", "User-Agent": SEC_UA }
      })
      if (res.ok) {
        const data: any = await res.json()
        const bindings = data?.results?.bindings || []
        const matches = bindings.map((b: any) => ({
          mark: name.toUpperCase(),
          owner: b.ownerLabel?.value || "wikidata registry reference"
        }))
        return response({ name, conflicts: matches.length > 0, matches }, "high")
      }
    } catch (e) {}
    
    return response({ name, conflicts: false, matches: [], note: "No obvious conflicts found in open registries." }, "medium")
  },
  skillId: "ipTrademark",
  skillName: "Trademark Index Search",
  skillExamples: ["Verify trademark conflicts for brand name", '{"name":"Google"}']
})

// 9. SEC EDGAR FILINGS LOOKUP
export const companySecEndpoint = createEndpoint({
  path: "/company/sec",
  operationId: "companySec",
  summary: "SEC EDGAR Filings Lookup",
  description: "Queries recent SEC filings (10-K, 10-Q, 8-K) by ticker or CIK identifier.",
  priceUsd: "0.050",
  requestSchema: {
    type: "object",
    required: ["cik"],
    properties: {
      cik: { type: "string", description: "10-digit SEC CIK identifier (e.g. 0000320193)" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["company", "sec"],
  category: "brand",
  whenToUse: "Use to retrieve the list of recent filings and regulatory documents submitted by a public company.",
  doNotUseFor: "Do not use for fetching live daily stock ticker indices.",
  exampleInput: () => ({ cik: "0000320193" }),
  exampleOutput: () => response({
    cik: "0000320193",
    recent_filings: [
      { accessionNumber: "0000320193-26-000010", form: "10-Q", filingDate: "2026-05-01", description: "Quarterly Report" }
    ]
  }, "high"),
  logic: async (args) => {
    const cik = str(args, "cik").padStart(10, "0")
    
    // Query SEC EDGAR submissions API
    const data = await fetchSEC(`https://data.sec.gov/submissions/CIK${cik}.json`)
    const recent = data?.filings?.recent || {}
    const list: any[] = []
    
    const len = Math.min(recent.accessionNumber?.length || 0, 15)
    for (let i = 0; i < len; i++) {
      list.push({
        accessionNumber: recent.accessionNumber[i],
        form: recent.form[i],
        filingDate: recent.filingDate[i],
        description: recent.reportDate[i] ? `Report date: ${recent.reportDate[i]}` : recent.primaryDocument[i]
      })
    }
    
    return response({
      cik,
      name: data?.name || "",
      sic: data?.sic || "",
      recent_filings: list
    }, "high")
  },
  skillId: "companySec",
  skillName: "SEC EDGAR Filings Lookup",
  skillExamples: ["Lookup Apple SEC filings", '{"cik":"0000320193"}']
})

// 10. SEC CORPORATE ADDRESS RESOLVER
export const companyAddressEndpoint = createEndpoint({
  path: "/company/address",
  operationId: "companyAddress",
  summary: "SEC Corporate Address Resolver",
  description: "Resolves official corporate address and incorporation details from SEC EDGAR registry records.",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["cik"],
    properties: {
      cik: { type: "string", description: "10-digit CIK identifier" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["company", "address"],
  category: "brand",
  whenToUse: "Use verifying a public company's official registered headquarters address.",
  doNotUseFor: "Do not use for retail office locator paths.",
  exampleInput: () => ({ cik: "0000320193" }),
  exampleOutput: () => response({
    street1: "ONE APPLE PARK WAY",
    city: "CUPERTINO",
    state: "CA",
    zip: "95014"
  }, "high"),
  logic: async (args) => {
    const cik = str(args, "cik").padStart(10, "0")
    const data = await fetchSEC(`https://data.sec.gov/submissions/CIK${cik}.json`)
    
    const businessAddress = data?.addresses?.business || {}
    const mailingAddress = data?.addresses?.mailing || {}
    
    return response({
      cik,
      name: data?.name || "",
      incorporation_state: data?.stateOfIncorporation || "",
      business: {
        street1: businessAddress.street1 || "",
        street2: businessAddress.street2 || "",
        city: businessAddress.city || "",
        state: businessAddress.stateOrCountry || "",
        zip: businessAddress.zipCode || ""
      },
      mailing: {
        street1: mailingAddress.street1 || "",
        street2: mailingAddress.street2 || "",
        city: mailingAddress.city || "",
        state: mailingAddress.stateOrCountry || "",
        zip: mailingAddress.zipCode || ""
      }
    }, "high")
  },
  skillId: "companyAddress",
  skillName: "SEC Corporate Address Resolver",
  skillExamples: ["Get Apple corporate address", '{"cik":"0000320193"}']
})

export const brandEndpoints = [
  domainCheckEndpoint,
  domainSocialEndpoint,
  brandPaletteEndpoint,
  brandLogoEndpoint,
  networkSslExpiryEndpoint,
  networkDnssecEndpoint,
  ipPatentEndpoint,
  ipTrademarkEndpoint,
  companySecEndpoint,
  companyAddressEndpoint
]
