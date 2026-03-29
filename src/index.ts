import { BookScraper } from './scraper.js'
import { saveResults } from './utils/saveResults.js'
import { logger } from './utils/logger.js'

async function main(): Promise<void> {
  const scraper = new BookScraper()

  try {
    logger.info('Starting stealth scraper...')
    await scraper.init()
    const result = await scraper.scrape()
    saveResults(result)

    logger.success(`\nCompleted. ${result.totalBooks} books scraped in ${result.durationMs}ms`)

    console.table(
      result.books.slice(0, 5).map((b) => ({
        title: b.title.substring(0, 40),
        price: b.price,
        rating: b.rating,
        inStock: b.inStock,
      })),
    )

    process.exit(0)
  } catch (error) {
    logger.error(`Scraper failed: ${String(error)}`)
    process.exit(1)
  } finally {
    await scraper.close()
  }
}

void main()
