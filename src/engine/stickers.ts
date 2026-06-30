// Sticker catalog. Each sticker draws itself centered at the current canvas
// origin, filling a target width `w` (px); `measure` returns its bounding box
// so the transform handles and hit-testing can size it.

export type StickerCategory =
  | 'cute'
  | 'letters'
  | 'doodle'
  | 'collage'
  | 'shapes'
  | 'tape'
  | 'label'

export interface StickerDef {
  id: string
  label: string
  category: StickerCategory
  hasColor: boolean
  hasText: boolean
  defaultColor: string
  defaultText?: string
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
// ---------- Cute / scrapbook stickers ----------

// Glossy puffy heart with a soft highlight.
function drawPuffyHeart(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  drawHeart(ctx, w * 0.96)
  // inner shading for volume
  const g = ctx.createRadialGradient(-w * 0.12, -w * 0.18, w * 0.02, 0, 0, w * 0.6)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.4, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(0,0,0,0.12)')
  ctx.fillStyle = g
  drawHeart(ctx, w * 0.96)
  // glossy spec highlight
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.ellipse(-w * 0.15, -w * 0.18, w * 0.1, w * 0.06, -0.5, 0, PI2)
  ctx.fill()
  ctx.restore()
}

// Heart-shaped button with two stitch holes (scrapbook craft button).
function drawHeartButton(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  drawHeart(ctx, w * 0.96)
  // subtle inner ring + two holes
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.11, -w * 0.02, w * 0.05, 0, PI2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.ellipse(-w * 0.16, -w * 0.2, w * 0.08, w * 0.05, -0.5, 0, PI2)
  ctx.fill()
}

// Faceted gem / diamond with shine — the "gems/diamonds" look.
function drawGem(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const top = -w * 0.34
  const tableY = -w * 0.16
  const tl = -w * 0.34
  const tr = w * 0.34
  const bx = 0
  const by = w * 0.46
  // crown table
  const tableL = -w * 0.2
  const tableR = w * 0.2
  ctx.fillStyle = color
  poly(ctx, [
    [tl, top],
    [tr, top],
    [tr, tableY],
    [bx, by],
    [tl, tableY],
  ])
  // lighter table facet
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  poly(ctx, [
    [tableL, top],
    [tableR, top],
    [tableR, tableY],
    [tableL, tableY],
  ])
  // facet lines
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'
  ctx.lineWidth = w * 0.015
  ctx.beginPath()
  ctx.moveTo(tl, tableY); ctx.lineTo(tr, tableY)
  ctx.moveTo(tableL, top); ctx.lineTo(tableL, tableY); ctx.lineTo(bx, by)
  ctx.moveTo(tableR, top); ctx.lineTo(tableR, tableY); ctx.lineTo(bx, by)
  ctx.moveTo(tl, tableY); ctx.lineTo(bx, by)
  ctx.moveTo(tr, tableY); ctx.lineTo(bx, by)
  ctx.stroke()
  // outline
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = w * 0.02
  poly(ctx, [[tl, top], [tr, top], [tr, tableY], [bx, by], [tl, tableY]])
  ctx.stroke()
  // sparkle glint
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  star4(ctx, w * 0.26, -w * 0.05, w * 0.12)
}

// Round brilliant jewel (gem variant).
function drawJewel(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, PI2)
  ctx.fill()
  // facets
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = w * 0.015
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI2
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(a) * w * 0.42, Math.sin(a) * w * 0.42)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.22, 0, PI2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = w * 0.02
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.42, 0, PI2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  star4(ctx, -w * 0.12, -w * 0.12, w * 0.1)
}

