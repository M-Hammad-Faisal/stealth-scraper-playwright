import * as fs from 'fs'
import * as path from 'path'
import type { ScrapeResult } from '../types.js'
import { logger } from './logger.js'

export function saveResults(result: ScrapeResult): void {
  const outputDir = path.resolve(process.cwd(), 'output')
  fs.mkdirSync(outputDir, { recursive: true })

  const mainPath = path.join(outputDir, 'results.json')
  const json = JSON.stringify(result, null, 2)
  fs.writeFileSync(mainPath, json, 'utf-8')
  logger.success(`Results saved to ${mainPath}`)

  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  const backupPath = path.join(outputDir, `results_${ts}.json`)
  fs.writeFileSync(backupPath, json, 'utf-8')
  logger.success(`Backup saved to ${backupPath}`)
}
