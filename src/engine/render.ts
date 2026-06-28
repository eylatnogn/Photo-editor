// The rendering pipeline: turns a source image + EditorDocument into pixels
// on a target canvas. Kept framework-agnostic so it can be reused for the
// live preview and for full-resolution export.

import type {
  Adjustments,
  EditorDocument,
  Layer,
  TextureSettings,
  FrameSettings,
} from '../types'
import { DEFAULT_ADJUSTMENTS } from '../types'
import {
  applyAdjustments,
  applyCurves,
  applyGrain,
  applySelectiveColor,
  applySharpen,
  applyVignette,
  curvesAreIdentity,
  selectiveColorIsIdentity,
} from './filters'
import { getPreset } from './presets'

export type RenderSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap

// Optional destructive pixel layers (retouch tools) composited into the
// source before any non-destructive editing is applied.
export interface BaseLayers {
  heal?: HTMLCanvasElement | null
  erase?: HTMLCanvasElement | null
}

function sourceWidth(src: RenderSource): number {
  return src instanceof HTMLImageElement ? src.naturalWidth : src.width
}
function sourceHeight(src: RenderSource): number {
  return src instanceof HTMLImageElement ? src.naturalHeight : src.height
}

const clampField = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v

// Combine the user's adjustments with the active filter preset (additive).
function effectiveAdjustments(doc: EditorDocument): Adjustments {
  const base = doc.adjustments
  const preset = getPreset(doc.activeFilter)
  if (!preset) return base
  const out: Adjustments = { ...base }
  const p = preset.adjustments
  ;(Object.keys(p) as (keyof Adjustments)[]).forEach((k) => {
    out[k] = base[k] + (p[k] as number)
  })
  // Re-clamp the fields the presets touch.
  out.brightness = clampField(out.brightness, -100, 100)
  out.contrast = clampField(out.contrast, -100, 100)
  out.saturation = clampField(out.saturation, -100, 100)
  out.vibrance = clampField(out.vibrance, -100, 100)
  out.temperature = clampField(out.temperature, -100, 100)
  out.tint = clampField(out.tint, -100, 100)
  out.highlights = clampField(out.highlights, -100, 100)
  out.shadows = clampField(out.shadows, -100, 100)
  out.sharpen = clampField(out.sharpen, 0, 100)
  out.vignette = clampField(out.vignette, 0, 100)
  out.grain = clampField(out.grain, 0, 100)
  out.grayscale = clampField(out.grayscale, 0, 100)
  out.sepia = clampField(out.sepia, 0, 100)
  out.invert = clampField(out.invert, 0, 100)
  out.blackPoint = clampField(out.blackPoint, 0, 254)
  return out
}

// Produce the geometric result of crop + flip + rotation as a canvas.
function applyTransform(src: RenderSource, doc: EditorDocument): HTMLCanvasElement {
  const sw = sourceWidth(src)
  const sh = sourceHeight(src)
  const { crop, flipH, flipV, rotation } = doc.transform

  const cx = Math.round(crop.x * sw)
  const cy = Math.round(crop.y * sh)
  const cw = Math.max(1, Math.round(crop.width * sw))
  const ch = Math.max(1, Math.round(crop.height * sh))

  // First draw the cropped + flipped image at native crop size.
  const cropped = document.createElement('canvas')
  cropped.width = cw
  cropped.height = ch
  const cctx = cropped.getContext('2d')!
  cctx.save()
  cctx.translate(flipH ? cw : 0, flipV ? ch : 0)
  cctx.scale(flipH ? -1 : 1, flipV ? -1 : 1)
  cctx.drawImage(src as CanvasImageSource, cx, cy, cw, ch, 0, 0, cw, ch)
  cctx.restore()

  if (!rotation) return cropped

  // Rotate into a canvas sized to the rotated bounding box.
  const rad = (rotation * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const rw = Math.ceil(cw * cos + ch * sin)
  const rh = Math.ceil(cw * sin + ch * cos)
  const rotated = document.createElement('canvas')
  rotated.width = rw
  rotated.height = rh
  const rctx = rotated.getContext('2d')!
  rctx.translate(rw / 2, rh / 2)
  rctx.rotate(rad)
  rctx.drawImage(cropped, -cw / 2, -ch / 2)
  return rotated
}

function drawLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  width: number,
  height: number,
) {
  // Font sizes in the data model are relative to a 1000px-wide reference.
  const scale = width / 1000
  for (const layer of layers) {
    if (layer.type === 'text') {
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.translate(layer.x * width, layer.y * height)
      if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180)
      const px = layer.fontSize * scale
      ctx.font = `${layer.italic ? 'italic ' : ''}${
        layer.bold ? 'bold ' : ''
      }${px}px ${layer.fontFamily}`
      ctx.fillStyle = layer.color
      ctx.textAlign = layer.align
      ctx.textBaseline = 'middle'
      const lines = layer.text.split('\n')
      const lineHeight = px * 1.2
      const startY = -((lines.length - 1) * lineHeight) / 2
      lines.forEach((line, i) => {
        ctx.fillText(line, 0, startY + i * lineHeight)
      })
      ctx.restore()
    } else if (layer.type === 'draw') {
      if (layer.points.length < 1) continue
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.strokeStyle = layer.color
      ctx.fillStyle = layer.color
      ctx.lineWidth = layer.size * scale
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      const p0 = layer.points[0]
      ctx.moveTo(p0.x * width, p0.y * height)
      if (layer.points.length === 1) {
        ctx.arc(p0.x * width, p0.y * height, ctx.lineWidth / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        for (let i = 1; i < layer.points.length; i++) {
          ctx.lineTo(layer.points[i].x * width, layer.points[i].y * height)
        }
        ctx.stroke()
      }
      ctx.restore()
    }
  }
}