// Four-point sparkle/twinkle (filled), positioned at (cx,cy) with radius r.
function star4(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(cx, cy - r)
  ctx.quadraticCurveTo(cx + r * 0.16, cy - r * 0.16, cx + r, cy)
  ctx.quadraticCurveTo(cx + r * 0.16, cy + r * 0.16, cx, cy + r)
  ctx.quadraticCurveTo(cx - r * 0.16, cy + r * 0.16, cx - r, cy)
  ctx.quadraticCurveTo(cx - r * 0.16, cy - r * 0.16, cx, cy - r)
  ctx.closePath()
  ctx.fill()
}

// 5-petal cherry blossom with notched petals (pastel flower).
function drawBlossom(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const pr = w * 0.22
  const dist = w * 0.24
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI2 - Math.PI / 2
    const px = Math.cos(a) * dist
    const py = Math.sin(a) * dist
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(a + Math.PI / 2)
    // heart-ish notched petal
    ctx.beginPath()
    ctx.moveTo(0, pr * 0.9)
    ctx.bezierCurveTo(pr * 1.1, pr * 0.2, pr * 0.5, -pr, 0, -pr * 0.35)
    ctx.bezierCurveTo(-pr * 0.5, -pr, -pr * 1.1, pr * 0.2, 0, pr * 0.9)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  // center cluster
  ctx.fillStyle = '#ffd84d'
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.1, 0, PI2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,160,60,0.8)'
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * w * 0.06, Math.sin(a) * w * 0.06, w * 0.018, 0, PI2)
    ctx.fill()
  }
}

// Flower-shaped button (craft button) with 4 stitch holes.
function drawFlowerButton(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * w * 0.24, Math.sin(a) * w * 0.24, w * 0.16, 0, PI2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.26, 0, PI2)
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.16)'
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * PI2 + Math.PI / 4
    ctx.beginPath()
    ctx.arc(Math.cos(a) * w * 0.1, Math.sin(a) * w * 0.1, w * 0.035, 0, PI2)
    ctx.fill()
  }
}

// Puffy rounded star with highlight.
function drawPuffyStar(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.save()
  ctx.fillStyle = color
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.lineWidth = w * 0.18
  // draw star path then stroke+fill for rounded points
  const r = w * 0.36
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.46
    const a = (i / 10) * PI2 - Math.PI / 2
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.ellipse(-w * 0.08, -w * 0.12, w * 0.09, w * 0.05, -0.5, 0, PI2)
  ctx.fill()
  ctx.restore()
}

// Cute bunny head (Miffy-style: white, long ears, dot eyes, x mouth).
function drawBunny(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = w * 0.018
  // ears
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(sx * w * 0.16, -w * 0.32, w * 0.1, w * 0.24, sx * 0.12, 0, PI2)
    ctx.fill()
    ctx.stroke()
  }
  // head
  ctx.beginPath()
  ctx.arc(0, w * 0.08, w * 0.3, 0, PI2)
  ctx.fill()
  ctx.stroke()
  // face: two dot eyes + x mouth
  ctx.fillStyle = '#3a2b2b'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.12, w * 0.04, w * 0.028, 0, PI2)
    ctx.fill()
  }
  ctx.strokeStyle = '#3a2b2b'
  ctx.lineWidth = w * 0.02
  ctx.lineCap = 'round'
  const mx = 0, my = w * 0.16, s = w * 0.05
  ctx.beginPath()
  ctx.moveTo(mx - s, my - s); ctx.lineTo(mx + s, my + s)
  ctx.moveTo(mx + s, my - s); ctx.lineTo(mx - s, my + s)
  ctx.stroke()
  // cheeks
  ctx.fillStyle = 'rgba(255,150,170,0.6)'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.2, w * 0.13, w * 0.04, 0, PI2)
    ctx.fill()
  }
}

