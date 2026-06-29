// Sticker catalog. Each sticker draws itself centered at the current canvas
// origin, filling a target width `w` (px); `measure` returns its bounding box
// so the transform handles and hit-testing can size it.

export type StickerCategory = 'shapes' | 'vintage' | 'doodle' | 'tape' | 'label' | 'emoji'

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

// ----- Vintage stickers -----
function drawSun(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const rays = 12
  for (let i = 0; i < rays; i++) {
    ctx.save()
    ctx.rotate((i / rays) * PI2)
    ctx.beginPath()
    ctx.moveTo(0, -w * 0.5)
    ctx.lineTo(w * 0.06, -w * 0.3)
    ctx.lineTo(-w * 0.06, -w * 0.3)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.24, 0, PI2)
  ctx.fill()
}

function drawButterfly(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const wingW = w * 0.26
  const wingH = w * 0.3
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(sx * w * 0.18, -w * 0.1, wingW, wingH, sx * 0.4, 0, PI2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(sx * w * 0.15, w * 0.16, wingW * 0.8, wingH * 0.7, sx * -0.3, 0, PI2)
    ctx.fill()
  }
  ctx.fillStyle = '#3a2a1a'
  ctx.beginPath()
  ctx.ellipse(0, 0, w * 0.03, w * 0.28, 0, 0, PI2)
  ctx.fill()
  ctx.strokeStyle = '#3a2a1a'
  ctx.lineWidth = w * 0.015
  ctx.beginPath()
  ctx.moveTo(0, -w * 0.22)
  ctx.lineTo(-w * 0.1, -w * 0.4)
  ctx.moveTo(0, -w * 0.22)
  ctx.lineTo(w * 0.1, -w * 0.4)
  ctx.stroke()
}

function drawFilmLabel(ctx: CanvasRenderingContext2D, w: number) {
  const h = w / 2.6
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.12)
  ctx.fillStyle = '#f5c518'
  ctx.fill()
  ctx.fillStyle = '#e0322b'
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.2)
  ctx.fillStyle = '#111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${h * 0.4}px Arial, sans-serif`
  ctx.fillText('SCRL', 0, h * 0.02)
  ctx.font = `${h * 0.22}px Arial, sans-serif`
  ctx.fillText('400 · 35mm', 0, h * 0.32)
}

function drawScallopTape(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const h = w / 3
  ctx.fillStyle = color
  ctx.globalAlpha *= 0.62
  const n = Math.max(3, Math.round(w / (h * 0.6)))
  const r = w / n / 2
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h / 2)
  for (let i = 0; i < n; i++) ctx.arc(-w / 2 + r * (2 * i + 1), -h / 2, r, Math.PI, 0, false)
  ctx.lineTo(w / 2, h / 2)
  for (let i = n - 1; i >= 0; i--) ctx.arc(-w / 2 + r * (2 * i + 1), h / 2, r, 0, Math.PI, false)
  ctx.closePath()
  ctx.fill()
}

const DATE_REF = 100
function dateMetrics(ctx: CanvasRenderingContext2D, text: string) {
  ctx.font = `${DATE_REF}px "Courier New", monospace`
  const tw = ctx.measureText(text || "'24").width
  const padX = DATE_REF * 0.25
  const chipW = tw + padX * 2
  const chipH = DATE_REF * 1.3
  return { chipW, chipH, aspect: chipW / chipH }
}

