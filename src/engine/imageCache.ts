// Caches decoded images (by data-URL/src) so layers can be drawn synchronously
// during render. When a not-yet-loaded image is requested, it starts loading
// and notifies subscribers so the canvas can re-render once it's ready.

const cache = new Map<string, HTMLImageElement>()
const loading = new Set<string>()
const subscribers = new Set<() => void>()

export function onImageLoad(cb: () => void): () => void {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

function notify() {
  subscribers.forEach((cb) => cb())
}

/** Returns the decoded image if ready, otherwise kicks off a load and null. */
export function getImage(src: string): HTMLImageElement | null {
  const hit = cache.get(src)
  if (hit) return hit
  if (!loading.has(src)) {
    loading.add(src)
    const img = new Image()
    img.onload = () => {
      cache.set(src, img)
      loading.delete(src)
      notify()
    }
    img.onerror = () => {
      loading.delete(src)
    }
    img.src = src
  }
  return null
}

/** Synchronously prime the cache with an already-decoded image. */
export function primeImage(src: string, img: HTMLImageElement) {
  cache.set(src, img)
}
