// Retouch engine. Every tool paints onto a single destructive `heal` overlay
// (RGBA, transparent where untouched) that the renderer composites over the
// source. Brushes read the LIVE composite (source + heal-so-far) so edits
// stack naturally, and the overlay stays at a capped resolution while the
// untouched source keeps full resolution on export.
//
// All coordinates are in heal/sample pixel space (the caller maps normalized
// pointer positions into it).

const clampI = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

interface Patch {
  c: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  sx: number
  sy: number
  size: number
}

// A brush-sized square of the current composite (base + heal painted so far),
// plus where it sits in image pixels.
function compositePatch(
  base: HTMLCanvasElement,
  heal: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
): Patch {
  const size = Math.max(3, Math.ceil(2 * r))
  const sx = clampI(Math.round(x - r), 0, Math.max(0, base.width - size))
  const sy = clampI(Math.round(y - r), 0, Math.max(0, base.height - size))
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.drawImage(base, sx, sy, size, size, 0, 0, size, size)
  ctx.drawImage(heal, sx, sy, size, size, 0, 0, size, size)
  return { c, ctx, sx, sy, size }
}

// Just the base (untouched) pixels for a region — used as a clean donor.
function basePatch(base: HTMLCanvasElement, x: number, y: number, r: number): Patch {
  const size = Math.max(3, Math.ceil(2 * r))
  const sx = clampI(Math.round(x - r), 0, Math.max(0, base.width - size))
  const sy = clampI(Math.round(y - r), 0, Math.max(0, base.height - size))
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  ctx.drawImage(base, sx, sy, size, size, 0, 0, size, size)
  return { c, ctx, sx, sy, size }
}

// Feather a processed patch into a soft disk and stamp it onto the heal layer
// at (dx,dy). `core` (0..1) is the peak opacity, so partial-strength tools
// (e.g. a light dodge) blend gently.
function stampFeathered(
  healCtx: CanvasRenderingContext2D,
  patch: HTMLCanvasElement,
  dx: number,
  dy: number,
  gx: number,
  gy: number,
  r: number,
  core: number,
) {
  const pctx = patch.getContext('2d')!
  pctx.globalCompositeOperation = 'destination-in'
  const g = pctx.createRadialGradient(gx, gy, 0, gx, gy, r)
  g.addColorStop(0, `rgba(0,0,0,${core})`)
  g.addColorStop(0.72, `rgba(0,0,0,${core})`)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  pctx.fillStyle = g
  pctx.fillRect(0, 0, patch.width, patch.height)
  healCtx.drawImage(patch, dx, dy)
}

function meanRGB(ctx: CanvasRenderingContext2D, size: number): [number, number, number] {
  const d = ctx.getImageData(0, 0, size, size).data
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]
    g += d[i + 1]
    b += d[i + 2]
    n++
  }
  return [r / n, g / n, b / n]
}

function blurredCopy(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const b = document.createElement('canvas')
  b.width = src.width
  b.height = src.height
  const ctx = b.getContext('2d')!
  ctx.filter = `blur(${px}px)`
  ctx.drawImage(src, 0, 0)
  return b
}

// ---------- Brushes ----------

// Smooth / skin-soften: blur the live composite and feather it back.
export function brushSmooth(
  base: HTMLCanvasElement,
  heal: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  strength: number,
) {
  const p = compositePatch(base, heal, x, y, r)
  const blurPx = Math.max(1.2, r * (0.16 + strength * 0.6))
  const b = blurredCopy(p.c, blurPx)
  p.ctx.clearRect(0, 0, p.size, p.size)
  p.ctx.drawImage(b, 0, 0)
  stampFeathered(heal.getContext('2d')!, p.c, p.sx, p.sy, x - p.sx, y - p.sy, r, 1)
}