// Cute bear head.
function drawBear(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = w * 0.018
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.26, -w * 0.2, w * 0.12, 0, PI2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(0, w * 0.02, w * 0.34, 0, PI2)
  ctx.fill()
  ctx.stroke()
  // inner ears
  ctx.fillStyle = 'rgba(255,150,170,0.6)'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.26, -w * 0.2, w * 0.055, 0, PI2)
    ctx.fill()
  }
  // muzzle
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.ellipse(0, w * 0.14, w * 0.16, w * 0.12, 0, 0, PI2)
  ctx.fill()
  // eyes + nose
  ctx.fillStyle = '#3a2b2b'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.13, w * 0.0, w * 0.03, 0, PI2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, w * 0.1, w * 0.04, 0, PI2)
  ctx.fill()
}

// Cute cat head.
function drawCat(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = w * 0.018
  // ears (triangles)
  for (const sx of [-1, 1]) {
    poly(ctx, [
      [sx * w * 0.1, -w * 0.22],
      [sx * w * 0.34, -w * 0.42],
      [sx * w * 0.32, -w * 0.12],
    ])
  }
  ctx.beginPath()
  ctx.arc(0, w * 0.04, w * 0.32, 0, PI2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#3a2b2b'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.12, w * 0.0, w * 0.028, 0, PI2)
    ctx.fill()
  }
  // nose
  ctx.fillStyle = '#ff8fa3'
  poly(ctx, [[-w * 0.03, w * 0.1], [w * 0.03, w * 0.1], [0, w * 0.14]])
  // whiskers
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = w * 0.014
  for (const sx of [-1, 1]) {
    for (const dy of [-0.02, 0.04]) {
      ctx.beginPath()
      ctx.moveTo(sx * w * 0.1, w * 0.1 + w * dy)
      ctx.lineTo(sx * w * 0.34, w * 0.08 + w * dy * 1.6)
      ctx.stroke()
    }
  }
}

// Cute ribbon bow (rounded loops + tails) — distinct from the simple bow.
function drawRibbon(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'
  ctx.lineWidth = w * 0.016
  // tails
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(sx * w * 0.05, w * 0.05)
    ctx.lineTo(sx * w * 0.22, w * 0.42)
    ctx.lineTo(sx * w * 0.04, w * 0.36)
    ctx.closePath()
    ctx.fill()
  }
  // loops
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.bezierCurveTo(sx * w * 0.18, -w * 0.34, sx * w * 0.54, -w * 0.18, sx * w * 0.44, w * 0.02)
    ctx.bezierCurveTo(sx * w * 0.54, w * 0.2, sx * w * 0.2, w * 0.18, 0, 0)
    ctx.closePath()
    ctx.fill()
  }
  // knot
  ctx.beginPath()
  ctx.fillStyle = color
  roundRectPath(ctx, -w * 0.08, -w * 0.1, w * 0.16, w * 0.2, w * 0.05)
  ctx.fill()
  // loop shading
  ctx.fillStyle = 'rgba(0,0,0,0.1)'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(sx * w * 0.28, -w * 0.04)
    ctx.lineTo(sx * w * 0.26, w * 0.06)
    ctx.closePath()
    ctx.fill()
  }
}

