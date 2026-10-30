// Persistent, cache-first storage for public builds' separately hosted brains.
// Private desktop and web builds never install this fetch wrapper.
let originalFetch = null;
let installedRoot = "";
let cachePromise = null;

export async function installBrainCache(root, version = "1") {
  installedRoot = new URL(root, self.location.href).href;
  originalFetch ||= globalThis.fetch.bind(globalThis);
  cachePromise = globalThis.caches?.open(`open-fly-brains-${version}`) || null;
  if (!cachePromise || globalThis.fetch.__openFlyBrainCache) return;
  const networkFetch = originalFetch;
  const wrapped = async (input, init) => {
    const raw = input instanceof Request ? input.url : input;
    let url;
    try { url = new URL(raw, self.location.href).href; } catch { return networkFetch(input, init); }
    if (!url.startsWith(installedRoot)) return networkFetch(input, init);
    const cache = await cachePromise;
    const hit = await cache.match(url);
    if (hit) return hit;
    const response = await networkFetch(input, init);
    if (response.ok) {
      try { await cache.put(url, response.clone()); } catch { /* quota errors leave this online response usable */ }
    }
    return response;
  };
  Object.defineProperty(wrapped, "__openFlyBrainCache", { value: true });
  globalThis.fetch = wrapped;
}

export async function cachedBrainAsset(url) {
  if (!cachePromise) return null;
  return (await cachePromise).match(url);
}

export async function discardCachedBrainAsset(url) {
  if (!cachePromise) return;
  await (await cachePromise).delete(url);
}
