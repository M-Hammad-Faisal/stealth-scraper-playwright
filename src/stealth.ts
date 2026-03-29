/**
 * Stealth configuration for Patchright/Playwright browser launch.
 *
 * Techniques applied:
 *
 * 1. --disable-blink-features=AutomationControlled
 *    Removes Chrome's internal automation flag. Detection scripts check
 *    navigator.userActivation and internal flags that surface when this
 *    Blink feature is enabled.
 *
 * 2. navigator.webdriver → undefined
 *    CDP-driven browsers set this to true by default. Every major bot
 *    filter (Cloudflare, DataDome, Akamai) checks this property.
 *
 * 3. navigator.languages → ['en-US', 'en']
 *    Headless environments report empty or single-language arrays.
 *    FingerprintJS scores this signal heavily.
 *
 * 4. navigator.plugins.length → 3
 *    Headless Chrome has zero plugins. Real Chrome ships with PDF viewer,
 *    Chrome PDF Plugin, and Native Client.
 *
 * 5. window.chrome.runtime presence
 *    Absent in headless mode. Detection scripts check for its existence.
 *
 * 6. Notification.permission → 'default'
 *    Headless returns 'denied'. Permission-based fingerprinting uses this.
 *
 * 7. screen.colorDepth → 24
 *    Non-standard color depth in headless environments leaks through
 *    screen fingerprinting checks.
 *
 * 8. Realistic viewport (1920×1080) + User-Agent (Windows Chrome 131)
 *    Default headless is 800×600 with "HeadlessChrome" in the UA string.
 */

import type { Page } from 'patchright'
import type { StealthConfig } from './types.js'

export function getStealthConfig(): StealthConfig {
  return {
    headless: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  }
}

export async function applyStealthScripts(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true,
    })

    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true,
    })

    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3],
      configurable: true,
    })

    Object.defineProperty(window, 'chrome', {
      value: { runtime: {} },
      configurable: true,
      writable: true,
    })

    Object.defineProperty(Notification, 'permission', {
      get: () => 'default',
      configurable: true,
    })

    Object.defineProperty(screen, 'colorDepth', {
      get: () => 24,
      configurable: true,
    })
  })
}
