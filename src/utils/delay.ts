function wait(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function randomDelay(min = 800, max = 2500): Promise<void> {
  await wait(min, max)
}

export async function shortDelay(): Promise<void> {
  await wait(300, 700)
}

export async function longDelay(): Promise<void> {
  await wait(3000, 6000)
}