function drawDate(ctx: CanvasRenderingContext2D, w: number, text: string, color: string) {
  const m = dateMetrics(ctx, text)
  const scale = w / m.chipW
  ctx.save()
  ctx.scale(scale, scale)
  ctx.font = `${DATE_REF}px "Courier New", monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(255,150,0,0.9)'
  ctx.shadowBlur = DATE_REF * 0.28
  ctx.fillStyle = color || '#ffb300'
  ctx.fillText(text || "'24 ▸", 0, 0)
  ctx.restore()
}

// ----- Extra shape / doodle stickers -----
function poly(ctx: CanvasRenderingContext2D, pts: number[][]) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
  ctx.closePath()
  ctx.fill()
}

function drawRing(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = w * 0.13
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, PI2)
  ctx.stroke()
}
function drawSquareSticker(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const r = w * 0.12
  roundRectPath(ctx, -w * 0.42, -w * 0.42, w * 0.84, w * 0.84, r)
  ctx.fill()
}
function drawTriangle(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  poly(ctx, [[0, -w * 0.46], [w * 0.44, w * 0.36], [-w * 0.44, w * 0.36]])
}
function drawDiamond(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  poly(ctx, [[0, -w * 0.48], [w * 0.36, 0], [0, w * 0.48], [-w * 0.36, 0]])
}
function drawCross(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const a = w * 0.16
  const b = w * 0.46
  ctx.fillRect(-a, -b, a * 2, b * 2)
  ctx.fillRect(-b, -a, b * 2, a * 2)
}
function drawLightning(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  poly(ctx, [
    [w * 0.12, -w * 0.48],
    [-w * 0.28, w * 0.08],
    [-w * 0.02, w * 0.08],
    [-w * 0.12, w * 0.48],
    [w * 0.3, -w * 0.12],
    [w * 0.03, -w * 0.12],
  ])
}
function drawCloud(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const y = w * 0.06
  ctx.beginPath()
  ctx.arc(-w * 0.22, y, w * 0.16, 0, PI2)
  ctx.arc(-w * 0.02, y - w * 0.1, w * 0.2, 0, PI2)
  ctx.arc(w * 0.22, y, w * 0.17, 0, PI2)
  ctx.fill()
  ctx.fillRect(-w * 0.38, y, w * 0.76, w * 0.18)
}
function drawMoon(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.45, 0, PI2)
  ctx.arc(w * 0.18, -w * 0.08, w * 0.38, 0, PI2, true)
  ctx.fill('evenodd')
}
function drawSmiley(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.46, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(-w * 0.16, -w * 0.1, w * 0.06, 0, PI2)
  ctx.arc(w * 0.16, -w * 0.1, w * 0.06, 0, PI2)
  ctx.fill()
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = w * 0.06
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(0, w * 0.02, w * 0.22, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
}
function drawPeace(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = w * 0.07
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, PI2)
  ctx.moveTo(0, -w * 0.42)
  ctx.lineTo(0, w * 0.42)
  ctx.moveTo(0, 0)
  ctx.lineTo(-w * 0.3, w * 0.3)
  ctx.moveTo(0, 0)
  ctx.lineTo(w * 0.3, w * 0.3)
  ctx.stroke()
}
function drawDaisy(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI2
    ctx.save()
    ctx.rotate(a)
    ctx.beginPath()
    ctx.ellipse(0, -w * 0.28, w * 0.1, w * 0.22, 0, 0, PI2)
    ctx.fill()
    ctx.restore()
  }
  ctx.fillStyle = '#ffd84d'
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.14, 0, PI2)
  ctx.fill()
}
function drawCassette(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const h = w * 0.66
  ctx.fillStyle = color
  roundRectPath(ctx, -w / 2, -h / 2, w, h, w * 0.06)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  roundRectPath(ctx, -w * 0.38, -h * 0.36, w * 0.76, h * 0.34, w * 0.03)
  ctx.fill()
  ctx.fillStyle = '#222'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.17, h * 0.12, w * 0.1, 0, PI2)
    ctx.fill()
    ctx.fillStyle = '#888'
    ctx.beginPath()
    ctx.arc(sx * w * 0.17, h * 0.12, w * 0.04, 0, PI2)
    ctx.fill()
    ctx.fillStyle = '#222'
  }
}
function drawVinyl(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.48, 0, PI2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = w * 0.01
  for (let r = 0.2; r < 0.46; r += 0.06) {
    ctx.beginPath()
    ctx.arc(0, 0, w * r, 0, PI2)
    ctx.stroke()
  }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.15, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#1a1a1a'
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.025, 0, PI2)
  ctx.fill()
}
function drawBow(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(sx * w * 0.42, -w * 0.26)
    ctx.lineTo(sx * w * 0.42, w * 0.26)
    ctx.closePath()
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.1, 0, PI2)
  ctx.fill()
}
function drawSpeech(ctx: CanvasRenderingContext2D, w: number, color: string, text?: string) {
  const h = w * 0.62
  ctx.fillStyle = color
  roundRectPath(ctx, -w / 2, -h / 2, w, h * 0.82, h * 0.22)
  ctx.fill()
  poly(ctx, [
    [-w * 0.12, h * 0.3],
    [-w * 0.28, h * 0.5],
    [w * 0.04, h * 0.3],
  ])
  if (text) {
    ctx.fillStyle = '#1a1a1a'
    ctx.font = `600 ${h * 0.3}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, -h * 0.04)
  }
}
function drawBanner(ctx: CanvasRenderingContext2D, w: number, color: string, text?: string) {
  const h = w / 3.4
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h / 2)
  ctx.lineTo(w / 2, -h / 2)
  ctx.lineTo(w / 2 - h * 0.5, 0)
  ctx.lineTo(w / 2, h / 2)
  ctx.lineTo(-w / 2, h / 2)
  ctx.lineTo(-w / 2 + h * 0.5, 0)
  ctx.closePath()
  ctx.fill()
  if (text) {
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${h * 0.5}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, 0)
  }
}
function drawArrowDoodle(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = w * 0.06
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(-w * 0.45, w * 0.2)
  ctx.bezierCurveTo(-w * 0.1, -w * 0.4, w * 0.2, -w * 0.3, w * 0.4, w * 0.05)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w * 0.4, w * 0.05)
  ctx.lineTo(w * 0.18, w * 0.02)
  ctx.moveTo(w * 0.4, w * 0.05)
  ctx.lineTo(w * 0.34, -w * 0.18)
  ctx.stroke()
}
function drawSquiggle(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = w * 0.07
  ctx.lineCap = 'round'
  const n = 4
  const r = w / n / 2
  ctx.beginPath()
  ctx.moveTo(-w / 2, 0)
  for (let i = 0; i < n; i++) {
    ctx.arc(-w / 2 + r * (2 * i + 1), 0, r, Math.PI, 0, i % 2 === 0)
  }
  ctx.stroke()
}

