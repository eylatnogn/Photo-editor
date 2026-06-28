// The rendering pipeline: turns a source image + EditorDocument into pixels
// on a target canvas. Kept framework-agnostic so it can be reused for the
// live preview and for full-resolution export.

import type { Adjustments, EditorDocument, Layer } from '../types'
import { DEFAULT_ADJUSTMENTS } from '../types'
import {
  applyAdjustments,
  applyGrain,
  applySharpen,
  applyVignette,
} from './filters'
import { getPreset } from './presets'

export type RenderSource =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap

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

/**
 * Render the full document into `target`. Returns the output dimensions.
 */
export function renderDocument(
  src: RenderSource,
  doc: EditorDocument,
  target: HTMLCanvasElement,
): RenderResult {
  const transformed = applyTransform(src, doc)
  const w = transformed.width
  const h = transformed.height
  const adj = effectiveAdjustments(doc)

  target.width = w
  target.height = h
  const ctx = target.getContext('2d')!

  // Blur is cheapest via the native canvas filter while blitting.
  if (adj.blur > 0) {
    ctx.filter = `blur(${adj.blur}px)`
    ctx.drawImage(transformed, 0, 0)
    ctx.filter = 'none'
  } else {
    ctx.drawImage(transformed, 0, 0)
  }

  const hasPixelWork =
    !isIdentity(adj) || adj.sharpen > 0 || adj.vignette > 0 || adj.grain > 0

  if (hasPixelWork) {
    const imageData = ctx.getImageData(0, 0, w, h)
    applyAdjustments(imageData.data, adj)
    if (adj.sharpen > 0) {
      const sharpened = applySharpen(imageData.data, w, h, adj.sharpen)
      imageData.data.set(sharpened)
    }
    applyVignette(imageData.data, w, h, adj.vignette)
    applyGrain(imageData.data, w, adj.grain)
    ctx.putImageData(imageData, 0, 0)
  }

  drawLayers(ctx, doc.layers, w, h)

  return { width: w, height: h }
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
