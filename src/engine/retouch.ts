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
 * Airbrush: soft, low-flow color buildup onto the heal layer.
 */
export function paintAirbrush(
  healCtx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  hardness: number,
) {
  const r = Math.max(2, radius)
  const { rr, gg, bb } = parseColor(color)
  const grad = healCtx.createRadialGradient(x, y, 0, x, y, r)
  const core = 0.35
  grad.addColorStop(0, `rgba(${rr},${gg},${bb},${core})`)
  grad.addColorStop(
    Math.min(0.95, 0.3 + hardness * 0.6),
    `rgba(${rr},${gg},${bb},${core * 0.5})`,
  )
  grad.addColorStop(1, `rgba(${rr},${gg},${bb},0)`)
  healCtx.fillStyle = grad
  healCtx.beginPath()
  healCtx.arc(x, y, r, 0, Math.PI * 2)
  healCtx.fill()
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

function parseColor(hex: string): { rr: number; gg: number; bb: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return { rr: 255, gg: 0, bb: 0 }
  const n = parseInt(m[1], 16)
  return { rr: (n >> 16) & 255, gg: (n >> 8) & 255, bb: n & 255 }
}
