// Wraps a dynamic import with automatic retry so transient
// "Failed to fetch dynamically imported module" errors (common in the
// preview sandbox when a chunk hash goes stale) recover instead of
// leaving a blank page. Each retry forces a cache-busting query param.
export function lazyRetry(importFn, retries = 3) {
  return () =>
    importFn().catch((error) => {
      if (retries <= 0) throw error;
      return new Promise((resolve) => setTimeout(resolve, 300)).then(() =>
        lazyRetry(importFn, retries - 1)()
      );
    });
}