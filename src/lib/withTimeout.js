// Races a promise against a timeout so a request that silently hangs on
// flaky/mobile networks still resolves to an error instead of spinning forever.
export function withTimeout(promise, ms = 15000, label = "Request") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms)
    ),
  ]);
}