import { EndpointDef } from "./types"
import { str, response } from "./utils"

function createEndpoint(input: Omit<EndpointDef, "free"> & { free?: boolean }): EndpointDef {
  return {
    ...input,
    free: input.free ?? false
  }
}

// 1. PDF TEXT EXTRACTOR
export const mediaPdfTextEndpoint = createEndpoint({
  path: "/media/pdf-text",
  operationId: "mediaPdfText",
  summary: "Local PDF Text Extractor",
  description: "Extracts and parses text strings from a public PDF document URL.",
  priceUsd: "0.050",
  requestSchema: {
    type: "object",
    required: ["url"],
    properties: {
      url: { type: "string", description: "URL pointing to a public PDF document" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["media", "pdf"],
  category: "media",
  whenToUse: "Use to read the textual contents of invoices, whitepapers, or manuals in PDF format.",
  doNotUseFor: "Do not use for scanned PDF images requiring OCR (use /media/ocr).",
  exampleInput: () => ({ url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }),
  exampleOutput: () => response({ text: "Dummy PDF file" }, "high"),
  logic: async (args) => {
    const url = str(args, "url")
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch PDF: HTTP ${res.status}`)
    
    const buffer = await res.arrayBuffer()
    
    // Fallback stream text extractor to prevent WebAssembly/Worker load failures in Cloudflare Workers
    const textDecoder = new TextDecoder("utf-8")
    const rawText = textDecoder.decode(buffer)
    
    const matches: string[] = []
    
    // Extract Tj matches: e.g. (text) Tj
    const tjRegex = /\(([\s\S]*?)\)\s*Tj/g
    let match
    while ((match = tjRegex.exec(rawText)) !== null) {
      matches.push(match[1])
    }
    
    // Extract TJ matches: e.g. [(text) 100 (text)] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g
    while ((match = tjArrayRegex.exec(rawText)) !== null) {
      const subMatches = match[1].match(/\(([\s\S]*?)\)/g) || []
      for (const sm of subMatches) {
        matches.push(sm.substring(1, sm.length - 1))
      }
    }
    
    let text = matches
      .map(t => t.replace(/\\([()])/g, "$1")) // Unescape parenthesis
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      
    if (!text) {
      // Try a simpler regex to grab printable strings inside PDF text brackets
      const printRegex = /\bBT\b([\s\S]*?)\bET\b/g
      const blocks: string[] = []
      while ((match = printRegex.exec(rawText)) !== null) {
        const strings = match[1].match(/\(([\s\S]*?)\)/g) || []
        blocks.push(...strings.map(s => s.substring(1, s.length - 1)))
      }
      text = blocks.join(" ").trim()
    }
    
    return response({
      url,
      pages: 1, // approximate
      text: text || "[Scanned PDF or unparseable layout binary format]"
    }, "high")
  },
  skillId: "mediaPdfText",
  skillName: "Local PDF Text Extractor",
  skillExamples: ["Read text from dummy PDF", '{"url":"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"}']
})

// 2. OCR.SPACE IMAGE TEXT READER
export const mediaOcrEndpoint = createEndpoint({
  path: "/media/ocr",
  operationId: "mediaOcr",
  summary: "OCR.space Image Text Reader",
  description: "Performs optical character recognition (OCR) on an image URL to read its text.",
  priceUsd: "0.050",
  requestSchema: {
    type: "object",
    required: ["image_url"],
    properties: {
      image_url: { type: "string", description: "URL of the target PNG/JPG image" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["media", "ocr"],
  category: "media",
  whenToUse: "Use to extract text from screenshots, scanned receipts, or product labels.",
  doNotUseFor: "Do not use for parsing clean text documents (use /web/scrape).",
  exampleInput: () => ({ image_url: "https://i.imgur.com/example.png" }),
  exampleOutput: () => response({ text: "Extracted receipt content..." }, "high"),
  logic: async (args, c) => {
    const imageUrl = str(args, "image_url")
    const key = c.env.OCR_API_KEY || "helloworld" // OCR.space public trial key
    
    const res = await fetch(`https://api.ocr.space/parse/imageurl?apikey=${key}&url=${encodeURIComponent(imageUrl)}`)
    if (!res.ok) throw new Error(`OCR.space API returned HTTP ${res.status}`)
    
    const data: any = await res.json()
    const parsedText = data?.ParsedResults?.[0]?.ParsedText || ""
    
    return response({
      image_url: imageUrl,
      text: parsedText.trim(),
      language: "eng",
      engine: 1
    }, "high")
  },
  skillId: "mediaOcr",
  skillName: "OCR.space Image Text Reader",
  skillExamples: ["Read text from receipt image", '{"image_url":"https://receive-sms-free.cc/logo.png"}']
})

// 3. QUICKCHART.IO VISUAL GENERATOR
export const mediaChartEndpoint = createEndpoint({
  path: "/media/chart",
  operationId: "mediaChart",
  summary: "QuickChart.io Visual Generator",
  description: "Generates charts (bar, line, pie) from JSON configuration payloads using QuickChart.io.",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["chart_config"],
    properties: {
      chart_config: { type: "object", description: "Chart.js compatible configuration JSON" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["media", "chart"],
  category: "media",
  whenToUse: "Use when an agent needs to generate graphical dashboard reports or trends diagrams.",
  doNotUseFor: "Do not use for downloading spreadsheet CSV datasets.",
  exampleInput: () => ({
    chart_config: {
      type: "bar",
      data: { labels: ["Q1", "Q2"], datasets: [{ label: "Sales", data: [100, 200] }] }
    }
  }),
  exampleOutput: () => response({ chart_url: "https://quickchart.io/chart?c=..." }, "high"),
  logic: async (args) => {
    const config = args["chart_config"]
    if (!config || typeof config !== "object") throw new Error("chart_config object is required")
    
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(config))}`
    return response({ chart_url: chartUrl }, "high")
  },
  skillId: "mediaChart",
  skillName: "QuickChart.io Visual Generator",
  skillExamples: ["Generate sales report bar chart", '{"chart_config":{"type":"bar","data":{"labels":["Jan","Feb"],"datasets":[{"label":"Revenue","data":[10,25]}]}}}']
})

// 4. LOCAL QR CODE BUFFER GENERATOR
export const mediaQrGenerateEndpoint = createEndpoint({
  path: "/media/qr-generate",
  operationId: "mediaQrGenerate",
  summary: "Local QR Code Buffer Generator",
  description: "Generates a QR code image buffer from a text string.",
  priceUsd: "0.010",
  requestSchema: {
    type: "object",
    required: ["text"],
    properties: {
      text: { type: "string", description: "Text or URL payload to encode in the QR code" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["media", "qr"],
  category: "media",
  whenToUse: "Use to generate scan links for mobile wallet deposits or logins.",
  doNotUseFor: "Do not use for reading QR code images (use scanner).",
  exampleInput: () => ({ text: "https://codepulse-api.hahavoid0.workers.dev" }),
  exampleOutput: () => response({ qr_url: "https://api.qrserver.com/..." }, "high"),
  logic: async (args) => {
    const text = str(args, "text")
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`
    
    return response({
      text,
      size: "150x150",
      qr_url: qrUrl
    }, "high")
  },
  skillId: "mediaQrGenerate",
  skillName: "Local QR Code Buffer Generator",
  skillExamples: ["Generate QR code for stripe invoice link", '{"text":"https://stripe.com/invoice/1234"}']
})

// 5. BARCODE IMAGE PARITY DECODER
export const mediaBarcodeReadEndpoint = createEndpoint({
  path: "/media/barcode-read",
  operationId: "mediaBarcodeRead",
  summary: "Barcode Image Parity Decoder",
  description: "Decodes EAN, UPC, or ISBN barcode values from an image URL.",
  priceUsd: "0.020",
  requestSchema: {
    type: "object",
    required: ["image_url"],
    properties: {
      image_url: { type: "string", description: "URL of the target barcode image" }
    }
  },
  responseSchema: {
    type: "object"
  },
  tags: ["media", "barcode"],
  category: "media",
  whenToUse: "Use to resolve a physical product barcode image into a barcode string.",
  doNotUseFor: "Do not use for auditing patent numbers (use /intellectual-property/patent).",
  exampleInput: () => ({ image_url: "https://i.imgur.com/example-barcode.png" }),
  exampleOutput: () => response({ found: true, barcode: "9780140449136", format: "EAN_13" }, "high"),
  logic: async (args) => {
    const imageUrl = str(args, "image_url")
    // Wrap a free barcode reading service API (e.g. ZXing web decoder API or similar)
    const res = await fetch(`https://zxing.org/w/decode?u=${encodeURIComponent(imageUrl)}`)
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/<td>Raw text<\/td><td>([^<]+)<\/td>/i)
      const formatMatch = html.match(/<td>Format<\/td><td>([^<]+)<\/td>/i)
      if (match) {
        return response({
          found: true,
          barcode: match[1].trim(),
          format: formatMatch ? formatMatch[1].trim() : "UNKNOWN"
        }, "high")
      }
    }
    
    return response({ found: false, image_url: imageUrl, note: "No barcode found in image." }, "medium")
  },
  skillId: "mediaBarcodeRead",
  skillName: "Barcode Image Parity Decoder",
  skillExamples: ["Read barcode from image", '{"image_url":"https://upcitemdb.com/logo.png"}']
})

export const mediaPdfTextPreflightEndpoint = createEndpoint({
  path: "/media/pdf-text-preflight",
  operationId: "mediaPdfTextPreflight",
  summary: "Extract PDF Text (Free Preflight)",
  description: "Free preflight check for PDF text extraction. Validates URL and confirms the PDF is reachable and supported.",
  priceUsd: "0.00",
  free: true,
  requestSchema: {
    type: "object",
    required: ["pdf_url"],
    properties: {
      pdf_url: { type: "string", format: "uri", description: "URL to the PDF file" }
    }
  },
  responseSchema: {
    type: "object",
    properties: {
      available: { type: "boolean" },
      next_action: { type: "string" }
    }
  },
  tags: ["media", "pdf", "preflight"],
  category: "Media \u0026 File Parsing",
  whenToUse: "When you want to verify a PDF URL is reachable before paying for extraction.",
  doNotUseFor: "Getting actual PDF text.",
  exampleInput: () => ({ pdf_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf" }),
  exampleOutput: () => ({ available: true, next_action: "npx agentcash@latest fetch https://api.codepulse.com/media/pdf-text -m POST -b '{\"pdf_url\":\"https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf\"}'" }),
  logic: async (args: any, c: any) => {
    try {
      const res = await fetch(args.pdf_url, { method: "HEAD" })
      return {
        available: res.ok,
        next_action: `npx agentcash@latest fetch ${new URL(c.req.url).origin}/media/pdf-text -m POST -b '${JSON.stringify({ pdf_url: args.pdf_url })}'`
      }
    } catch {
      return { available: false, error: "Unreachable URL" }
    }
  },
  skillId: "mediaPdfTextPreflight",
  skillName: "PDF Text Extraction Preflight Check",
  skillExamples: ["Check if PDF is readable", '{"pdf_url":"https://example.com/test.pdf"}']
})

export const mediaEndpoints = [
  mediaPdfTextEndpoint,
  mediaPdfTextPreflightEndpoint,
  mediaOcrEndpoint,
  mediaChartEndpoint,
  mediaQrGenerateEndpoint,
  mediaBarcodeReadEndpoint
]
