// Sticker catalog. Each sticker draws itself centered at the current canvas
// origin, filling a target width `w` (px); `measure` returns its bounding box
// so the transform handles and hit-testing can size it.

export type StickerCategory = 'shapes' | 'tape' | 'label' | 'emoji'

export interface StickerDef {
  id: string
  label: string
  category: StickerCategory
  hasColor: boolean
  hasText: boolean
  defaultColor: string
  emoji?: string
  aspect?: number // w/h for fixed-aspect stickers (default 1)
}

const PI2 = Math.PI * 2

function fillStar(ctx: CanvasRenderingContext2D, w: number, points: number, inner: number) {
  const r = w / 2
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner
    const a = (i / (points * 2)) * PI2 - Math.PI / 2
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
}

function drawHeart(ctx: CanvasRenderingContext2D, w: number) {
  const s = w / 2
  ctx.beginPath()
  ctx.moveTo(0, s * 0.75)
  ctx.bezierCurveTo(s * 1.1, -s * 0.1, s * 0.55, -s * 0.95, 0, -s * 0.35)
  ctx.bezierCurveTo(-s * 0.55, -s * 0.95, -s * 1.1, -s * 0.1, 0, s * 0.75)
  ctx.closePath()
  ctx.fill()
}

function drawFlower(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const r = w * 0.27
  const dist = w * 0.22
  ctx.fillStyle = color
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * dist, Math.sin(a) * dist, r, 0, PI2)
    ctx.fill()
  }
  ctx.fillStyle = '#ffd84d'
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.16, 0, PI2)
  ctx.fill()
}

function drawTape(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const h = w / 3
  ctx.fillStyle = color
  ctx.globalAlpha *= 0.62
  ctx.beginPath()
  // slightly torn ends
  ctx.moveTo(-w / 2, -h / 2)
  ctx.lineTo(w / 2, -h / 2 + h * 0.12)
  ctx.lineTo(w / 2, h / 2)
  ctx.lineTo(-w / 2, h / 2 - h * 0.12)
  ctx.closePath()
  ctx.fill()
  // subtle stripes
  ctx.globalAlpha *= 0.5
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = h * 0.06
  for (let x = -w / 2 + h * 0.4; x < w / 2; x += h * 0.5) {
    ctx.beginPath()
    ctx.moveTo(x, -h / 2)
    ctx.lineTo(x - h * 0.2, h / 2)
    ctx.stroke()
  }
}

// Location-pin chip aspect at a reference font (independent of size).
const PIN_REF = 100
function pinMetrics(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = `600 ${PIN_REF}px Inter, sans-serif`
  const tw = ctx.measureText(text || 'Location').width
  const padX = PIN_REF * 0.55
  const icon = PIN_REF * 0.85
  const gap = PIN_REF * 0.2
  const chipW = padX + icon + gap + tw + padX
  const chipH = PIN_REF + PIN_REF * 0.7
  return { chipW, chipH, tw, padX, icon, gap, aspect: chipW / chipH }
}

function drawPin(ctx: CanvasRenderingContext2D, w: number, text: string) {
  const m = pinMetrics(ctx, text)
  const scale = w / m.chipW
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(-m.chipW / 2, -m.chipH / 2)
  // pill
  const r = m.chipH / 2
  ctx.fillStyle = 'rgba(20,20,24,0.86)'
  roundRectPath(ctx, 0, 0, m.chipW, m.chipH, r)
  ctx.fill()
  // pin icon
  const cx = m.padX + m.icon / 2
  const cy = m.chipH / 2
  ctx.fillStyle = '#ff5b52'
  ctx.beginPath()
  ctx.arc(cx, cy - m.icon * 0.12, m.icon * 0.32, Math.PI, 0)
  ctx.lineTo(cx, cy + m.icon * 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(cx, cy - m.icon * 0.12, m.icon * 0.12, 0, PI2)
  ctx.fill()
  // text
  ctx.fillStyle = '#fff'
  ctx.font = `600 ${PIN_REF}px Inter, sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text || 'Location', m.padX + m.icon + m.gap, m.chipH / 2 + PIN_REF * 0.03)
  ctx.restore()
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export const STICKERS: StickerDef[] = [
  { id: 'star', label: 'Star', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffcc00' },
  { id: 'heart', label: 'Heart', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ff3b67' },
  { id: 'sparkle', label: 'Sparkle', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffe66d' },
  { id: 'flower', label: 'Flower', category: 'shapes', hasColor: false, hasText: false, defaultColor: '#ff7eb6' },
  { id: 'tape', label: 'Washi tape', category: 'tape', hasColor: true, hasText: false, defaultColor: '#e7d8a8', aspect: 3 },
  { id: 'pin', label: 'Location pin', category: 'label', hasColor: false, hasText: true, defaultColor: '#ffffff', aspect: 3 },
]

const EMOJI = ['✨', '🌸', '💖', '🔥', '⭐', '🦋', '🌈', '😎', '📷', '🍣', '🗼', '💫', '☀️', '🍜', '🫶', '🎀']
for (const e of EMOJI) {
  STICKERS.push({
    id: `emoji:${e}`,
    label: e,
    category: 'emoji',
    hasColor: false,
    hasText: false,
    defaultColor: '#000',
    emoji: e,
  })
}

export function getSticker(id: string): StickerDef | undefined {
  return STICKERS.find((s) => s.id === id)
}

// Bounding box {w, h} for a sticker rendered at target width `w`.
export function measureSticker(
  ctx: CanvasRenderingContext2D,
  id: string,
  w: number,
  text?: string,
): { w: number; h: number } {
  const def = getSticker(id)
  if (def?.id === 'pin') {
    const m = pinMetrics(ctx, text ?? '')
    return { w, h: w / m.aspect }
  }
  const aspect = def?.aspect ?? 1
  return { w, h: w / aspect }
}

// Draw a sticker centered at the origin filling width `w`.
export function drawSticker(
  ctx: CanvasRenderingContext2D,
  id: string,
  w: number,
  color: string,
  text?: string,
) {
  const def = getSticker(id)
  if (!def) return
  if (def.emoji) {
    ctx.font = `${w}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(def.emoji, 0, 0)
    return
  }
  ctx.fillStyle = color
  switch (id) {
    case 'star':
      fillStar(ctx, w, 5, 0.42)
      break
    case 'sparkle':
      fillStar(ctx, w, 4, 0.28)
      break
    case 'heart':
      drawHeart(ctx, w)
      break
    case 'flower':
      drawFlower(ctx, w, color)
      break
    case 'tape':
      drawTape(ctx, w, color)
      break
    case 'pin':
      drawPin(ctx, w, text ?? 'Location')
      break
  }
}
