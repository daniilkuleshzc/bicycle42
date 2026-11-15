// One thing at a time per key: the file operations of one note (or one file) run in the order
// they were asked for, each after the one before has finished, while other keys go on beside
// them. A failed step does not stop the ones after it.
export type Queue = {
  /** Runs `step` after everything queued before it under `key`; resolves with what it returns. */
  run<T>(key: string, step: () => Promise<T>): Promise<T>
  /** Resolves once everything queued so far, under every key, has run. */
  idle(): Promise<void>
}

export function createQueue(): Queue {
  const tails = new Map<string, Promise<unknown>>()
  return {
    run(key, step) {
      const before = tails.get(key) ?? Promise.resolve()
      const result = before.then(step)
      const tail = result.catch(() => undefined)
      tails.set(key, tail)
      // The last one out leaves no entry behind.
      void tail.then(() => tails.get(key) === tail && tails.delete(key))
      return result
    },
    async idle() {
      while (tails.size) await Promise.all(tails.values())
    },
  }
}
