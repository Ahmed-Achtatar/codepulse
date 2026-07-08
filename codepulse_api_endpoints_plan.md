# CodePulse API: Project Plan & 53 Free Endpoints Checklist

This document outlines the architecture, directory structure, and endpoint checklist for **CodePulse API**—a pay-per-call, agent-first utility suite featuring **exactly 53 endpoints** that are 100% free to host and run on Cloudflare Workers.

---

## 1. Project Directory Structure

Your new project folder should be structured as follows:

```
codepulse-api/
├── .dev.vars                  # Local dev secrets (CDP_API_KEY_ID, WALLET_ADDRESS)
├── package.json               # Node dependencies
├── tsconfig.json              # TypeScript config
├── wrangler.toml              # Cloudflare Worker config with KV binding
├── src/
│   ├── index.ts               # Main worker entrypoint & Hono routing
│   ├── html.ts                # Landing page template
│   ├── endpoints/
│   │   ├── registry.ts        # Exports endpoint catalog arrays
│   │   ├── types.ts           # Shared TypeScript types
│   │   ├── utils.ts           # Schema validation helpers
│   │   ├── web.ts             # Web scraping endpoints (9 routes)
│   │   ├── identity.ts        # Webhooks & disposable mailboxes (10 routes)
│   │   ├── brand.ts           # Brand & domain intelligence (10 routes)
│   │   ├── package.ts         # Dependency & registry lookups (10 routes)
│   │   ├── security.ts        # Cryptography & security checks (6 routes)
│   │   ├── media.ts           # PDF, OCR, and chart utilities (5 routes)
│   │   └── agent.ts           # Agent capabilities & feedback (3 routes)
```

---

## 2. Dependencies (`package.json`)

To run these endpoints locally in the worker without paid external service dependencies, install these standard packages:

```json
{
  "name": "codepulse-api",
  "version": "1.0.0",
  "main": "src/index.ts",
  "dependencies": {
    "hono": "^4.0.0",
    "@x402/hono": "^1.0.0",
    "@x402/core": "^1.0.0",
    "turndown": "^7.1.3",
    "pdfjs-dist": "^4.0.0",
    "qrcode": "^1.5.3",
    "html-to-text": "^9.3.0"
  }
}
```

---

## 3. Endpoints Checklist

### Category 1: Free Web & Scraper Utilities (9 Endpoints)
- [ ] `POST /web/search` — Performs web searches using a free DuckDuckGo HTML parser.
- [ ] `POST /web/scrape` — Extracts raw text from a website using `html-to-text` locally.
- [ ] `POST /web/markdown` — Downloads HTML and compiles it to markdown locally using `turndown`.
- [ ] `POST /web/metadata` — Extracts OpenGraph tags, descriptions, and page headers.
- [ ] `POST /web/history` — Queries historical website snapshots from the free Archive.org API.
- [ ] `POST /web/rss` — Parses any public RSS/Atom XML feed URL into structured JSON.
- [ ] `POST /web/sitemap` — Resolves and lists all URLs inside a sitemap XML.
- [ ] `POST /web/dns-txt` — Fetches domain TXT, MX, and CAA records via Cloudflare DoH.
- [ ] `POST /web/whois` — Queries global registrar metadata via the public RDAP protocol.

### Category 2: Temporary Webhooks & Mailboxes (10 Endpoints)
- [ ] `POST /mailbox/create` — Generates a disposable inbox address using the free `1secmail.com` API.
- [ ] `POST /mailbox/messages` — Polls the disposable inbox for verification emails and OTP codes.
- [ ] `POST /phone/temp-sms` — Lists temporary public SMS phone numbers available for registration.
- [ ] `POST /phone/messages` — Scrapes recent messages to retrieve SMS OTP verification codes.
- [ ] `POST /webhook/listen` — Generates a temporary webhook URL pointing to your Worker's KV storage.
- [ ] `POST /webhook/poll` — Retrieves webhook callback logs received by the agent.
- [ ] `POST /notify/telegram` — Dispatches message notifications using the free Telegram Bot API.
- [ ] `POST /notify/slack` — Posts alerts to a developer channel via Slack webhooks.
- [ ] `POST /notify/discord` — Relays notification cards to a Discord webhook.
- [ ] `POST /notify/email` — Sends email alerts using the Resend free tier (3,000 emails/month).

