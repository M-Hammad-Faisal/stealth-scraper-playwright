const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const GRAY = '\x1b[90m'

function timestamp(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${GRAY}[${h}:${m}:${s}]${RESET}`
}

export const logger = {
  info(message: string): void {
    console.log(`${timestamp()} ${CYAN}INFO${RESET}  ${message}`)
  },
  warn(message: string): void {
    console.warn(`${timestamp()} ${YELLOW}WARN${RESET}  ${message}`)
  },
  error(message: string): void {
    console.error(`${timestamp()} ${RED}ERROR${RESET} ${message}`)
  },
  success(message: string): void {
    console.log(`${timestamp()} ${GREEN}OK${RESET}    ${message}`)
  },
  debug(message: string): void {
    console.log(`${timestamp()} ${GRAY}DEBUG${RESET} ${message}`)
  },
}
