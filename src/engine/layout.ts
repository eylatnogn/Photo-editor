// Layout / collage templates: a catalog of photo-slot arrangements plus the
// geometry + compositor used to render them. A layout composes several photos
// into a single image that the rest of the pipeline (adjustments, stickers,
// text, frame) then treats as the base — so anything placed with the other
// tools naturally sits on top of the collage.

import type { Layout, LayoutSlot } from '../types'
import { getImage } from './imageCache'
import { uid } from '../utils'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface LayoutTemplate {
  id: string
  label: string
  count: number
  aspect: number // default output w/h
  rects: Rect[] // base slot rects (gap/padding applied at render time)
}

const grid = (cols: number, rows: number): Rect[] => {
  const out: Rect[] = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) out.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows })
  return out
}

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  { id: 'side2', label: 'Side by side', count: 2, aspect: 1, rects: grid(2, 1) },
  { id: 'stack2', label: 'Stacked', count: 2, aspect: 1, rects: grid(1, 2) },
  { id: 'tall2', label: 'Tall pair', count: 2, aspect: 4 / 5, rects: grid(1, 2) },
  {
    id: 'bigLeft3',
    label: 'Feature + 2',
    count: 3,
    aspect: 1,
    rects: [
      { x: 0, y: 0, w: 0.62, h: 1 },
      { x: 0.62, y: 0, w: 0.38, h: 0.5 },
      { x: 0.62, y: 0.5, w: 0.38, h: 0.5 },
    ],
  },
  {
    id: 'topBig3',
    label: 'Header + 2',
    count: 3,
    aspect: 4 / 5,
    rects: [
      { x: 0, y: 0, w: 1, h: 0.58 },
      { x: 0, y: 0.58, w: 0.5, h: 0.42 },
      { x: 0.5, y: 0.58, w: 0.5, h: 0.42 },
    ],
  },
  { id: 'strip3', label: 'Photo strip', count: 3, aspect: 0.5, rects: grid(1, 3) },
  { id: 'cols3', label: 'Triptych', count: 3, aspect: 16 / 9, rects: grid(3, 1) },
  { id: 'grid4', label: 'Grid', count: 4, aspect: 1, rects: grid(2, 2) },
  {
    id: 'bigTop4',
    label: 'Hero + row',
    count: 4,
    aspect: 4 / 5,
    rects: [
      { x: 0, y: 0, w: 1, h: 0.55 },
      { x: 0, y: 0.55, w: 1 / 3, h: 0.45 },
      { x: 1 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
      { x: 2 / 3, y: 0.55, w: 1 / 3, h: 0.45 },
    ],
  },
  { id: 'strip4', label: 'Long strip', count: 4, aspect: 0.5, rects: grid(1, 4) },
]

const DEFAULTS = {
  gap: 0.014,
  radius: 0.04,
  padding: 0.02,
  background: '#ffffff',
}

// Build a fresh Layout from a template (all slots empty).
export function makeLayout(templateId: string): Layout {
  const t = LAYOUT_TEMPLATES.find((x) => x.id === templateId) ?? LAYOUT_TEMPLATES[0]
  return {
    template: t.id,
    aspect: t.aspect,
    gap: DEFAULTS.gap,
    radius: DEFAULTS.radius,
    padding: DEFAULTS.padding,
    background: DEFAULTS.background,
    slots: t.rects.map(
      (r): LayoutSlot => ({
        id: uid('slot'),
        x: r.x,
        y: r.y,
        w: r.w,
        h: r.h,
        src: null,
        naturalRatio: 1,
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      }),
    ),
  }
}

// Display rects (normalized 0..1 of the output) after applying outer padding and
// inter-slot gaps. Gap/padding are expressed in width fractions and scaled on
// the y axis by the aspect so the visual spacing is uniform in pixels.
export function slotDisplayRects(layout: Layout): Array<Rect & { id: string }> {
  const a = layout.aspect
  const padX = layout.padding
  const padY = layout.padding * a
  const gapX = layout.gap
  const gapY = layout.gap * a
  return layout.slots.map((s) => {
    const x = padX + s.x * (1 - 2 * padX)
    const y = padY + s.y * (1 - 2 * padY)
    const w = s.w * (1 - 2 * padX)
    const h = s.h * (1 - 2 * padY)
    return { id: s.id, x: x + gapX / 2, y: y + gapY / 2, w: w - gapX, h: h - gapY }
  })
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

// Cover-fit a photo inside a pixel rect with the slot's zoom + pan.
function drawSlotPhoto(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  rect: Rect,
  slot: LayoutSlot,
  radiusPx: number,
) {
  ctx.save()
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, radiusPx)
  ctx.clip()
  const cover = Math.max(rect.w / iw, rect.h / ih)
  const scale = cover * Math.max(1, slot.zoom)
  const dw = iw * scale
  const dh = ih * scale
  const maxOffX = Math.max(0, (dw - rect.w) / 2)
  const maxOffY = Math.max(0, (dh - rect.h) / 2)
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  const dx = cx - dw / 2 + slot.offsetX * 2 * maxOffX
  const dy = cy - dh / 2 + slot.offsetY * 2 * maxOffY
  ctx.drawImage(img, dx, dy, dw, dh)
  ctx.restore()
}

// Compose the whole layout into a fresh canvas at ~maxDim on the long edge.
export function composeLayout(layout: Layout, maxDim = 1800): HTMLCanvasElement {
  const a = layout.aspect
  const W = a >= 1 ? maxDim : Math.round(maxDim * a)
  const H = a >= 1 ? Math.round(maxDim / a) : maxDim
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, W)
  canvas.height = Math.max(1, H)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = layout.background
  ctx.fillRect(0, 0, W, H)

  const rects = slotDisplayRects(layout)
  rects.forEach((r, i) => {
    const slot = layout.slots[i]
    const px = { x: r.x * W, y: r.y * H, w: r.w * W, h: r.h * H }
    const radiusPx = layout.radius * Math.min(px.w, px.h)
    if (slot.src) {
      const img = getImage(slot.src)
      if (img) drawSlotPhoto(ctx, img, img.naturalWidth, img.naturalHeight, px, slot, radiusPx)
    }
    // Empty slots are left as background here; the edit overlay marks them so
    // exports stay clean.
  })
  return canvas
}
