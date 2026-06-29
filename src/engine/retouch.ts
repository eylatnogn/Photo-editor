// Destructive retouch operations that paint onto the heal/erase overlay
// canvases. All coordinates are in the retouch-layer pixel space (which the
// caller maps to from normalized pointer positions).

/**
 * Patch-heal: copy a soft-edged disk of texture sampled from a nearby clean
 * area over the target spot. A simple, forgiving alternative to a full
 * content-aware heal.
 */
export function stampHeal(
  healCtx: CanvasRenderingContext2D,
  sample: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
) {
  const w = sample.width
  const h = sample.height
  const r = Math.max(2, radius)

  // Pick a sample offset to the side; flip if it would leave the image.
  let ox = r * 2.6
  let oy = 0
  if (x + ox + r > w) ox = -ox
  if (x + ox - r < 0) {
    ox = 0
    oy = y + r * 2.6 + r > h ? -r * 2.6 : r * 2.6
  }
  const sx = Math.max(0, Math.min(w - 2 * r, x + ox - r))
  const sy = Math.max(0, Math.min(h - 2 * r, y + oy - r))

  const patch = document.createElement('canvas')
  patch.width = Math.ceil(2 * r)
  patch.height = Math.ceil(2 * r)
  const pctx = patch.getContext('2d')!
  pctx.drawImage(sample, sx, sy, 2 * r, 2 * r, 0, 0, 2 * r, 2 * r)

  // Soft circular alpha mask.
  pctx.globalCompositeOperation = 'destination-in'
  const grad = pctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.7, 'rgba(0,0,0,0.9)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  pctx.fillStyle = grad
  pctx.fillRect(0, 0, 2 * r, 2 * r)

  healCtx.drawImage(patch, x - r, y - r)
}

/**
 * Smooth: sample the underlying image where the user brushes, blur it, and
 * feather it back over the area — softening skin, noise or texture without
 * painting any color. `strength` (0..1) controls how much it blurs.
 */
export function stampSmooth(
  healCtx: CanvasRenderingContext2D,
  sample: HTMLCanvasElement,
  x: number,
  y: number,
  radius: number,
  strength: number,
) {
  const w = sample.width
  const h = sample.height
  const r = Math.max(3, radius)
  const sx = Math.max(0, Math.min(w - 2 * r, x - r))
  const sy = Math.max(0, Math.min(h - 2 * r, y - r))

  const blurPx = Math.max(1.5, r * (0.16 + strength * 0.5))

  const patch = document.createElement('canvas')
  patch.width = Math.ceil(2 * r)
  patch.height = Math.ceil(2 * r)
  const pctx = patch.getContext('2d')!

  // Blur the sampled region in place.
  pctx.filter = `blur(${blurPx}px)`
  pctx.drawImage(sample, sx, sy, 2 * r, 2 * r, 0, 0, 2 * r, 2 * r)
  pctx.filter = 'none'

  // Soft circular mask so the smoothed patch blends at its edges. The core
  // stays just under full opacity to keep a hint of the original texture.
  pctx.globalCompositeOperation = 'destination-in'
  const grad = pctx.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, 'rgba(0,0,0,0.92)')
  grad.addColorStop(0.6, 'rgba(0,0,0,0.8)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  pctx.fillStyle = grad
  pctx.fillRect(0, 0, 2 * r, 2 * r)

  healCtx.drawImage(patch, x - r, y - r)
}

/**
 * Magic eraser: flood-fill a contiguous region of similar color starting at
 * (x, y) and mark it on the erase layer (white = removed). Returns the number
 * of pixels erased.
 */
