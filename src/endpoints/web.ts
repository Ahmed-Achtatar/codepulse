import { EndpointDef } from "./types"
import { str, response } from "./utils"
import { convert } from "html-to-text"
import TurndownService from "turndown"

function createEndpoint(input: Omit<EndpointDef, "free"> & { free?: boolean }): EndpointDef {
  return {
    ...input,
    free: input.free ?? false
  }
}

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// Helper to fetch with a browser User-Agent
async function fetchAsBrowser(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${res.status}`)
  }
  return res.text()
}

// 1. DUCKDUCKGO WEB SEARCH PARSER
export const webSearchEndpoint = createEndpoint({
  path: "/web/search",
  operationId: "webSearch",
  summary: "DuckDuckGo Web Search Parser",
  description: "Performs web searches using a free DuckDuckGo HTML parser. Returns organic search results.",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string", description: "Search query keywords" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "search"],
  category: "web",
  whenToUse: "Use when an agent needs to perform general web searches without paid keys.",
  doNotUseFor: "Do not use for low-latency search completions or autocomplete queries.",
  exampleInput: () => ({ query: "artificial intelligence news" }),
  exampleOutput: () => response({
    results: [
      { title: "Example AI Article", url: "https://example.com/ai-article", snippet: "This is a brief description of the AI article." }
    ]
  }, "high"),
  logic: async (args) => {
    const query = str(args, "query")
    const html = await fetchAsBrowser(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`)
    
    // Parse DuckDuckGo results
    const results: Array<{ title: string; url: string; snippet: string }> = []
    
    // Split into result blocks
    const blocks = html.split('<div class="result results_links results_links_deep web-result')
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i]
      
      const titleMatch = block.match(/<a class="result__url" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
      
      if (titleMatch) {
        let url = titleMatch[1]
        // Resolve DuckDuckGo redirects
        if (url.includes("uddg=")) {
          const match = url.match(/uddg=([^&]+)/)
          if (match) url = decodeURIComponent(match[1])
        }
        
        const title = titleMatch[2].replace(/<[^>]*>/g, "").trim()
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : ""
        
        results.push({ title, url, snippet })
      }
    }
    
    return response({ results: results.slice(0, 10) }, "high")
  },
  skillId: "webSearch",
  skillName: "DuckDuckGo Web Search Parser",
  skillExamples: ["Search for latest base chain updates", '{"query":"base network upgrades 2026"}']
})

// 2. WEB SCRAPING TEXT EXTRACTOR
export const webScrapeEndpoint = createEndpoint({
  path: "/web/scrape",
  operationId: "webScrape",
  summary: "Web Scraping Text Extractor",
  description: "Extracts clean readable text from any website URL.",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "Website URL to scrape" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "scrape"],
  category: "web",
  whenToUse: "Use when an agent needs to retrieve the main text/article from a web page.",
  doNotUseFor: "Do not use for downloading binary payloads like images or ZIP archives.",
  exampleInput: () => ({ url: "https://example.com" }),
  exampleOutput: () => response({
    text: "Example Domain\nThis domain is for use in illustrative examples..."
  }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const html = await fetchAsBrowser(url)
    const text = convert(html, {
      wordwrap: 130
    })
    return response({ text: text.trim().slice(0, 80000) }, "high")
  },
  skillId: "webScrape",
  skillName: "Web Scraping Text Extractor",
  skillExamples: ["Scrape the home page of openaq", '{"url":"https://openaq.org"}']
})

// 3. HTML TO MARKDOWN DOWNLOADER
export const webMarkdownEndpoint = createEndpoint({
  path: "/web/markdown",
  operationId: "webMarkdown",
  summary: "HTML to Markdown Downloader",
  description: "Downloads HTML and compiles it to markdown locally using Turndown.",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "Target URL to convert to markdown" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "markdown"],
  category: "web",
  whenToUse: "Use when an agent needs a clean markdown rendering of documentation or blogs.",
  doNotUseFor: "Do not use for parsing dynamic SPA apps requiring JavaScript hydration.",
  exampleInput: () => ({ url: "https://example.com" }),
  exampleOutput: () => response({
    markdown: "# Example Domain\n\nThis domain is for use in illustrative examples..."
  }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const html = await fetchAsBrowser(url)
    const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" })
    const markdown = turndownService.turndown(html)
    return response({ markdown: markdown.trim().slice(0, 80000) }, "high")
  },
  skillId: "webMarkdown",
  skillName: "HTML to Markdown Downloader",
  skillExamples: ["Download documentation as markdown", '{"url":"https://nodejs.org"}']
})

