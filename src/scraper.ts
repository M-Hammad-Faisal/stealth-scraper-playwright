import { chromium } from 'patchright'
import type { Browser, Page } from 'patchright'
import type { BookSummary, BookDetail, ScrapeResult } from './types.js'
import { getStealthConfig, applyStealthScripts } from './stealth.js'
import { shortDelay, longDelay } from './utils/delay.js'
import { logger } from './utils/logger.js'

const RATING_WORDS: Record<string, number> = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
}

export class BookScraper {
  private browser: Browser | null = null
  private page: Page | null = null
  private readonly BASE_URL = 'https://books.toscrape.com'
  private readonly PAGES_TO_SCRAPE = 3

  async init(): Promise<void> {
    const config = getStealthConfig()
    logger.info('Launching browser with stealth configuration...')

    this.browser = await chromium.launch({
      headless: config.headless,
      args: config.args,
    })

    const context = await this.browser.newContext({
      viewport: config.viewport,
      userAgent: config.userAgent,
    })

    this.page = await context.newPage()
    await applyStealthScripts(this.page)

    logger.success('Browser launched and stealth overrides injected')
  }

  async scrape(): Promise<ScrapeResult> {
    if (!this.page) {
      throw new Error('Scraper not initialized — call init() first')
    }

    const startTime = Date.now()
    const allBooks: BookDetail[] = []
    let detectionEvaded = true
    let pagesScraped = 0

    for (let pageNum = 1; pageNum <= this.PAGES_TO_SCRAPE; pageNum++) {
      const url = pageNum === 1 ? this.BASE_URL : `${this.BASE_URL}/catalogue/page-${pageNum}.html`

      logger.info(`[Page ${pageNum}/${this.PAGES_TO_SCRAPE}] Scraping list...`)

      try {
        await this.navigateWithRetry(url)
        const summaries = await this.scrapeListPage()
        pagesScraped++

        logger.success(`[Page ${pageNum}/${this.PAGES_TO_SCRAPE}] Found ${summaries.length} books`)

        for (let i = 0; i < summaries.length; i++) {
          const summary = summaries[i]
          if (!summary) continue

          logger.debug(
            `[Book ${i + 1}/${summaries.length}] Fetching detail: ${summary.title.substring(0, 50)}`,
          )

          try {
            const detail = await this.scrapeBookDetail(summary)
            allBooks.push(detail)
          } catch (err) {
            logger.warn(`Failed to scrape detail for "${summary.title}": ${String(err)}`)
            detectionEvaded = false
          }

          if (i < summaries.length - 1) {
            await shortDelay()
          }
        }
      } catch (err) {
        detectionEvaded = false
        logger.error(`Failed to scrape page ${pageNum}: ${String(err)}`)
      }

      if (pageNum < this.PAGES_TO_SCRAPE) {
        await longDelay()
      }
    }

    return {
      success: allBooks.length > 0,
      totalBooks: allBooks.length,
      pagesScraped,
      books: allBooks,
      scrapedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      detectionEvaded,
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
      this.page = null
      logger.info('Browser closed')
    }
  }

  private async scrapeListPage(): Promise<BookSummary[]> {
    if (!this.page) throw new Error('Page is not available')

    const rawBooks = await this.page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article.product_pod'))

      return articles.map((article: Element) => {
        const titleEl = article.querySelector('h3 > a')
        const priceEl = article.querySelector('.price_color')
        const ratingEl = article.querySelector('.star-rating')
        const availEl = article.querySelector('.availability')

        const title = titleEl?.getAttribute('title') ?? titleEl?.textContent?.trim() ?? 'N/A'
        const price = priceEl?.textContent?.trim() ?? 'N/A'

        const ratingClass = ratingEl?.className ?? ''
        const ratingWord = ratingClass.split(' ').find((c: string) => c !== 'star-rating') ?? ''

        const availability = availEl?.textContent?.trim() ?? 'N/A'

        const href = titleEl?.getAttribute('href') ?? ''

        return { title, price, ratingWord, availability, href }
      })
    })

    return rawBooks.map((raw) => ({
      title: raw.title,
      price: raw.price,
      rating: this.convertRatingWordToNumber(raw.ratingWord),
      availability: raw.availability,
      detailUrl: this.resolveBookUrl(raw.href),
    }))
  }

  private async scrapeBookDetail(summary: BookSummary): Promise<BookDetail> {
    if (!this.page) throw new Error('Page is not available')

    await this.navigateWithRetry(summary.detailUrl)

    const raw = await this.page.evaluate(() => {
      const title = document.querySelector('h1')?.textContent?.trim() ?? 'N/A'
      const price = document.querySelector('.price_color')?.textContent?.trim() ?? 'N/A'

      const descEl = document.querySelector('#product_description + p')
      const description = descEl?.textContent?.trim() ?? 'No description available'

      const ratingEl = document.querySelector('p.star-rating')
      const ratingClass = ratingEl?.className ?? ''
      const ratingWord = ratingClass.split(' ').find((c: string) => c !== 'star-rating') ?? ''

      const tableRows = Array.from(document.querySelectorAll('table.table-striped tr'))
      const tableData: Record<string, string> = {}
      for (const row of tableRows) {
        const th = row.querySelector('th')?.textContent?.trim() ?? ''
        const td = row.querySelector('td')?.textContent?.trim() ?? ''
        if (th) {
          tableData[th] = td
        }
      }

      return { title, price, description, ratingWord, tableData }
    })

    const availStr = raw.tableData['Availability'] ?? 'N/A'
    const stockMatch = /\((\d+)\s+available\)/.exec(availStr)
    const inStock = stockMatch?.[1] ? parseInt(stockMatch[1], 10) : 0

    const reviewsStr = raw.tableData['Number of reviews'] ?? '0'

    return {
      title: raw.title,
      price: raw.price,
      priceExclTax: raw.tableData['Price (excl. tax)'] ?? 'N/A',
      priceInclTax: raw.tableData['Price (incl. tax)'] ?? 'N/A',
      tax: raw.tableData['Tax'] ?? 'N/A',
      rating: this.convertRatingWordToNumber(raw.ratingWord),
      availability: availStr,
      inStock,
      description: raw.description,
      upc: raw.tableData['UPC'] ?? 'N/A',
      productType: raw.tableData['Product Type'] ?? 'N/A',
      numberOfReviews: parseInt(reviewsStr, 10) || 0,
      detailUrl: summary.detailUrl,
    }
  }

  private async navigateWithRetry(url: string, retries = 3): Promise<void> {
    if (!this.page) throw new Error('Page is not available')

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        logger.warn(`Navigation attempt ${attempt}/${retries} failed: ${lastError.message}`)
        if (attempt < retries) {
          await shortDelay()
        }
      }
    }

    throw new Error(
      `All ${retries} navigation attempts failed for ${url}: ${lastError?.message ?? 'unknown'}`,
    )
  }

  private convertRatingWordToNumber(word: string): number {
    return RATING_WORDS[word] ?? 0
  }

  private resolveBookUrl(href: string): string {
    if (!href) return 'N/A'
    if (href.startsWith('http')) return href
    if (href.startsWith('catalogue/')) {
      return `${this.BASE_URL}/${href}`
    }
    // Relative paths like "../book-slug/index.html" from pages 2+
    const cleaned = href.replace(/^(\.\.\/)+/, '')
    let detailUrl = `${this.BASE_URL}/${cleaned}`

    if (!detailUrl.includes('/catalogue/')) {
      detailUrl = detailUrl.replace(
        'https://books.toscrape.com/',
        'https://books.toscrape.com/catalogue/',
      )
    }

    return detailUrl
  }
}