export interface RenderResult {
  width: number
  height: number
}

// Composite the retouch (heal) and erase layers into the source.
function buildBaseSource(
  src: RenderSource,
  layers?: BaseLayers,
): RenderSource {
  if (!layers || (!layers.heal && !layers.erase)) return src
  const w = sourceWidth(src)
  const h = sourceHeight(src)
  const base = document.createElement('canvas')
  base.width = w
  base.height = h
  const ctx = base.getContext('2d')!
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h)
  if (layers.erase) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(layers.erase, 0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'
  }
  if (layers.heal) {
    ctx.drawImage(layers.heal, 0, 0, w, h)
  }
  return base
}

/**
 * Render the full document into `target`. Returns the output dimensions.
 */
export function renderDocument(
  src: RenderSource,
  doc: EditorDocument,
  target: HTMLCanvasElement,
  layers?: BaseLayers,
): RenderResult {
  const baseSource = buildBaseSource(src, layers)
  const transformed = applyTransform(baseSource, doc)
  const w = transformed.width
  const h = transformed.height
  const adj = effectiveAdjustments(doc)

  // Render into a working canvas; a frame (if any) is applied afterwards.
  const work = document.createElement('canvas')
  work.width = w
  work.height = h
  const ctx = work.getContext('2d')!

  // Blur is cheapest via the native canvas filter while blitting.
  if (adj.blur > 0) {
    ctx.filter = `blur(${adj.blur}px)`
    ctx.drawImage(transformed, 0, 0)
    ctx.filter = 'none'
  } else {
    ctx.drawImage(transformed, 0, 0)
  }

  const hasPixelWork =
    !isIdentity(adj) ||
    adj.sharpen > 0 ||
    adj.vignette > 0 ||
    adj.grain > 0 ||
    !curvesAreIdentity(doc.curves) ||
    !selectiveColorIsIdentity(doc.selectiveColor)

  if (hasPixelWork) {
    const imageData = ctx.getImageData(0, 0, w, h)
    applyAdjustments(imageData.data, adj)
    applySelectiveColor(imageData.data, doc.selectiveColor)
    applyCurves(imageData.data, doc.curves)
    if (adj.sharpen > 0) {
      const sharpened = applySharpen(imageData.data, w, h, adj.sharpen)
      imageData.data.set(sharpened)
    }
    applyVignette(imageData.data, w, h, adj.vignette)
    applyGrain(imageData.data, w, adj.grain)
    ctx.putImageData(imageData, 0, 0)
  }

  drawTextures(ctx, doc.texture, w, h)
  drawLayers(ctx, doc.layers, w, h)

  // Apply frame as a final post-process (changes output dimensions).
  applyFrame(work, doc.frame, target)

  return { width: target.width, height: target.height }
}

// Small deterministic PRNG so textures are stable across re-renders.
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LEAK_COLORS: Record<string, string[]> = {
  warm: ['rgba(255,180,80,A)', 'rgba(255,90,40,A)'],
  sunset: ['rgba(255,120,170,A)', 'rgba(255,170,80,A)'],
  cool: ['rgba(120,200,255,A)', 'rgba(80,120,255,A)'],
  rainbow: ['rgba(255,100,160,A)', 'rgba(120,220,180,A)'],
}