// Pair of cherries.
function drawCherry(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.strokeStyle = '#5a8f3c'
  ctx.lineWidth = w * 0.04
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-w * 0.18, w * 0.16)
  ctx.quadraticCurveTo(w * 0.02, -w * 0.36, 0, -w * 0.4)
  ctx.moveTo(w * 0.2, w * 0.18)
  ctx.quadraticCurveTo(w * 0.06, -w * 0.34, 0, -w * 0.4)
  ctx.stroke()
  // leaf
  ctx.fillStyle = '#6bbf4a'
  ctx.beginPath()
  ctx.ellipse(w * 0.12, -w * 0.4, w * 0.12, w * 0.06, -0.6, 0, PI2)
  ctx.fill()
  // berries
  ctx.fillStyle = color
  for (const cx of [-w * 0.18, w * 0.2]) {
    ctx.beginPath()
    ctx.arc(cx, w * 0.24, w * 0.16, 0, PI2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  for (const cx of [-w * 0.18, w * 0.2]) {
    ctx.beginPath()
    ctx.arc(cx - w * 0.05, w * 0.18, w * 0.04, 0, PI2)
    ctx.fill()
  }
}

// Cute mushroom.
function drawMushroom(ctx: CanvasRenderingContext2D, w: number, color: string) {
  // stem
  ctx.fillStyle = '#f4ecd8'
  roundRectPath(ctx, -w * 0.13, 0, w * 0.26, w * 0.4, w * 0.08)
  ctx.fill()
  // cap
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-w * 0.4, w * 0.04)
  ctx.quadraticCurveTo(-w * 0.4, -w * 0.4, 0, -w * 0.4)
  ctx.quadraticCurveTo(w * 0.4, -w * 0.4, w * 0.4, w * 0.04)
  ctx.closePath()
  ctx.fill()
  // spots
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  for (const [sx, sy, sr] of [[-0.18, -0.12, 0.06], [0.14, -0.18, 0.05], [0.02, -0.02, 0.05], [-0.02, -0.26, 0.035]] as const) {
    ctx.beginPath()
    ctx.arc(w * sx, w * sy, w * sr, 0, PI2)
    ctx.fill()
  }
  // face
  ctx.fillStyle = '#3a2b2b'
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(sx * w * 0.1, w * 0.16, w * 0.025, 0, PI2)
    ctx.fill()
  }
}

// ---------- Ransom-note magazine cut-out letters ----------
const RANSOM_FONTS = [
  'Georgia, serif',
  '"Times New Roman", serif',
  'Arial, sans-serif',
  'Impact, sans-serif',
  '"Courier New", monospace',
  '"Playfair Display", serif',
]
// A broad set of paper colours/shades the cut-outs are clipped from.
const RANSOM_PAPERS = [
  '#f1ece0', '#ffffff', '#1c1c1c', '#2b2b2b', '#c8412f', '#a8281c',
  '#3f6fb0', '#21506e', '#e8b93c', '#f0d878', '#caa46a', '#8a6b40',
  '#d98cae', '#e7a9c6', '#6aa84f', '#3d7a3d', '#7c5cff', '#5b8db8',
  '#ff8a5c', '#5ec5c0',
]

// Curated paper shades offered in the UI when recolouring a cut-out letter.
export const LETTER_SHADES = [
  '#f1ece0', '#ffffff', '#1c1c1c', '#c8412f', '#3f6fb0',
  '#e8b93c', '#caa46a', '#d98cae', '#6aa84f', '#7c5cff',
]

// Pick readable ink (near-black or near-white) for a paper colour.
function contrastInk(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.6 ? '#1a1a1a' : '#f6f4ee'
}

// Deterministic torn-edge rectangle so each scrap looks hand-cut but stable.
function jaggedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, amp: number, seed: number) {
  const jag = (i: number) => ((Math.sin((i + seed) * 12.9898) * 43758.5453) % 1) * amp
  const step = Math.max(6, Math.min(w, h) / 6)
  let i = 0
  ctx.beginPath()
  for (let px = x; px < x + w; px += step) ctx.lineTo(px, y + jag(i++))
  for (let py = y; py < y + h; py += step) ctx.lineTo(x + w - jag(i++), py)
  for (let px = x + w; px > x; px -= step) ctx.lineTo(px, y + h - jag(i++))
  for (let py = y + h; py > y; py -= step) ctx.lineTo(x + jag(i++), py)
  ctx.closePath()
}