export function magicErase(
  eraseCtx: CanvasRenderingContext2D,
  sampleData: ImageData,
  x: number,
  y: number,
  tolerance: number,
): number {
  const w = sampleData.width
  const h = sampleData.height
  const data = sampleData.data
  const sx = Math.round(x)
  const sy = Math.round(y)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return 0

  const idx0 = (sy * w + sx) * 4
  const tr = data[idx0]
  const tg = data[idx0 + 1]
  const tb = data[idx0 + 2]
  const tol2 = tolerance * tolerance * 3

  const visited = new Uint8Array(w * h)
  const out = eraseCtx.getImageData(0, 0, w, h)
  const od = out.data
  const stack = [sx, sy]
  let count = 0

  while (stack.length) {
    const py = stack.pop()!
    const px = stack.pop()!
    if (px < 0 || py < 0 || px >= w || py >= h) continue
    const p = py * w + px
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    const dr = data[i] - tr
    const dg = data[i + 1] - tg
    const db = data[i + 2] - tb
    if (dr * dr + dg * dg + db * db > tol2) continue
    // mark erased
    od[i] = 255
    od[i + 1] = 255
    od[i + 2] = 255
    od[i + 3] = 255
    count++
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1)
  }

  eraseCtx.putImageData(out, 0, 0)
  return count
}

// Solve Laplace's equation over the masked pixels (Gauss-Seidel), so the
// surrounding background diffuses smoothly into the hole.
function laplaceFill(
  R: Float32Array,
  G: Float32Array,
  B: Float32Array,
  mask: Uint8Array,
  w: number,
  h: number,
) {
  let mr = 0
  let mg = 0
  let mb = 0
  let kc = 0
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) {
      mr += R[i]
      mg += G[i]
      mb += B[i]
      kc++
    }
  }
  if (!kc) return
  mr /= kc
  mg /= kc
  mb /= kc
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      R[i] = mr
      G[i] = mg
      B[i] = mb
    }
  }
  const passes = Math.min(400, 3 * Math.max(w, h))
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!mask[i]) continue
        let sr = 0
        let sg = 0
        let sb = 0
        let c = 0
        if (x > 0) { const j = i - 1; sr += R[j]; sg += G[j]; sb += B[j]; c++ }
        if (x < w - 1) { const j = i + 1; sr += R[j]; sg += G[j]; sb += B[j]; c++ }
        if (y > 0) { const j = i - w; sr += R[j]; sg += G[j]; sb += B[j]; c++ }
        if (y < h - 1) { const j = i + w; sr += R[j]; sg += G[j]; sb += B[j]; c++ }
        if (c) { R[i] = sr / c; G[i] = sg / c; B[i] = sb / c }
      }
    }
  }
}

function dilate(mask: Uint8Array, w: number, h: number) {
  const src = mask.slice()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (src[i]) continue
      if (
        (x > 0 && src[i - 1]) ||
        (x < w - 1 && src[i + 1]) ||
        (y > 0 && src[i - w]) ||
        (y < h - 1 && src[i + w])
      )
        mask[i] = 1
    }
  }
}

/**
 * Content-aware remove: flood-fill a region of similar colour at (x, y), then
 * inpaint it by diffusing the surrounding background over it (painted onto the
 * heal layer) — hiding the object instead of cutting it out. Returns pixels.
 */