function drawTextures(
  ctx: CanvasRenderingContext2D,
  tex: TextureSettings,
  w: number,
  h: number,
) {
  const maxDim = Math.max(w, h)

  // --- Light leak ---
  if (tex.lightLeak > 0) {
    const a = tex.lightLeak / 100
    const rad = (tex.leakAngle * Math.PI) / 180
    const cx = w * (0.5 + 0.55 * Math.sin(rad))
    const cy = h * (0.5 - 0.55 * Math.cos(rad))
    const colors = LEAK_COLORS[tex.leakStyle] ?? LEAK_COLORS.warm
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxDim * 0.9)
    grad.addColorStop(0, colors[0].replace('A', String(0.55 * a)))
    grad.addColorStop(0.4, colors[1].replace('A', String(0.35 * a)))
    grad.addColorStop(1, colors[1].replace('A', '0'))
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // --- Bokeh (soft glowing circles) ---
  if (tex.bokeh > 0) {
    const a = tex.bokeh / 100
    const rng = mulberry32(1337)
    const count = Math.round(18 * a) + 6
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    for (let i = 0; i < count; i++) {
      const x = rng() * w
      const y = rng() * h
      const r = (0.03 + rng() * 0.08) * maxDim
      const alpha = (0.05 + rng() * 0.18) * a
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(255,255,255,${alpha})`)
      g.addColorStop(0.7, `rgba(255,250,230,${alpha * 0.4})`)
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  // --- Dust & scratches ---
  if (tex.dust > 0) {
    const a = tex.dust / 100
    const rng = mulberry32(9001)
    ctx.save()
    ctx.globalCompositeOperation = 'screen'
    // specks
    const specks = Math.round(maxDim * 0.5 * a)
    ctx.fillStyle = `rgba(255,255,255,${0.5 * a})`
    for (let i = 0; i < specks; i++) {
      const x = rng() * w
      const y = rng() * h
      const s = rng() * 1.6 + 0.4
      ctx.globalAlpha = rng() * 0.6 * a
      ctx.fillRect(x, y, s, s)
    }
    // scratches
    ctx.globalAlpha = 1
    const scratches = Math.round(8 * a)
    ctx.strokeStyle = `rgba(255,255,255,${0.25 * a})`
    for (let i = 0; i < scratches; i++) {
      const x = rng() * w
      const len = (0.1 + rng() * 0.4) * h
      ctx.lineWidth = rng() * 1.2 + 0.3
      ctx.beginPath()
      ctx.moveTo(x, rng() * h)
      ctx.lineTo(x + (rng() - 0.5) * 8, rng() * h - len)
      ctx.stroke()
    }
    ctx.restore()
  }
}

// Wrap the rendered image in a border/frame, drawing into `target`.
function applyFrame(
  work: HTMLCanvasElement,
  frame: FrameSettings,
  target: HTMLCanvasElement,
) {
  const w = work.width
  const h = work.height
  if (frame.type === 'none' || frame.size <= 0) {
    target.width = w
    target.height = h
    target.getContext('2d')!.drawImage(work, 0, 0)
    return
  }

  const b = Math.round((frame.size / 100) * Math.min(w, h))
  // Polaroid has a tall bottom border.
  const bottom = frame.type === 'polaroid' ? b * 3.2 : b
  const ow = w + b * 2
  const oh = h + b + bottom
  target.width = ow
  target.height = oh
  const ctx = target.getContext('2d')!

  if (frame.type === 'film') {
    ctx.fillStyle = '#0c0c0c'
    ctx.fillRect(0, 0, ow, oh)
    ctx.drawImage(work, b, b)
    // sprocket holes
    ctx.fillStyle = 'rgba(245,245,245,0.92)'
    const holeW = b * 0.5
    const holeH = b * 0.32
    const gap = holeW * 1.8
    for (let x = b * 0.2; x < ow - holeW; x += gap) {
      ctx.fillRect(x, b * 0.28, holeW, holeH)
      ctx.fillRect(x, oh - bottom + b * 0.28 - (bottom - b), holeW, holeH)
      ctx.fillRect(x, oh - b * 0.28 - holeH, holeW, holeH)
    }
    return
  }

  // solid / rounded / polaroid
  ctx.fillStyle = frame.color
  ctx.fillRect(0, 0, ow, oh)

  if (frame.type === 'rounded') {
    const r = b * 0.8
    ctx.save()
    roundRect(ctx, b, b, w, h, r)
    ctx.clip()
    ctx.drawImage(work, b, b)
    ctx.restore()
  } else {
    ctx.drawImage(work, b, b)
  }
}

function roundRect(
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

// True when no color adjustments would change a pixel.
function isIdentity(adj: Adjustments): boolean {
  const keys = Object.keys(DEFAULT_ADJUSTMENTS) as (keyof Adjustments)[]
  for (const k of keys) {
    if (k === 'sharpen' || k === 'blur' || k === 'vignette' || k === 'grain')
      continue
    if (adj[k] !== DEFAULT_ADJUSTMENTS[k]) return false
  }
  return true
}