// `color` overrides the auto paper shade ('' / 'auto' keeps the per-letter mix).
function drawRansomLetter(ctx: CanvasRenderingContext2D, w: number, text: string, color?: string) {
  const ch = (text || 'A').trim().slice(0, 1) || 'A'
  const code = ch.charCodeAt(0)
  const auto = !color || color === 'auto'
  const bg = auto ? RANSOM_PAPERS[code % RANSOM_PAPERS.length] : color
  const ink = contrastInk(bg)
  const font = RANSOM_FONTS[code % RANSOM_FONTS.length]
  const h = w / 0.82
  const m = w * 0.05
  // torn paper scrap with a soft drop shadow
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = w * 0.04
  ctx.shadowOffsetY = w * 0.014
  ctx.fillStyle = bg
  jaggedRect(ctx, -w / 2 + m, -h / 2 + m, w - 2 * m, h - 2 * m, w * 0.05, code)
  ctx.fill()
  ctx.restore()
  // printed glyph
  ctx.fillStyle = ink
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${h * 0.6}px ${font}`
  ctx.fillText(ch, 0, h * 0.03)
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

// ----- Hand-drawn marker doodles (SCRL scrapbook vibe) -----
function marker(ctx: CanvasRenderingContext2D, w: number, color: string, lw = 0.072) {
  ctx.strokeStyle = color
  ctx.lineWidth = w * lw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
}
function dHeart(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  const s = w * 0.4
  ctx.beginPath()
  ctx.moveTo(0, s * 0.82)
  ctx.bezierCurveTo(s * 1.2, -s * 0.05, s * 0.55, -s * 1.05, 0, -s * 0.3)
  ctx.bezierCurveTo(-s * 0.55, -s * 1.05, -s * 1.2, -s * 0.05, 0, s * 0.82)
  ctx.closePath()
  ctx.stroke()
}
function dStarOutline(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  const R = w * 0.44
  const r = R * 0.44
  ctx.beginPath()
  for (let i = 0; i <= 10; i++) {
    const rad = i % 2 ? r : R
    const a = (i / 10) * PI2 - Math.PI / 2
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
}
function dSparkle(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  const R = w * 0.42
  const draw = (cx: number, cy: number, rr: number) => {
    ctx.beginPath()
    ctx.moveTo(cx, cy - rr)
    ctx.quadraticCurveTo(cx + rr * 0.16, cy - rr * 0.16, cx + rr, cy)
    ctx.quadraticCurveTo(cx + rr * 0.16, cy + rr * 0.16, cx, cy + rr)
    ctx.quadraticCurveTo(cx - rr * 0.16, cy + rr * 0.16, cx - rr, cy)
    ctx.quadraticCurveTo(cx - rr * 0.16, cy - rr * 0.16, cx, cy - rr)
    ctx.closePath()
    ctx.stroke()
  }
  draw(-w * 0.06, w * 0.04, R * 0.86)
  draw(w * 0.32, -w * 0.3, R * 0.34)
}
function dArrow(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  ctx.beginPath()
  ctx.moveTo(-w * 0.44, w * 0.16)
  ctx.bezierCurveTo(-w * 0.1, -w * 0.42, w * 0.18, -w * 0.34, w * 0.38, w * 0.04)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(w * 0.38, w * 0.04)
  ctx.lineTo(w * 0.14, w * 0.04)
  ctx.moveTo(w * 0.38, w * 0.04)
  ctx.lineTo(w * 0.32, -w * 0.2)
  ctx.stroke()
}
function dSwirl(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  ctx.beginPath()
  const steps = 70
  const turns = 2.3
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = t * turns * PI2
    const rad = t * w * 0.42
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.stroke()
}
function dCircleScribble(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color, 0.06)
  ctx.beginPath()
  const steps = 60
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const a = -0.4 + t * (PI2 + 0.9)
    const rad = w * 0.42 * (1 + t * 0.04)
    const x = Math.cos(a) * rad
    const y = Math.sin(a) * rad * 0.92
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
  }
  ctx.stroke()
}
function dLightningOutline(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  ctx.beginPath()
  ctx.moveTo(w * 0.12, -w * 0.46)
  ctx.lineTo(-w * 0.26, w * 0.06)
  ctx.lineTo(0, w * 0.06)
  ctx.lineTo(-w * 0.12, w * 0.46)
  ctx.lineTo(w * 0.28, -w * 0.1)
  ctx.lineTo(w * 0.02, -w * 0.1)
  ctx.closePath()
  ctx.stroke()
}
function dSun(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color)
  ctx.beginPath()
  ctx.arc(0, 0, w * 0.22, 0, PI2)
  ctx.stroke()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * PI2
    ctx.beginPath()
    ctx.moveTo(Math.cos(a) * w * 0.3, Math.sin(a) * w * 0.3)
    ctx.lineTo(Math.cos(a) * w * 0.45, Math.sin(a) * w * 0.45)
    ctx.stroke()
  }
}
function dCheck(ctx: CanvasRenderingContext2D, w: number, color: string) {
  marker(ctx, w, color, 0.1)
  ctx.beginPath()
  ctx.moveTo(-w * 0.36, w * 0.02)
  ctx.lineTo(-w * 0.08, w * 0.32)
  ctx.lineTo(w * 0.4, -w * 0.34)
  ctx.stroke()
}

// ----- Collage / scrapbook paper stickers -----
function stickyNote(ctx: CanvasRenderingContext2D, w: number, color: string) {
  const h = w * 0.92
  const fold = w * 0.2
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-w / 2, -h / 2)
  ctx.lineTo(w / 2, -h / 2)
  ctx.lineTo(w / 2, h / 2 - fold)
  ctx.lineTo(w / 2 - fold, h / 2)
  ctx.lineTo(-w / 2, h / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(0,0,0,0.13)'
  ctx.beginPath()
  ctx.moveTo(w / 2, h / 2 - fold)
  ctx.lineTo(w / 2 - fold, h / 2)
  ctx.lineTo(w / 2 - fold, h / 2 - fold)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'
  ctx.lineWidth = w * 0.012
  for (let i = 1; i <= 3; i++) {
    const y = -h / 2 + (h / 4.4) * i
    ctx.beginPath()
    ctx.moveTo(-w * 0.36, y)
    ctx.lineTo(w * 0.36, y)
    ctx.stroke()
  }
}
function ticket(ctx: CanvasRenderingContext2D, w: number, color: string, text?: string) {
  const h = w / 2.6
  ctx.fillStyle = color
  roundRectPath(ctx, -w / 2, -h / 2, w, h, h * 0.16)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.setLineDash([h * 0.14, h * 0.1])
  ctx.lineWidth = w * 0.012
  ctx.beginPath()
  ctx.moveTo(w * 0.24, -h / 2)
  ctx.lineTo(w * 0.24, h / 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = 'rgba(0,0,0,0.72)'
  ctx.font = `700 ${h * 0.3}px Arial, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text || 'ADMIT ONE', -w * 0.13, 0)
  ctx.save()
  ctx.translate(w * 0.37, 0)
  ctx.rotate(-Math.PI / 2)
  ctx.font = `700 ${h * 0.26}px Arial, sans-serif`
  ctx.fillText('★', 0, 0)
  ctx.restore()
}
function stampSticker(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = '#f7f3e9'
  roundRectPath(ctx, -w / 2, -w / 2, w, w, w * 0.04)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.setLineDash([w * 0.04, w * 0.035])
  ctx.lineWidth = w * 0.02
  ctx.strokeRect(-w * 0.4, -w * 0.4, w * 0.8, w * 0.8)
  ctx.setLineDash([])
  ctx.fillStyle = color
  roundRectPath(ctx, -w * 0.32, -w * 0.32, w * 0.64, w * 0.64, w * 0.02)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${w * 0.16}px Arial, sans-serif`
  ctx.fillText('SCRL', 0, -w * 0.13)
  fillStar(ctx, w * 0.3, 5, 0.42)
}
function sealSticker(ctx: CanvasRenderingContext2D, w: number, color: string) {
  ctx.fillStyle = color
  const n = 12
  const R = w * 0.32
  const br = w * 0.1
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI2
    ctx.beginPath()
    ctx.arc(Math.cos(a) * R, Math.sin(a) * R, br, 0, PI2)
    ctx.fill()
  }
  ctx.beginPath()
  ctx.arc(0, 0, R + br * 0.3, 0, PI2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  fillStar(ctx, w * 0.34, 5, 0.42)
}
function priceTag(ctx: CanvasRenderingContext2D, w: number, color: string, text?: string) {
  const h = w * 0.5
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-w / 2, 0)
  ctx.lineTo(-w / 2 + h * 0.55, -h / 2)
  ctx.lineTo(w / 2, -h / 2)
  ctx.lineTo(w / 2, h / 2)
  ctx.lineTo(-w / 2 + h * 0.55, h / 2)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.beginPath()
  ctx.arc(-w / 2 + h * 0.34, 0, h * 0.12, 0, PI2)
  ctx.fill()
  if (text) {
    ctx.fillStyle = '#fff'
    ctx.font = `700 ${h * 0.42}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, h * 0.1, 0)
  }
}

