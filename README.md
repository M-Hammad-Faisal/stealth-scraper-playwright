# stealth-scraper-playwright

![Node.js](https://img.shields.io/badge/Node.js-≥24-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-1.58-2EAD33?logo=playwright&logoColor=white)
![Patchright](https://img.shields.io/badge/Patchright-1.58-blueviolet)
![License](https://img.shields.io/badge/License-MIT-blue.svg)
![CI](https://img.shields.io/github/actions/workflow/status/M-Hammad-Faisal/stealth-scraper-playwright/scrape.yml?branch=master&label=CI&logo=githubactions&logoColor=white)

A stealth web scraper that navigates anti-detection systems using Patchright's CDP-patched Chromium — extracting nested detail-page data from every book on [books.toscrape.com](https://books.toscrape.com).

---

## What This Is

This is a production-grade stealth scraping pipeline built on Patchright and Playwright, demonstrating the exact anti-detection techniques used to bypass commercial bot-detection systems like Cloudflare, DataDome, and PerimeterX. It doesn't just pull listing data — it navigates into every book's detail page to extract UPC, tax breakdown, stock count, and full descriptions. The codebase is structured how a real scraping service would be: typed schemas, retry logic, human-like timing, clean separation of stealth configuration from extraction logic, and a CI pipeline that runs the scraper on a weekly schedule.

---

## Why Patchright Over Vanilla Playwright

### The Problem

When Playwright drives Chrome over CDP (Chrome DevTools Protocol), the browser leaks automation signals at multiple layers:

- **JavaScript level:** `navigator.webdriver` is `true`, `navigator.plugins` is empty, `window.chrome.runtime` is absent.
- **CDP level:** Playwright calls `Runtime.enable` on every new context, which is detectable via timing side-channels and service worker introspection.
- **Binary level:** Internal variables like `window.cdc_adoQpoasnfa76pfcZLmcfl_Array` are injected by the ChromeDriver/CDP integration layer. These cannot be removed with `addInitScript`.
- **TLS level:** The TLS fingerprint of a CDP-controlled Chrome differs from a user-launched instance due to modified cipher suite ordering.

You can patch the JS layer with `page.addInitScript()`, but CDP and binary signals survive any amount of JavaScript injection.

### What Patchright Does

[Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) forks Playwright and applies patches to the Chromium binary itself:

- **CDP channel masking** — rewrites the internal CDP identifier so automation is not detectable at the protocol level.
- **`Runtime.enable` suppression** — prevents the CDP call that advanced detection systems monitor.
- **`cdc_*` variable removal** — strips ChromeDriver artifacts from the binary before launch.
- **Consistent TLS fingerprint** — the patched binary presents the same TLS profile as a user-launched Chrome.

### Comparison

| Tool | Ease of Use | Detection Resistance | Maintenance | Production Readiness |
|---|---|---|---|---|
| **Vanilla Playwright** | Excellent | Low — fails any serious fingerprinting | Official Chromium team | Not for protected sites |
| **playwright-extra + stealth** | Good | Medium — JS patches only, CDP leaks remain | Community plugin | Moderate protection sites |
| **Puppeteer-stealth** | Good | Medium — same JS-only limitation | Less active, Puppeteer-only | Legacy codebases |
| **Patchright** | Excellent (Playwright API) | High — binary + CDP + JS patches combined | Active fork, tracks Playwright releases | Advanced protection sites |

This repo uses Patchright as the primary driver. Swapping to vanilla Playwright requires changing one import line — useful for sites with no detection.

---

## Anti-Detection Techniques

| Technique | Signal It Hides | Detection System Defeated |
|---|---|---|
| `navigator.webdriver` → `undefined` | JS automation flag (`true` in all CDP browsers) | Cloudflare JS Challenge, Akamai Bot Manager, PerimeterX |
| `--disable-blink-features=AutomationControlled` | Chrome's internal automation feature flag | Chrome-specific headless checks |
| `navigator.plugins` → `[1, 2, 3]` | Empty plugin list (zero plugins = headless) | FingerprintJS, DataDome, Kasada |
| `window.chrome.runtime` mock | Absent Chrome API object in headless mode | Scripts checking `typeof chrome.runtime` |
| `Notification.permission` → `'default'` | Headless returns `'denied'` by default | Permission-based fingerprinting |
| `screen.colorDepth` → `24` | Non-standard depth in headless environments | Canvas/screen fingerprinting |
| Realistic viewport (1920×1080) | Default headless is 800×600 | Dimension-based bot detection |
| Human-like random delays (300ms–6s) | Constant timing between requests | Behavioral analysis, rate limiting |
| Chrome 131 Windows User-Agent | `"HeadlessChrome"` in default UA string | Any UA-string filter |

---

## Data Extracted

The scraper navigates to each book's detail page and extracts the full product information table. Every `BookDetail` object contains:

| Field | Type | Source |
|---|---|---|
| `title` | `string` | `<h1>` on detail page |
| `price` | `string` | `.price_color` element |
| `priceExclTax` | `string` | Product info table: "Price (excl. tax)" |
| `priceInclTax` | `string` | Product info table: "Price (incl. tax)" |
| `tax` | `string` | Product info table: "Tax" |
| `rating` | `number` | Star rating class → numeric (1–5) |
| `availability` | `string` | Product info table: "Availability" |
| `inStock` | `number` | Parsed from "In stock (X available)" |
| `description` | `string` | `#product_description + p` |
| `upc` | `string` | Product info table: "UPC" |
| `productType` | `string` | Product info table: "Product Type" |
| `numberOfReviews` | `number` | Product info table: "Number of reviews" |
| `detailUrl` | `string` | Full URL to the product page |

### Example `BookDetail`

```json
{
  "title": "A Light in the Attic",
  "price": "£51.77",
  "priceExclTax": "£51.77",
  "priceInclTax": "£51.77",
  "tax": "£0.00",
  "rating": 3,
  "availability": "In stock (22 available)",
  "inStock": 22,
  "description": "It's hard to imagine a world without A Light in the Attic...",
  "upc": "a897fe39b1053632",
  "productType": "Books",
  "numberOfReviews": 0,
  "detailUrl": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
}
```

---

## Getting Started

```bash
git clone https://github.com/M-Hammad-Faisal/stealth-scraper-playwright
cd stealth-scraper-playwright
nvm use
npm install
npx playwright install chromium
npx patchright install chromium
npm run scrape
```

Results are written to `output/results.json` with a timestamped backup.

---

## Output Format

`output/results.json`:

```json
{
  "success": true,
  "totalBooks": 60,
  "pagesScraped": 3,
  "scrapedAt": "2025-01-15T10:23:41.123Z",
  "durationMs": 45230,
  "detectionEvaded": true,
  "books": [
    {
      "title": "A Light in the Attic",
      "price": "£51.77",
      "priceExclTax": "£51.77",
      "priceInclTax": "£51.77",
      "tax": "£0.00",
      "rating": 3,
      "availability": "In stock (22 available)",
      "inStock": 22,
      "description": "It's hard to imagine a world without A Light in the Attic...",
      "upc": "a897fe39b1053632",
      "productType": "Books",
      "numberOfReviews": 0,
      "detailUrl": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
    }
  ]
}
```

---

## Available Scripts

| Script | Command | Description |
|---|---|---|
| `scrape` | `npm run scrape` | Run the stealth scraper end-to-end |
| `build` | `npm run build` | Compile TypeScript to `dist/` |
| `lint` | `npm run lint` | Check code with ESLint v9 |
| `lint:fix` | `npm run lint:fix` | Auto-fix linting issues |
| `format` | `npm run format` | Format code with Prettier |
| `format:check` | `npm run format:check` | Check formatting without writing |
| `typecheck` | `npm run typecheck` | Run TypeScript compiler in check mode |

---

## Project Structure

```
stealth-scraper-playwright/
├── README.md                        # Project documentation
├── package.json                     # Dependencies, scripts, metadata
├── tsconfig.json                    # TypeScript strict config (ES2022, ESNext modules)
├── eslint.config.js                 # ESLint v9 flat config with type-checked rules
├── .prettierrc                      # Prettier formatting rules
├── .prettierignore                  # Files excluded from formatting
├── .nvmrc                           # Node version pin (20)
├── .gitignore                       # Excludes node_modules, dist, output, env files
├── .github/
│   └── workflows/
│       └── scrape.yml               # CI: lint, typecheck, format, scrape, artifact upload
└── src/
    ├── index.ts                     # Entry point: orchestrates init → scrape → save → close
    ├── scraper.ts                   # BookScraper class: list + detail page extraction
    ├── stealth.ts                   # Launch args and init script overrides (6 techniques)
    ├── types.ts                     # All interfaces: BookSummary, BookDetail, ScrapeResult
    └── utils/
        ├── delay.ts                 # randomDelay, shortDelay, longDelay
        ├── logger.ts                # Timestamped ANSI color logger
        └── saveResults.ts           # Write results.json + timestamped backup
```

---

## CI/CD

The GitHub Actions workflow (`.github/workflows/scrape.yml`) runs on:

- **Push to `master`** — every commit triggers a full pipeline run.
- **Manual dispatch** — trigger from the Actions tab for on-demand scraping.
- **Weekly schedule** — every Monday at 08:00 UTC for fresh dataset generation.

Pipeline steps in order: checkout → Node.js setup (from `.nvmrc`) → `npm ci` → install Playwright browsers → install Patchright browsers → type check → lint → format check → run scraper → upload `output/` as artifact (retained 30 days).

---

## Tech Stack

- **[Patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright)** — CDP-patched Chromium for deep stealth
- **[Playwright](https://playwright.dev)** — Browser automation framework
- **[TypeScript 5.9](https://www.typescriptlang.org)** — Strict typing, zero `any`
- **[ESLint 9](https://eslint.org)** — Flat config with type-checked rules
- **[Prettier 3](https://prettier.io)** — Consistent code formatting
- **[Node.js 24+](https://nodejs.org)** — Runtime
- **[GitHub Actions](https://github.com/features/actions)** — CI/CD with scheduled runs and artifact storage

---

## Real-World Use Cases

- **Price monitoring** — Track competitor pricing across e-commerce catalogs on a daily/weekly schedule.
- **Lead enrichment** — Scrape business directories behind Cloudflare to extract verified contact data.
- **Competitive intelligence** — Monitor product launches, stock levels, and review counts across protected retail sites.
- **Availability tracking** — Detect restocks and inventory changes for high-demand products.
- **Dataset generation for ML** — Build labeled training datasets from structured product pages at scale.

---

## License

MIT — Muhammad Hammad Faisal