export function magicHeal(
  healCtx: CanvasRenderingContext2D,
  sample: HTMLCanvasElement,
  x: number,
  y: number,
  tolerance: number,
): number {
  const w = sample.width
  const h = sample.height
  const data = sample.getContext('2d')!.getImageData(0, 0, w, h).data
  const sx = Math.round(x)
  const sy = Math.round(y)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return 0

  const i0 = (sy * w + sx) * 4
  const tr = data[i0]
  const tg = data[i0 + 1]
  const tb = data[i0 + 2]
  const tol2 = tolerance * tolerance * 3

  const mask = new Uint8Array(w * h)
  const visited = new Uint8Array(w * h)
  const stack = [sx, sy]
  let count = 0
  let minx = w
  let miny = h
  let maxx = 0
  let maxy = 0
  while (stack.length) {
    const py = stack.pop()!
    const px = stack.pop()!
    if (px < 0 || py < 0 || px >= w || py >= h) continue
    const p = py * w + px
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    const dr = data[i] - tr
    const dg = data[i + 1] - tg
    const db = data[i + 2] - tb
    if (dr * dr + dg * dg + db * db > tol2) continue
    mask[p] = 1
    count++
    if (px < minx) minx = px
    if (px > maxx) maxx = px
    if (py < miny) miny = py
    if (py > maxy) maxy = py
    stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1)
  }
  if (!count) return 0

  // Region with surrounding context to sample background from.
  const bw = maxx - minx + 1
  const bh = maxy - miny + 1
  const pad = Math.round(Math.max(bw, bh) * 0.6) + 10
  const x0 = Math.max(0, minx - pad)
  const y0 = Math.max(0, miny - pad)
  const x1 = Math.min(w - 1, maxx + pad)
  const y1 = Math.min(h - 1, maxy + pad)
  const rw = x1 - x0 + 1
  const rh = y1 - y0 + 1

  // Downscale the region — the background fill is low-frequency, so solving it
  // small (then scaling up) is both faster and smoother.
  const FILL = 110
  const f = Math.min(1, FILL / Math.max(rw, rh))
  const sw = Math.max(2, Math.round(rw * f))
  const sh = Math.max(2, Math.round(rh * f))
  const R = new Float32Array(sw * sh)
  const G = new Float32Array(sw * sh)
  const B = new Float32Array(sw * sh)
  const M = new Uint8Array(sw * sh)
  for (let yy = 0; yy < sh; yy++) {
    for (let xx = 0; xx < sw; xx++) {
      const fx = Math.min(w - 1, x0 + Math.floor(xx / f))
      const fy = Math.min(h - 1, y0 + Math.floor(yy / f))
      const fi = (fy * w + fx) * 4
      const k = yy * sw + xx
      R[k] = data[fi]
      G[k] = data[fi + 1]
      B[k] = data[fi + 2]
      M[k] = mask[fy * w + fx]
    }
  }
  // Dilate generously so the fill covers the object's anti-aliased edge plus a
  // margin (the feather then happens out in the background, not on the object).
  for (let i = 0; i < 4; i++) dilate(M, sw, sh)
  laplaceFill(R, G, B, M, sw, sh)

  // Small filled image -> scaled-up patch.
  const small = document.createElement('canvas')
  small.width = sw
  small.height = sh
  const sctx = small.getContext('2d')!
  const simg = sctx.createImageData(sw, sh)
  for (let k = 0; k < sw * sh; k++) {
    simg.data[k * 4] = R[k]
    simg.data[k * 4 + 1] = G[k]
    simg.data[k * 4 + 2] = B[k]
    simg.data[k * 4 + 3] = 255
  }
  sctx.putImageData(simg, 0, 0)

  const patch = document.createElement('canvas')
  patch.width = rw
  patch.height = rh
  const pctx = patch.getContext('2d')!
  pctx.imageSmoothingEnabled = true
  pctx.drawImage(small, 0, 0, rw, rh)

  // Alpha mask from the dilated small mask: covers the object + margin, with a
  // soft edge (blur at small scale + bilinear upscale) so the fill blends into
  // the background without leaving a halo of the original object.
  const ms = document.createElement('canvas')
  ms.width = sw
  ms.height = sh
  const msctx = ms.getContext('2d')!
  const mimg = msctx.createImageData(sw, sh)
  for (let k = 0; k < sw * sh; k++) {
    mimg.data[k * 4] = 255
    mimg.data[k * 4 + 1] = 255
    mimg.data[k * 4 + 2] = 255
    mimg.data[k * 4 + 3] = M[k] ? 255 : 0
  }
  msctx.putImageData(mimg, 0, 0)
  const msB = document.createElement('canvas')
  msB.width = sw
  msB.height = sh
  const msBctx = msB.getContext('2d')!
  msBctx.filter = 'blur(1.5px)'
  msBctx.drawImage(ms, 0, 0)

  pctx.globalCompositeOperation = 'destination-in'
  pctx.imageSmoothingEnabled = true
  pctx.drawImage(msB, 0, 0, rw, rh)

  healCtx.drawImage(patch, x0, y0)
  return count
}