export const STICKERS: StickerDef[] = [
  { id: 'star', label: 'Star', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffcc00' },
  { id: 'heart', label: 'Heart', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ff3b67' },
  { id: 'sparkle', label: 'Sparkle', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffe66d' },
  { id: 'flower', label: 'Flower', category: 'shapes', hasColor: false, hasText: false, defaultColor: '#ff7eb6' },
  { id: 'ring', label: 'Ring', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ff3b67' },
  { id: 'square', label: 'Square', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#34c759' },
  { id: 'triangle', label: 'Triangle', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#007aff' },
  { id: 'diamond', label: 'Diamond', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#5ac8fa' },
  { id: 'cross', label: 'Plus', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ff9500' },
  { id: 'lightning', label: 'Bolt', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffd60a' },
  { id: 'cloud', label: 'Cloud', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#dbe7f5' },
  { id: 'moon', label: 'Moon', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffd84d' },
  { id: 'smiley', label: 'Smiley', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffd60a' },
  { id: 'peace', label: 'Peace', category: 'shapes', hasColor: true, hasText: false, defaultColor: '#ffffff' },
  { id: 'tape', label: 'Washi tape', category: 'tape', hasColor: true, hasText: false, defaultColor: '#e7d8a8', aspect: 3 },
  { id: 'scalloptape', label: 'Scallop tape', category: 'tape', hasColor: true, hasText: false, defaultColor: '#e8b9c4', aspect: 3 },
  { id: 'pin', label: 'Location pin', category: 'label', hasColor: false, hasText: true, defaultColor: '#ffffff', aspect: 3 },
  { id: 'datestamp', label: 'Date stamp', category: 'label', hasColor: true, hasText: true, defaultColor: '#ffb300' },
  // vintage
  { id: 'burst', label: 'Starburst', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#ffd84d' },
  { id: 'sun', label: 'Retro sun', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#ff9d3c' },
  { id: 'butterfly', label: 'Butterfly', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#ff8fb1' },
  { id: 'filmlabel', label: 'Film label', category: 'vintage', hasColor: false, hasText: false, defaultColor: '#f5c518', aspect: 2.6 },
  { id: 'cassette', label: 'Cassette', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#7c5cff', aspect: 1.5 },
  { id: 'vinyl', label: 'Vinyl', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#ff5b52' },
  { id: 'daisy', label: 'Daisy', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#ffffff' },
  { id: 'bow', label: 'Bow', category: 'vintage', hasColor: true, hasText: false, defaultColor: '#ff8fb1' },
  // doodles
  { id: 'arrowdoodle', label: 'Arrow', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#ff3b30' },
  { id: 'squiggle', label: 'Squiggle', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#ff3b30' },
  { id: 'speech', label: 'Speech', category: 'doodle', hasColor: true, hasText: true, defaultColor: '#ffffff', aspect: 1.6 },
  { id: 'banner', label: 'Banner', category: 'doodle', hasColor: true, hasText: true, defaultColor: '#ff3b67', aspect: 3.4 },
]

const EMOJI = [
  '✨', '🌸', '💖', '🔥', '⭐', '🦋', '🌈', '😎', '📷', '🍣', '🗼', '💫', '☀️', '🍜', '🫶', '🎀',
  '🎞️', '📼', '📺', '🌻', '💌', '🕶️', '🪩', '📻', '💕', '😍', '🥰', '😭', '🤍', '🖤', '❤️‍🔥', '💯',
  '🍵', '🍓', '🍑', '🍒', '🥐', '🍷', '🍸', '🧋', '🌊', '🏝️', '✈️', '🚗', '🎡', '🎟️', '📍', '🗽',
  '🌙', '⚡', '☁️', '❄️', '🍀', '🌹', '🌼', '🪷', '🐚', '🦢', '🐈', '🐰', '🎧', '💎', '👑', '🪐',
]
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
  if (def?.id === 'datestamp') {
    const m = dateMetrics(ctx, text ?? '')
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
    case 'scalloptape':
      drawScallopTape(ctx, w, color)
      break
    case 'pin':
      drawPin(ctx, w, text ?? 'Location')
      break
    case 'datestamp':
      drawDate(ctx, w, text ?? "'24 ▸", color)
      break
    case 'burst':
      fillStar(ctx, w, 12, 0.5)
      break
    case 'sun':
      drawSun(ctx, w, color)
      break
    case 'butterfly':
      drawButterfly(ctx, w, color)
      break
    case 'filmlabel':
      drawFilmLabel(ctx, w)
      break
    case 'ring':
      drawRing(ctx, w, color)
      break
    case 'square':
      drawSquareSticker(ctx, w, color)
      break
    case 'triangle':
      drawTriangle(ctx, w, color)
      break
    case 'diamond':
      drawDiamond(ctx, w, color)
      break
    case 'cross':
      drawCross(ctx, w, color)
      break
    case 'lightning':
      drawLightning(ctx, w, color)
      break
    case 'cloud':
      drawCloud(ctx, w, color)
      break
    case 'moon':
      drawMoon(ctx, w, color)
      break
    case 'smiley':
      drawSmiley(ctx, w, color)
      break
    case 'peace':
      drawPeace(ctx, w, color)
      break
    case 'cassette':
      drawCassette(ctx, w, color)
      break
    case 'vinyl':
      drawVinyl(ctx, w, color)
      break
    case 'daisy':
      drawDaisy(ctx, w, color)
      break
    case 'bow':
      drawBow(ctx, w, color)
      break
    case 'arrowdoodle':
      drawArrowDoodle(ctx, w, color)
      break
    case 'squiggle':
      drawSquiggle(ctx, w, color)
      break
    case 'speech':
      drawSpeech(ctx, w, color, text)
      break
    case 'banner':
      drawBanner(ctx, w, color, text)
      break
  }
}