// Repair / spot-heal: take clean texture from a nearby donor and shift its
// colour to match the target's lighting, so blemishes vanish seamlessly.
export function brushRepair(
  base: HTMLCanvasElement,
  heal: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  strength: number,
) {
  const w = base.width
  const h = base.height
  // target's current mean colour
  const tgt = compositePatch(base, heal, x, y, r)
  const [tr, tg, tb] = meanRGB(tgt.ctx, tgt.size)
  // pick a donor offset to the side, flipping if it would leave the image
  let ox = r * 2.6
  let oy = 0
  if (x + ox + r > w) ox = -ox
  if (x + ox - r < 0) {
    ox = 0
    oy = y + r * 2.6 + r > h ? -r * 2.6 : r * 2.6
  }
  const donor = basePatch(base, x + ox, y + oy, r)
  const [dr, dg, db] = meanRGB(donor.ctx, donor.size)
  // colour-correct the donor toward the target's lighting
  const img = donor.ctx.getImageData(0, 0, donor.size, donor.size)
  const d = img.data
  const sr = tr - dr
  const sg = tg - dg
  const sb = tb - db
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clampI(d[i] + sr, 0, 255)
    d[i + 1] = clampI(d[i + 1] + sg, 0, 255)
    d[i + 2] = clampI(d[i + 2] + sb, 0, 255)
  }
  donor.ctx.putImageData(img, 0, 0)
  // stamp at the TARGET location (donor patch is the same size)
  const dsx = clampI(Math.round(x - r), 0, Math.max(0, w - donor.size))
  const dsy = clampI(Math.round(y - r), 0, Math.max(0, h - donor.size))
  stampFeathered(heal.getContext('2d')!, donor.c, dsx, dsy, x - dsx, y - dsy, r, 0.6 + strength * 0.4)
}

// Clone stamp: copy the live composite from a locked source point.
export function brushClone(
  base: HTMLCanvasElement,
  heal: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  strength: number,
  srcX: number,
  srcY: number,
) {
  const donor = compositePatch(base, heal, srcX, srcY, r)
  const dsx = clampI(Math.round(x - r), 0, Math.max(0, base.width - donor.size))
  const dsy = clampI(Math.round(y - r), 0, Math.max(0, base.height - donor.size))
  stampFeathered(heal.getContext('2d')!, donor.c, dsx, dsy, x - dsx, y - dsy, r, 0.6 + strength * 0.4)
}

// Dodge (lighten) / Burn (darken): nudge the live composite's luminance.
export function brushDodgeBurn(
  base: HTMLCanvasElement,
  heal: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  strength: number,
  sign: 1 | -1,
) {
  const p = compositePatch(base, heal, x, y, r)
  const img = p.ctx.getImageData(0, 0, p.size, p.size)
  const d = img.data
  const k = strength * 0.22
  for (let i = 0; i < d.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = d[i + ch]
      d[i + ch] = sign > 0 ? v + (255 - v) * k : v * (1 - k)
    }
  }
  p.ctx.putImageData(img, 0, 0)
  stampFeathered(heal.getContext('2d')!, p.c, p.sx, p.sy, x - p.sx, y - p.sy, r, 1)
}

// Sharpen: unsharp-mask the live composite locally.
export function brushSharpen(
  base: HTMLCanvasElement,
  heal: HTMLCanvasElement,
  x: number,
  y: number,
  r: number,
  strength: number,
) {
  const p = compositePatch(base, heal, x, y, r)
  const blur = blurredCopy(p.c, Math.max(1, r * 0.25))
  const oimg = p.ctx.getImageData(0, 0, p.size, p.size)
  const bimg = blur.getContext('2d')!.getImageData(0, 0, p.size, p.size)
  const o = oimg.data
  const bd = bimg.data
  const amt = 0.6 + strength * 1.6
  for (let i = 0; i < o.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      const v = o[i + ch]
      o[i + ch] = clampI(v + (v - bd[i + ch]) * amt, 0, 255)
    }
  }
  p.ctx.putImageData(oimg, 0, 0)
  stampFeathered(heal.getContext('2d')!, p.c, p.sx, p.sy, x - p.sx, y - p.sy, r, 1)
}

// ---------- Object removal (content-aware) ----------

// Solve Laplace's equation over the masked pixels (Gauss-Seidel) so the
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

// Content-aware remove: flood-fill a region of similar colour at (x, y), then
// inpaint it by diffusing the surrounding background over it (painted onto the
// heal layer) — hiding the object instead of cutting it out. Returns pixels.
export function magicRemove(
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

  const bw = maxx - minx + 1
  const bh = maxy - miny + 1
  const pad = Math.round(Math.max(bw, bh) * 0.6) + 10
  const x0 = Math.max(0, minx - pad)
  const y0 = Math.max(0, miny - pad)
  const x1 = Math.min(w - 1, maxx + pad)
  const y1 = Math.min(h - 1, maxy + pad)
  const rw = x1 - x0 + 1
  const rh = y1 - y0 + 1

  // Solve the fill at low resolution (it's low-frequency) then scale up.
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
  for (let i = 0; i < 4; i++) dilate(M, sw, sh)
  laplaceFill(R, G, B, M, sw, sh)

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

  // Soft mask covering the object + margin so the fill blends without a halo.
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
