import { createError } from 'h3'

/** Race DB/async work against a wall-clock timeout so Nitro handlers don't hang forever (libsql/sqlite lock quirks). */
export async function withDbTimeout<T>(
  label: string,
  promise: Promise<T>,
  ms = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const raced = Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          createError({
            statusCode: 504,
            statusMessage: `Database operation timed out (${label})`,
          }),
        )
      }, ms)
    }),
  ])
  try {
    return await raced
  }
  finally {
    if (timer !== undefined)
      clearTimeout(timer)
  }
}