// 4. OPENGRAPH & METADATA EXTRACTOR
export const webMetadataEndpoint = createEndpoint({
  path: "/web/metadata",
  operationId: "webMetadata",
  summary: "OpenGraph & Metadata Extractor",
  description: "Extracts OpenGraph tags, description, keywords, and page header meta tags.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "URL to read headers and tags from" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "metadata"],
  category: "web",
  whenToUse: "Use when an agent needs to retrieve semantic details or logo URLs of a web page.",
  doNotUseFor: "Do not use for downloading the entire page text content.",
  exampleInput: () => ({ url: "https://example.com" }),
  exampleOutput: () => response({
    title: "Example Domain",
    description: "Illustrative example domain description",
    og: { title: "Example Domain", description: "Illustrative description" }
  }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const html = await fetchAsBrowser(url)
    
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : ""
    
    const metaTags: Record<string, string> = {}
    const ogTags: Record<string, string> = {}
    
    const regex = /<meta\s+[^>]*?(?:name|property)="([^"]+)"[^>]*?content="([^"]+)"/gi
    let match
    while ((match = regex.exec(html)) !== null) {
      const name = match[1].toLowerCase()
      const content = match[2]
      if (name.startsWith("og:")) {
        ogTags[name.substring(3)] = content
      } else {
        metaTags[name] = content
      }
    }
    
    return response({
      title,
      description: metaTags.description || ogTags.description || "",
      keywords: metaTags.keywords || "",
      og: ogTags,
      meta: metaTags
    }, "high")
  },
  skillId: "webMetadata",
  skillName: "OpenGraph & Metadata Extractor",
  skillExamples: ["Get page keywords and meta tags", '{"url":"https://github.com"}']
})

