export interface BookSummary {
  title: string
  price: string
  rating: number
  availability: string
  detailUrl: string
}

export interface BookDetail {
  title: string
  price: string
  priceExclTax: string
  priceInclTax: string
  tax: string
  rating: number
  availability: string
  inStock: number
  description: string
  upc: string
  productType: string
  numberOfReviews: number
  detailUrl: string
}

export interface ScrapeResult {
  success: boolean
  totalBooks: number
  pagesScraped: number
  books: BookDetail[]
  scrapedAt: string
  durationMs: number
  detectionEvaded: boolean
}

export interface StealthConfig {
  headless: boolean
  userAgent: string
  viewport: { width: number; height: number }
  args: string[]
}