export const STICKERS: StickerDef[] = [
  // cute / scrapbook (flowers, hearts, gems, animals)
  { id: 'blossom', label: 'Blossom', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ffb6ce' },
  { id: 'flowerbtn', label: 'Flower button', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ffd1e0' },
  { id: 'puffyheart', label: 'Puffy heart', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ff6b9d' },
  { id: 'heartbtn', label: 'Heart button', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ffd24d' },
  { id: 'gem', label: 'Gem', category: 'cute', hasColor: true, hasText: false, defaultColor: '#7ec8ff' },
  { id: 'jewel', label: 'Jewel', category: 'cute', hasColor: true, hasText: false, defaultColor: '#c89bff' },
  { id: 'puffystar', label: 'Puffy star', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ffd24d' },
  { id: 'ribbon', label: 'Ribbon bow', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ff9ec2' },
  { id: 'bunny', label: 'Bunny', category: 'cute', hasColor: true, hasText: false, defaultColor: '#fafafa' },
  { id: 'bear', label: 'Bear', category: 'cute', hasColor: true, hasText: false, defaultColor: '#d9a86c' },
  { id: 'cat', label: 'Cat', category: 'cute', hasColor: true, hasText: false, defaultColor: '#f4c07a' },
  { id: 'cherry', label: 'Cherries', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ff4d5e' },
  { id: 'mushroom', label: 'Mushroom', category: 'cute', hasColor: true, hasText: false, defaultColor: '#ff6b6b' },
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
  { id: 'pin', label: 'Location pin', category: 'label', hasColor: false, hasText: true, defaultColor: '#ffffff', defaultText: 'Location', aspect: 3 },
  { id: 'datestamp', label: 'Date stamp', category: 'label', hasColor: true, hasText: true, defaultColor: '#ffb300', defaultText: "'24 ▸" },
  // hand-drawn marker doodles
  { id: 'd_star', label: 'Star', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  { id: 'd_heart', label: 'Heart', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#ff3b67' },
  { id: 'd_sparkle', label: 'Sparkle', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  { id: 'arrowdoodle', label: 'Arrow', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  { id: 'd_swirl', label: 'Swirl', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  { id: 'd_circle', label: 'Circle', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#ff3b30' },
  { id: 'd_bolt', label: 'Bolt', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  { id: 'd_sun', label: 'Sun', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  { id: 'd_check', label: 'Check', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#34c759' },
  { id: 'squiggle', label: 'Underline', category: 'doodle', hasColor: true, hasText: false, defaultColor: '#1a1a1a' },
  // collage / scrapbook paper
  { id: 'note', label: 'Sticky note', category: 'collage', hasColor: true, hasText: false, defaultColor: '#fff7a8' },
  { id: 'ticket', label: 'Ticket', category: 'collage', hasColor: true, hasText: true, defaultColor: '#ff8a5c', defaultText: 'ADMIT ONE', aspect: 2.6 },
  { id: 'stamp', label: 'Stamp', category: 'collage', hasColor: true, hasText: false, defaultColor: '#e0322b' },
  { id: 'seal', label: 'Seal', category: 'collage', hasColor: true, hasText: false, defaultColor: '#ff3b67' },
  { id: 'tag', label: 'Price tag', category: 'collage', hasColor: true, hasText: true, defaultColor: '#ff8fb1', defaultText: '$24', aspect: 2 },
  { id: 'filmlabel', label: 'Film label', category: 'collage', hasColor: false, hasText: false, defaultColor: '#f5c518', aspect: 2.6 },
  // labels
  { id: 'speech', label: 'Speech', category: 'label', hasColor: true, hasText: true, defaultColor: '#ffffff', defaultText: 'hi!', aspect: 1.6 },
  { id: 'banner', label: 'Banner', category: 'label', hasColor: true, hasText: true, defaultColor: '#ff3b67', defaultText: 'NEW', aspect: 3.4 },
]

// Magazine ransom-note cut-out letters & numbers — each is a torn paper scrap
// with a printed glyph; the paper/ink/font vary per character for an authentic
// clipped-from-a-magazine scrapbook look. Uppercase, lowercase and digits.
const RANSOM_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
for (const ch of RANSOM_CHARS) {
  STICKERS.push({
    id: `letter:${ch}`,
    label: ch,
    category: 'letters',
    hasColor: false,
    hasText: true,
    defaultColor: 'auto', // per-letter paper mix; user can override the shade
    defaultText: ch,
    aspect: 0.82,
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
  if (id.startsWith('letter:')) {
    drawRansomLetter(ctx, w, text ?? def.defaultText ?? id.slice(7), color)
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
    case 'arrowdoodle':
      dArrow(ctx, w, color)
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
    case 'd_star':
      dStarOutline(ctx, w, color)
      break
    case 'd_heart':
      dHeart(ctx, w, color)
      break
    case 'd_sparkle':
      dSparkle(ctx, w, color)
      break
    case 'd_swirl':
      dSwirl(ctx, w, color)
      break
    case 'd_circle':
      dCircleScribble(ctx, w, color)
      break
    case 'd_bolt':
      dLightningOutline(ctx, w, color)
      break
    case 'd_sun':
      dSun(ctx, w, color)
      break
    case 'd_check':
      dCheck(ctx, w, color)
      break
    case 'note':
      stickyNote(ctx, w, color)
      break
    case 'ticket':
      ticket(ctx, w, color, text)
      break
    case 'stamp':
      stampSticker(ctx, w, color)
      break
    case 'seal':
      sealSticker(ctx, w, color)
      break
    case 'tag':
      priceTag(ctx, w, color, text)
      break
    case 'blossom':
      drawBlossom(ctx, w, color)
      break
    case 'flowerbtn':
      drawFlowerButton(ctx, w, color)
      break
    case 'puffyheart':
      drawPuffyHeart(ctx, w, color)
      break
    case 'heartbtn':
      drawHeartButton(ctx, w, color)
      break
    case 'gem':
      drawGem(ctx, w, color)
      break
    case 'jewel':
      drawJewel(ctx, w, color)
      break
    case 'puffystar':
      drawPuffyStar(ctx, w, color)
      break
    case 'ribbon':
      drawRibbon(ctx, w, color)
      break
    case 'bunny':
      drawBunny(ctx, w, color)
      break
    case 'bear':
      drawBear(ctx, w, color)
      break
    case 'cat':
      drawCat(ctx, w, color)
      break
    case 'cherry':
      drawCherry(ctx, w, color)
      break
    case 'mushroom':
      drawMushroom(ctx, w, color)
      break
  }
}