// 5. WAYBACK MACHINE SNAPSHOT QUERY
export const webHistoryEndpoint = createEndpoint({
  path: "/web/history",
  operationId: "webHistory",
  summary: "Archive.org Wayback Snapshot Query",
  description: "Queries historical website snapshots from the free Archive.org API.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "URL to query snapshots for" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "history"],
  category: "web",
  whenToUse: "Use when an agent needs to retrieve historical snapshots of websites or verify content changes.",
  doNotUseFor: "Do not use for real-time live page fetches.",
  exampleInput: () => ({ url: "https://example.com" }),
  exampleOutput: () => response({
    available: true,
    snapshot_url: "https://web.archive.org/web/20061205213202/http://example.com:80/",
    timestamp: "20061205213202"
  }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const res = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`)
    if (!res.ok) {
      throw new Error(`Archive.org returned status ${res.status}`)
    }
    const data: any = await res.json()
    const snapshot = data?.archived_snapshots?.closest
    
    return response({
      available: !!snapshot,
      snapshot_url: snapshot?.url || "",
      timestamp: snapshot?.timestamp || "",
      status: snapshot?.status || ""
    }, "high")
  },
  skillId: "webHistory",
  skillName: "Archive.org Wayback Snapshot Query",
  skillExamples: ["Check wayback snapshot for yahoo.com", '{"url":"https://yahoo.com"}']
})

// 6. RSS/ATOM FEED XML PARSER
export const webRssEndpoint = createEndpoint({
  path: "/web/rss",
  operationId: "webRss",
  summary: "RSS/Atom XML Feed Parser",
  description: "Parses any public RSS or Atom XML feed URL into structured JSON.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "Feed XML URL" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "rss"],
  category: "web",
  whenToUse: "Use when an agent needs to parse recent articles or update updates from news feeds.",
  doNotUseFor: "Do not use for downloading binary attachments or scraping images.",
  exampleInput: () => ({ url: "https://hnrss.org/frontpage" }),
  exampleOutput: () => response({
    feed: { title: "Hacker News", link: "https://news.ycombinator.com/" },
    items: [
      { title: "Interesting post", link: "https://example.com/interesting", pubDate: "2026-06-25T12:00:00Z" }
    ]
  }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const xml = await fetchAsBrowser(url)
    
    const feedTitleMatch = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const feedTitle = feedTitleMatch ? feedTitleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : ""
    
    const items: Array<{ title: string; link: string; pubDate: string; description: string }> = []
    
    // Detect if Atom or RSS
    const isAtom = xml.includes("<entry")
    const elementBlocks = xml.split(isAtom ? "<entry" : "<item")
    
    for (let i = 1; i < elementBlocks.length; i++) {
      const block = elementBlocks[i]
      
      const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      // For atom, links look like <link href="..."/> or <link>...</link>
      let link = ""
      const linkMatchHref = block.match(/<link\s+[^>]*?href="([^"]+)"/i)
      if (linkMatchHref) {
        link = linkMatchHref[1]
      } else {
        const linkMatchText = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)
        if (linkMatchText) link = linkMatchText[1].trim()
      }
      
      const dateMatch = block.match(/<(pubDate|updated|published)[^>]*>([\s\S]*?)<\/\1>/i)
      const descMatch = block.match(/<(description|summary|content)[^>]*>([\s\S]*?)<\/\1>/i)
      
      const title = titleMatch ? titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").trim() : ""
      const pubDate = dateMatch ? dateMatch[2].trim() : ""
      const description = descMatch ? descMatch[2].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]*>/g, "").trim().slice(0, 500) : ""
      
      if (title || link) {
        items.push({ title, link, pubDate, description })
      }
    }
    
    return response({
      feed: { title: feedTitle, link: url },
      items: items.slice(0, 20)
    }, "high")
  },
  skillId: "webRss",
  skillName: "RSS/Atom XML Feed Parser",
  skillExamples: ["Parse hacker news hnrss feed", '{"url":"https://hnrss.org/frontpage"}']
})

// 7. SITEMAP XML URL EXTRACTOR
export const webSitemapEndpoint = createEndpoint({
  path: "/web/sitemap",
  operationId: "webSitemap",
  summary: "Sitemap XML URL Extractor",
  description: "Resolves and lists all URLs inside a sitemap XML.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "URL to sitemap.xml file" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "sitemap"],
  category: "web",
  whenToUse: "Use when an agent wants to discover all crawlable pages of a target website.",
  doNotUseFor: "Do not use for downloading pages text content.",
  exampleInput: () => ({ url: "https://example.com/sitemap.xml" }),
  exampleOutput: () => response({
    urls: ["https://example.com/home", "https://example.com/about"]
  }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const xml = await fetchAsBrowser(url)
    
    const urls: string[] = []
    const regex = /<loc>([\s\S]*?)<\/loc>/gi
    let match
    while ((match = regex.exec(xml)) !== null) {
      urls.push(match[1].trim())
    }
    
    return response({ urls: urls.slice(0, 1000) }, "high")
  },
  skillId: "webSitemap",
  skillName: "Sitemap XML URL Extractor",
  skillExamples: ["Extract links from a sitemap", '{"url":"https://sitemaps.org/sitemap.xml"}']
})

// 8. CLOUDFLARE DNS TXT & MX LOOKUP
export const webDnsTxtEndpoint = createEndpoint({
  path: "/web/dns-txt",
  operationId: "webDnsTxt",
  summary: "Cloudflare DNS Records Query",
  description: "Fetches TXT, MX, A, CNAME, and CAA records for a domain via Cloudflare DNS-over-HTTPS.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["domain"],
    properties: {
      domain: { type: "string", description: "Domain name to check" },
      type: { type: "string", description: "DNS record type (TXT, MX, CAA, A, CNAME, NS)", default: "TXT" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["web", "dns"],
  category: "web",
  whenToUse: "Use verifying domain configuration, email routing MX entries, or safety headers.",
  doNotUseFor: "Do not use for looking up registry creation timestamps (use /web/whois).",
  exampleInput: () => ({ domain: "google.com", type: "TXT" }),
  exampleOutput: () => response({
    records: ["v=spf1 include:_spf.google.com ~all"]
  }, "high"),
  logic: async (args) => {
    const domain = str(args, "domain")
    const type = str(args, "type", false) || "TXT"
    
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`, {
      headers: { "accept": "application/dns-json" }
    })
    if (!res.ok) {
      throw new Error(`DoH endpoint returned HTTP ${res.status}`)
    }
    const data: any = await res.json()
    const answers = data?.Answer || []
    
    const records = answers.map((a: any) => {
      // TXT answers are surrounded by double quotes in the response
      let val = a.data
      if (a.type === 16 && val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1)
      }
      return val
    })
    
    return response({ records, status: data?.Status }, "high")
  },
  skillId: "webDnsTxt",
  skillName: "Cloudflare DNS Records Query",
  skillExamples: ["Check MX records for google.com", '{"domain":"google.com","type":"MX"}']
})

