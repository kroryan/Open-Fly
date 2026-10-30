// Persistent, cache-first storage for public builds' separately hosted brains.
// Private desktop and web builds never install this fetch wrapper.
let originalFetch = null;
let installedRoot = "";
let cachePromise = null;
let importedCachePromise = null;

export async function installBrainCache(root, version = "1") {
  installedRoot = root ? new URL(root, self.location.href).href : "";
  originalFetch ||= globalThis.fetch.bind(globalThis);
  cachePromise = installedRoot ? globalThis.caches?.open(`open-fly-brains-${version}`) || null : null;
  importedCachePromise = globalThis.caches?.open("open-fly-imported-brains-v1") || null;
  installBrainFetchWrapper();
}

function installBrainFetchWrapper() {
  if (!originalFetch || globalThis.fetch.__openFlyBrainCache) return;
  const networkFetch = originalFetch;
  const wrapped = async (input, init) => {
    const raw = input instanceof Request ? input.url : input;
    let url;
    try { url = new URL(raw, self.location.href).href; } catch { return networkFetch(input, init); }
    if (importedCachePromise) {
      try {
        const local = await (await importedCachePromise).match(url);
        if (local) return local;
      } catch { /* a missing or unavailable local cache falls through to the regular request */ }
    }
    if (installedRoot && url.startsWith(installedRoot) && cachePromise) {
      const cache = await cachePromise;
      const hit = await cache.match(url);
      if (hit) return hit;
      const response = await networkFetch(input, init);
      if (response.ok) {
        try { await cache.put(url, response.clone()); } catch { /* quota errors leave this online response usable */ }
      }
      return response;
    }
    return networkFetch(input, init);
  };
  Object.defineProperty(wrapped, "__openFlyBrainCache", { value: true });
  globalThis.fetch = wrapped;
}

export async function storeImportedBrainFiles(entries, onProgress = () => {}) {
  if (!globalThis.caches) throw new Error("This webview does not support persistent brain storage.");
  const cache = await globalThis.caches.open("open-fly-imported-brains-v1");
  const origin = self.location.href;
  let done = 0;
  for (const entry of entries) {
    const url = new URL(`./${entry.path}`, origin).href;
    await cache.put(url, new Response(entry.file, { headers: { "Content-Type": entry.type || "application/octet-stream" } }));
    onProgress(++done, entries.length);
  }
}

export async function removeImportedBrainSpecies(speciesId) {
  if (!globalThis.caches) return;
  const cache = await globalThis.caches.open("open-fly-imported-brains-v1");
  for (const request of await cache.keys()) {
    const url = new URL(request.url);
    if (url.pathname.includes(`/species/${speciesId}/`)) await cache.delete(request);
  }
}

export async function cachedBrainAsset(url) {
  if (!cachePromise) return null;
  return (await cachePromise).match(url);
}

export async function discardCachedBrainAsset(url) {
  if (!cachePromise) return;
  await (await cachePromise).delete(url);
}