### Category 3: Brand & Domain Intelligence (10 Endpoints)
- [ ] `POST /domain/check` — Checks domain registration availability by checking SOA DNS.
- [ ] `POST /domain/social` — Scans handle availability across 15+ social platforms (GitHub, Twitter, etc.).
- [ ] `POST /brand/palette` — Parses CSS classes on a target website to resolve official brand hex codes.
- [ ] `POST /brand/logo` — Extracts high-resolution logo links using Clearbit's free logo API.
- [ ] `POST /network/ssl-expiry` — Checks domain certificate logs on CertSpotter for SSL expiry dates.
- [ ] `POST /network/dnssec` — Verifies DNSSEC signatures on a domain via DoH checks.
- [ ] `POST /intellectual-property/patent` — Searches official USPTO patent database records.
- [ ] `POST /intellectual-property/trademark` — Scrapes public trademark indexes for name availability conflict checks.
- [ ] `POST /company/sec` — Queries recent SEC EDGAR filings for a US business.
- [ ] `POST /company/address` — Resolves official company addresses from SEC EDGAR registry records.

### Category 4: Dependency Registries & Package Info (10 Endpoints)
- [ ] `POST /registry/npm` — Retrieves registry metadata, dependencies, and versions from NPM.
- [ ] `POST /registry/pypi` — Fetches package descriptions and release structures from PyPI.
- [ ] `POST /registry/crates` — Looks up Rust crate downloads and details from Crates.io.
- [ ] `POST /registry/golang` — Reads package configurations from proxy.golang.org.
- [ ] `POST /registry/packagist` — Resolves PHP Composer library details from Packagist.
- [ ] `POST /registry/maven` — Queries Java package metrics from Maven Central.
- [ ] `POST /registry/cdnjs` — Finds public CDN file paths hosted on CDNJS.
- [ ] `POST /registry/github/repo` — Reads star counts, issue counts, and descriptions from GitHub.
- [ ] `POST /registry/github/release` — Retrieves release notes for the latest tag.
- [ ] `POST /registry/github/license` — Scrapes repo license configurations.

### Category 5: Security & Cryptography Auditing (6 Endpoints)
- [ ] `POST /security/secret-scan` — Runs regex audits on text to find leaked private keys or API keys.
- [ ] `POST /security/cve` — Checks library names and versions against OSV.dev databases.
- [ ] `POST /security/ip-abuse` — Queries IP reputation via the free tier of AbuseIPDB.
- [ ] `POST /security/hash-check` — Looks up file threat signatures in public hash libraries.
- [ ] `POST /security/pwned-password` — Checks password hash leaks via HaveIBeenPwned API.
- [ ] `POST /security/http-headers` — Verifies the presence of security headers (CSP, HSTS) for a URL.

### Category 6: Document & Media Processing (5 Endpoints)
- [ ] `POST /media/pdf-text` — Parses and extracts text strings from a PDF URL locally using `pdfjs`.
- [ ] `POST /media/ocr` — Performs image text extraction using the free tier of OCR.space.
- [ ] `POST /media/chart` — Generates visual dashboard charts from JSON data using QuickChart.io.
- [ ] `POST /media/qr-generate` — Generates a QR code image buffer locally from a text string.
- [ ] `POST /media/barcode-read` — Decodes UPC/ISBN barcode values from an image.

### Category 7: Agent Discovery & Support (3 Endpoints)
- [ ] `POST /agent/request-data` — Logs an agent's request for new live data sources.
- [ ] `POST /agent/feedback` — Accepts structured feedback about broken endpoints or stale data.
- [ ] `POST /agent/discovery-broadcast` — Broadcasts an agent's capabilities to a public registry KV store.