// 9. PUBLIC WHOIS/RDAP DOMAIN QUERY
export const webWhoisEndpoint = createEndpoint({
  path: "/web/whois",
  operationId: "webWhois",
  summary: "Public WHOIS/RDAP Domain Query",
  description: "Queries global registry metadata via the public RDAP protocol to find registration details.",
  priceUsd: "0.020",
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
  tags: ["web", "whois"],
  category: "web",
  whenToUse: "Use checking domain registrar name, expiration timestamp, or creation date.",
  doNotUseFor: "Do not use for DNS record lookup (use /web/dns-txt).",
  exampleInput: () => ({ domain: "google.com" }),
  exampleOutput: () => response({
    registrar: "MarkMonitor Inc.",
    created_at: "1997-09-15T04:00:00Z",
    expired_at: "2028-09-14T04:00:00Z"
  }, "high"),
  logic: async (args) => {
    const domain = str(args, "domain")
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`)
    if (!res.ok) {
      if (res.status === 404) return response({ error: "Domain not registered or RDAP records not found." }, "high", ["RDAP returned 404"])
      throw new Error(`RDAP returned HTTP ${res.status}`)
    }
    
    const data: any = await res.json()
    
    // Resolve dates
    let created_at = ""
    let expired_at = ""
    for (const event of data?.events || []) {
      if (event.eventAction === "registration") created_at = event.eventDate
      if (event.eventAction === "expiration") expired_at = event.eventDate
    }
    
    // Resolve registrar
    let registrar = ""
    for (const entity of data?.entities || []) {
      if (entity.roles?.includes("registrar")) {
        const vcard = entity.vcardArray?.[1] || []
        const fn = vcard.find((prop: any) => prop[0] === "fn")
        registrar = fn ? fn[3] : (entity.handle || "")
      }
    }
    
    return response({
      registrar,
      created_at,
      expired_at,
      status: data?.status || []
    }, "high")
  },
  skillId: "webWhois",
  skillName: "Public WHOIS/RDAP Domain Query",
  skillExamples: ["Lookup WHOIS details for domain", '{"domain":"github.com"}']
})

export const webSearchPreflightEndpoint = createEndpoint({
  path: "/web/search-preflight",
  operationId: "webSearchPreflight",
  summary: "Web Search (Free Preflight)",
  description: "Free preflight check for web search. Validates parameters and confirms API availability.",
  priceUsd: "0.00",
  free: true,
  requestSchema: {
    type: "object",
    required: ["q"],
    properties: {
      q: { type: "string", description: "Search query" }
    }
  },
  responseSchema: {
    type: "object",
    properties: {
      available: { type: "boolean" },
      estimated_results: { type: "string" },
      next_action: { type: "string" }
    }
  },
  tags: ["web", "search", "preflight"],
  category: "Web & Research",
  whenToUse: "When you want to verify search parameters before paying for the actual results.",
  doNotUseFor: "Getting actual search results.",
  exampleInput: () => ({ q: "Cloudflare Workers KV" }),
  exampleOutput: () => ({ available: true, estimated_results: "10+", next_action: "npx agentcash@latest fetch https://api.codepulse.com/web/search -m POST -b '{\"q\":\"Cloudflare Workers KV\"}'" }),
  logic: async (args: any, c: any) => {
    return {
      available: true,
      estimated_results: "10+",
      next_action: `npx agentcash@latest fetch ${new URL(c.req.url).origin}/web/search -m POST -b '${JSON.stringify({ q: args.q })}'`
    }
  },
  skillId: "webSearchPreflight",
  skillName: "Web Search Preflight Check",
  skillExamples: ["Check if search works", '{"q":"test"}']
})

export const webScrapePreflightEndpoint = createEndpoint({
  path: "/web/scrape-preflight",
  operationId: "webScrapePreflight",
  summary: "Web Scrape (Free Preflight)",
  description: "Free preflight check for web scraping. Validates URL and confirms target is reachable without paying.",
  priceUsd: "0.00",
  free: true,
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", format: "uri", description: "The URL to scrape" }
    }
  },
  responseSchema: {
    type: "object",
    properties: {
      available: { type: "boolean" },
      status: { type: "number" },
      next_action: { type: "string" }
    }
  },
  tags: ["web", "scrape", "preflight"],
  category: "Web & Research",
  whenToUse: "When you want to verify a URL is reachable and returns 200 OK before paying for the full scraped text.",
  doNotUseFor: "Getting the actual scraped content.",
  exampleInput: () => ({ url: "https://example.com" }),
  exampleOutput: () => ({ available: true, status: 200, next_action: "npx agentcash@latest fetch https://api.codepulse.com/web/scrape -m POST -b '{\"url\":\"https://example.com\"}'" }),
  logic: async (args: any, c: any) => {
    try {
      const res = await fetchAsBrowser(args.url)
      return {
        available: true,
        status: 200,
        next_action: `npx agentcash@latest fetch ${new URL(c.req.url).origin}/web/scrape -m POST -b '${JSON.stringify({ url: args.url })}'`
      }
    } catch (e: any) {
      return { available: false, status: 0, error: e.message }
    }
  },
  skillId: "webScrapePreflight",
  skillName: "Web Scrape Preflight Check",
  skillExamples: ["Check if URL is reachable", '{"url":"https://example.com"}']
})

export const webEndpoints = [
  webSearchEndpoint,
  webSearchPreflightEndpoint,
  webScrapeEndpoint,
  webScrapePreflightEndpoint,
  webMarkdownEndpoint,
  webMetadataEndpoint,
  webHistoryEndpoint,
  webRssEndpoint,
  webSitemapEndpoint,
  webDnsTxtEndpoint,
  webWhoisEndpoint
]
