/**
 * Trailing debounce with explicit `.cancel()`.
 * VueUse v14 `useDebounceFn` returns a bare function — `.cancel` is unavailable.
 */
export function debouncedSchedule(fn: () => void | Promise<void>, ms: number) {
  let id: ReturnType<typeof globalThis.setTimeout> | undefined
  return {
    schedule() {
      if (id !== undefined)
        clearTimeout(id)
      id = globalThis.setTimeout(() => {
        id = undefined
        void fn()
      }, ms)
    },
    cancel() {
      if (id !== undefined) {
        clearTimeout(id)
        id = undefined
      }
    },
  }
}

export function debouncedScheduleArgs<A extends unknown[]>(
  fn: (...args: A) => void | Promise<void>,
  ms: number,
) {
  let id: ReturnType<typeof globalThis.setTimeout> | undefined
  return {
    schedule(...args: A) {
      if (id !== undefined)
        clearTimeout(id)
      id = globalThis.setTimeout(() => {
        id = undefined
        void fn(...args)
      }, ms)
    },
    cancel() {
      if (id !== undefined) {
        clearTimeout(id)
        id = undefined
      }
    },
  }
}
