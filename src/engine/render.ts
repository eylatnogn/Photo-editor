// The rendering pipeline: turns a source image + EditorDocument into pixels
// on a target canvas. Kept framework-agnostic so it can be reused for the
// live preview and for full-resolution export.

import type {
  Adjustments,
  EditorDocument,
  Layer,
  TextLayer,
  TextureSettings,
  FrameSettings,
} from '../types'
import { DEFAULT_ADJUSTMENTS, imageEffectiveRatio } from '../types'
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
import { getImage } from './imageCache'
import { drawSticker } from './stickers'

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
    if (layer.hidden) continue
    if (layer.type === 'text') {
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.translate(layer.x * width, layer.y * height)
      if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180)
      drawText(ctx, layer, scale)
      ctx.restore()
    } else if (layer.type === 'image') {
      const img = getImage(layer.src)
      if (!img) continue // re-renders once the image loads
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.translate(layer.x * width, layer.y * height)
      if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180)
      const wpx = layer.scale * width
      const hpx = wpx / imageEffectiveRatio(layer)
      drawFramedImage(ctx, img, wpx, hpx, layer.frame, layer.crop)
      ctx.restore()
    } else if (layer.type === 'sticker') {
      ctx.save()
      ctx.globalAlpha = layer.opacity
      ctx.translate(layer.x * width, layer.y * height)
      if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180)
      drawSticker(ctx, layer.sticker, layer.scale * width, layer.color, layer.text)
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

// ----- Text rendering (plain / magazine cut-out / bubble) -----
const CUTOUT_PAPERS = ['#f4efe3', '#e9e2d0', '#ffffff', '#ddd6c4']

function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer, scale: number) {
  const px = layer.fontSize * scale
  const lines = layer.text.split('\n')

  if (layer.style === 'plain') {
    ctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${px}px ${layer.fontFamily}`
    ctx.fillStyle = layer.color
    ctx.textAlign = layer.align
    ctx.textBaseline = 'middle'
    const lh = px * 1.2
    const startY = -((lines.length - 1) * lh) / 2
    lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lh))
    return
  }

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const lh = layer.style === 'bubble' ? px * 1.25 : px * 1.4
  const startY = -((lines.length - 1) * lh) / 2

  lines.forEach((line, li) => {
    const y = startY + li * lh
    const chars = [...line]
    if (layer.style === 'bubble') {
      const d = px
      const gap = px * 0.14
      const total = chars.length * (d + gap) - gap
      let cx = -total / 2 + d / 2
      for (const ch of chars) {
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(cx, y, d / 2, 0, Math.PI * 2)
        ctx.fill()
        if (ch.trim()) {
          ctx.fillStyle = layer.color
          ctx.font = `800 ${px * 0.6}px ${layer.fontFamily}`
          ctx.fillText(ch.toUpperCase(), cx, y)
        }
        cx += d + gap
      }
    } else {
      // cut-out
      ctx.font = `800 ${px}px Georgia, 'Times New Roman', serif`
      const pad = px * 0.16
      const widths = chars.map((c) => ctx.measureText(c).width)
      const advances = widths.map((w) => w + pad * 2)
      const total = advances.reduce((a, b) => a + b, 0)
      let cx = -total / 2
      chars.forEach((ch, i) => {
        const aw = advances[i]
        const cw = widths[i]
        ctx.save()
        ctx.translate(cx + aw / 2, y)
        ctx.rotate((((i * 53) % 9) - 4) * 0.012)
        if (ch.trim()) {
          ctx.fillStyle = CUTOUT_PAPERS[i % CUTOUT_PAPERS.length]
          ctx.fillRect(-cw / 2 - pad, -px * 0.62, cw + pad * 2, px * 1.24)
          ctx.fillStyle = layer.color
          ctx.fillText(ch, 0, 0)
        }
        ctx.restore()
        cx += aw
      })
    }
  })
}

function imgDims(img: CanvasImageSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight }
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap)
    return { w: img.width, h: img.height }
  const c = img as HTMLCanvasElement
  return { w: c.width, h: c.height }
}

// ----- Image-layer frames -----
export function drawFramedImage(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  frame: import('../types').ImageFrame,
  crop?: { x: number; y: number; width: number; height: number },
) {
  const draw = () => {
    if (crop && (crop.x > 0 || crop.y > 0 || crop.width < 1 || crop.height < 1)) {
      const { w: iw, h: ih } = imgDims(img)
      ctx.drawImage(
        img,
        crop.x * iw,
        crop.y * ih,
        crop.width * iw,
        crop.height * ih,
        -w / 2,
        -h / 2,
        w,
        h,
      )
    } else {
      ctx.drawImage(img, -w / 2, -h / 2, w, h)
    }
  }
  if (frame === 'none') {
    draw()
    return
  }
  if (frame === 'white') {
    const b = w * 0.04
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.28)'
    ctx.shadowBlur = w * 0.04
    ctx.shadowOffsetY = w * 0.016
    ctx.fillStyle = '#fff'
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b)
    ctx.restore()
    draw()
    return
  }
  if (frame === 'polaroid') {
    const b = w * 0.05
    const bottom = w * 0.22
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = w * 0.05
    ctx.shadowOffsetY = w * 0.02
    // very slight off-white paper with a top-to-bottom tonal shift
    const paper = ctx.createLinearGradient(0, -h / 2 - b, 0, h / 2 + bottom)
    paper.addColorStop(0, '#ffffff')
    paper.addColorStop(1, '#f3f2ec')
    ctx.fillStyle = paper
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + b + bottom)
    ctx.restore()
    draw()
    // faint inner shadow where the photo meets the paper
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'
    ctx.lineWidth = w * 0.004
    ctx.strokeRect(-w / 2, -h / 2, w, h)
    return
  }
  if (frame === 'tape') {
    const b = w * 0.03
    ctx.fillStyle = '#fff'
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b)
    draw()
    // two tape strips on the top corners
    const tw = w * 0.3
    const th = tw * 0.34
    for (const sx of [-1, 1]) {
      ctx.save()
      ctx.translate((sx * w) / 2.4, -h / 2 - b)
      ctx.rotate(sx * 0.5)
      ctx.fillStyle = 'rgba(231,216,168,0.62)'
      ctx.fillRect(-tw / 2, -th / 2, tw, th)
      ctx.restore()
    }
    return
  }
  if (frame === 'film' || frame === 'negative') {
    // 35mm frame — black for B&W film, orange mask for a colour negative.
    const b = w * 0.13
    const neg = frame === 'negative'
    ctx.fillStyle = neg ? '#a4521f' : '#0c0c0c'
    ctx.fillRect(-w / 2 - b, -h / 2 - b * 1.4, w + 2 * b, h + 2 * b * 1.4)
    draw()
    // sprocket holes
    ctx.fillStyle = neg ? 'rgba(20,12,6,0.85)' : 'rgba(238,236,228,0.92)'
    const holeW = b * 0.42
    const holeH = b * 0.5
    const gap = holeW * 1.9
    for (let x = -w / 2; x < w / 2 - holeW; x += gap) {
      ctx.fillRect(x, -h / 2 - b * 1.05, holeW, holeH)
      ctx.fillRect(x, h / 2 + b * 1.05 - holeH, holeW, holeH)
    }
    // frame markings: "SCRL 400" at the corners, a frame number, sprocket arrow
    const orange = neg ? 'rgba(60,32,14,0.95)' : 'rgba(226,150,40,0.95)'
    ctx.fillStyle = orange
    ctx.font = `${b * 0.4}px "Courier New", monospace`
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.fillText('SCRL 400', -w / 2 + b * 0.1, -h / 2 - b * 0.55)
    ctx.textAlign = 'right'
    ctx.fillText('SCRL 400', w / 2 - b * 0.1, -h / 2 - b * 0.55)
    ctx.textAlign = 'center'
    ctx.font = `bold ${b * 0.5}px "Courier New", monospace`
    ctx.fillText('48', 0, -h / 2 - b * 0.55)
    ctx.textAlign = 'left'
    ctx.font = `${b * 0.42}px "Courier New", monospace`
    ctx.fillText('▸ 6', -w / 2 + b * 0.1, h / 2 + b * 0.6)
    ctx.textAlign = 'right'
    ctx.fillText('6 ▸', w / 2 - b * 0.1, h / 2 + b * 0.6)
    return
  }

  if (frame === 'sticker') {
    // Glossy die-cut photo sticker: thick white outline that hugs the photo,
    // a soft drop shadow so it lifts off the page, and a diagonal laminate sheen.
    const b = w * 0.06
    const outerR = Math.min(w, h) * 0.14 + b
    const innerR = Math.min(w, h) * 0.1
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.34)'
    ctx.shadowBlur = w * 0.05
    ctx.shadowOffsetX = w * 0.012
    ctx.shadowOffsetY = w * 0.022
    ctx.fillStyle = '#ffffff'
    roundRect(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, outerR)
    ctx.fill()
    ctx.restore()
    // photo, rounded to match the die-cut
    ctx.save()
    roundRect(ctx, -w / 2, -h / 2, w, h, innerR)
    ctx.clip()
    draw()
    ctx.restore()
    // hairline between photo and white edge
    ctx.strokeStyle = 'rgba(0,0,0,0.07)'
    ctx.lineWidth = w * 0.004
    roundRect(ctx, -w / 2, -h / 2, w, h, innerR)
    ctx.stroke()
    // laminate sheen across the whole sticker
    ctx.save()
    roundRect(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, outerR)
    ctx.clip()
    const sheen = ctx.createLinearGradient(-w / 2 - b, -h / 2 - b, w * 0.15, h * 0.05)
    sheen.addColorStop(0, 'rgba(255,255,255,0.4)')
    sheen.addColorStop(0.16, 'rgba(255,255,255,0.12)')
    sheen.addColorStop(0.32, 'rgba(255,255,255,0)')
    ctx.fillStyle = sheen
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b)
    ctx.restore()
    return
  }

  if (frame === 'rounded') {
    // Soft rounded-corner photo card with a gentle drop shadow (modern, clean).
    const r = Math.min(w, h) * 0.1
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = w * 0.045
    ctx.shadowOffsetY = w * 0.02
    ctx.fillStyle = '#000'
    roundRect(ctx, -w / 2, -h / 2, w, h, r)
    ctx.fill()
    ctx.restore()
    ctx.save()
    roundRect(ctx, -w / 2, -h / 2, w, h, r)
    ctx.clip()
    draw()
    // soft top sheen
    const gl = ctx.createLinearGradient(0, -h / 2, 0, h * 0.1)
    gl.addColorStop(0, 'rgba(255,255,255,0.12)')
    gl.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gl
    ctx.fillRect(-w / 2, -h / 2, w, h)
    ctx.restore()
    return
  }

  if (frame === 'torn') {
    // Torn-paper scrapbook mat: a white deckle-edged border with a soft shadow.
    const b = w * 0.06
    const ox = -w / 2 - b
    const oy = -h / 2 - b
    const ow = w + 2 * b
    const oh = h + 2 * b
    // deterministic jagged offset so the edge looks hand-torn but stable
    const jag = (i: number, amp: number) => (Math.sin(i * 12.9898) * 43758.5453 % 1) * amp
    const step = Math.max(8, ow / 26)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = w * 0.045
    ctx.shadowOffsetY = w * 0.018
    ctx.fillStyle = '#fbfaf5'
    ctx.beginPath()
    let i = 0
    for (let x = ox; x < ox + ow; x += step) { ctx.lineTo(x, oy + jag(i++, b * 0.7)); }
    for (let y = oy; y < oy + oh; y += step) { ctx.lineTo(ox + ow - jag(i++, b * 0.7), y); }
    for (let x = ox + ow; x > ox; x -= step) { ctx.lineTo(x, oy + oh - jag(i++, b * 0.7)); }
    for (let y = oy + oh; y > oy; y -= step) { ctx.lineTo(ox + jag(i++, b * 0.7), y); }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    // faint torn-edge shading
    ctx.strokeStyle = 'rgba(180,170,150,0.5)'
    ctx.lineWidth = w * 0.004
    ctx.stroke()
    draw()
    return
  }

  if (frame === 'camera') {
    drawCameraFrame(ctx, w, h, draw)
    return
  }

  if (frame === 'vignette') {
    // Aged cream border with a soft dark vignette over the photo.
    const b = w * 0.05
    ctx.fillStyle = '#efe6d2'
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b)
    draw()
    const r = Math.hypot(w, h) / 2
    const g = ctx.createRadialGradient(0, 0, r * 0.45, 0, 0, r)
    g.addColorStop(0, 'rgba(40,24,12,0)')
    g.addColorStop(1, 'rgba(30,18,8,0.55)')
    ctx.fillStyle = g
    ctx.fillRect(-w / 2, -h / 2, w, h)
    // warm overlay for a faded look
    ctx.fillStyle = 'rgba(210,180,120,0.12)'
    ctx.fillRect(-w / 2, -h / 2, w, h)
    return
  }

  if (frame === 'scallop') {
    // Classic deckle / scalloped white print border.
    const b = w * 0.06
    ctx.fillStyle = '#fcfbf6'
    scallopPath(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, b * 0.9)
    ctx.fill()
    draw()
    return
  }

  if (frame === 'retro') {
    // Thick white border with a 90s orange date stamp.
    const b = w * 0.045
    ctx.fillStyle = '#fff'
    ctx.fillRect(-w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b)
    draw()
    ctx.save()
    ctx.font = `${w * 0.06}px "Courier New", monospace`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.shadowColor = 'rgba(255,140,0,0.9)'
    ctx.shadowBlur = w * 0.02
    ctx.fillStyle = '#ffb300'
    ctx.fillText("'24 10 14", w / 2 - w * 0.03, h / 2 - w * 0.03)
    ctx.restore()
    return
  }

  draw()
}

// A realistic compact digital camera seen from the back: the photo is the LCD,
// with a brushed-metal body, recessed screen, mode dial, D-pad and buttons —
// rendered with layered gradients, bevels and soft shadows to avoid a flat,
// clip-art look. Extends to the right of and above the photo.
function drawCameraFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  draw: () => void,
) {
  const TAU = Math.PI * 2
  const b = w * 0.05 // screen bezel
  const ctrlW = w * 0.5 // control column to the right
  const topH = h * 0.2
  const botH = h * 0.12
  const left = -w / 2 - b
  const top = -h / 2 - topH
  const bw = w + b + ctrlW + b
  const bh = h + topH + botH
  const rad = w * 0.045
  const cx = w / 2 + ctrlW * 0.5 // control column centre

  // soft contact shadow under the whole body
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = w * 0.05
  ctx.shadowOffsetY = w * 0.025
  ctx.fillStyle = '#c2c5c9'
  roundRect(ctx, left, top, bw, bh, rad)
  ctx.fill()
  ctx.restore()

  // brushed-metal body: vertical sheen + faint horizontal banding
  const body = ctx.createLinearGradient(0, top, 0, top + bh)
  body.addColorStop(0, '#f4f6f7')
  body.addColorStop(0.18, '#dfe2e6')
  body.addColorStop(0.5, '#c4c8cd')
  body.addColorStop(0.82, '#d3d6da')
  body.addColorStop(1, '#a7abb1')
  ctx.fillStyle = body
  roundRect(ctx, left, top, bw, bh, rad)
  ctx.fill()
  ctx.save()
  roundRect(ctx, left, top, bw, bh, rad)
  ctx.clip()
  ctx.globalAlpha = 0.05
  ctx.strokeStyle = '#5a5e64'
  ctx.lineWidth = 1
  for (let y = top + 2; y < top + bh; y += 3) {
    ctx.beginPath()
    ctx.moveTo(left, y)
    ctx.lineTo(left + bw, y)
    ctx.stroke()
  }
  ctx.restore()
  // top edge highlight + bottom shade for a rounded, machined feel
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'
  ctx.lineWidth = w * 0.005
  ctx.beginPath()
  ctx.moveTo(left + rad, top + ctx.lineWidth)
  ctx.lineTo(left + bw - rad, top + ctx.lineWidth)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'
  roundRect(ctx, left, top, bw, bh, rad)
  ctx.stroke()

  // --- top deck: optical viewfinder, mic holes, zoom rocker, shutter ---
  // viewfinder window (recessed dark glass with a glint)
  const vfx = left + w * 0.05
  const vfy = top + topH * 0.24
  const vfw = w * 0.2
  const vfh = topH * 0.4
  ctx.fillStyle = '#2b2e33'
  roundRect(ctx, vfx, vfy, vfw, vfh, vfh * 0.18)
  ctx.fill()
  const vfg = ctx.createLinearGradient(vfx, vfy, vfx + vfw, vfy + vfh)
  vfg.addColorStop(0, 'rgba(150,180,210,0.55)')
  vfg.addColorStop(0.5, 'rgba(40,50,60,0.1)')
  vfg.addColorStop(1, 'rgba(20,24,30,0.5)')
  ctx.fillStyle = vfg
  roundRect(ctx, vfx, vfy, vfw, vfh, vfh * 0.18)
  ctx.fill()
  // mic / speaker holes
  ctx.fillStyle = 'rgba(60,64,70,0.6)'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.arc(left + w * 0.33 + i * w * 0.028, top + topH * 0.42, w * 0.006, 0, TAU)
    ctx.fill()
  }
  // shutter button (raised metal cylinder) + zoom rocker around it
  const shx = w / 2 + ctrlW * 0.52
  const shy = top + topH * 0.46
  ctx.fillStyle = '#8b8f95'
  ctx.beginPath()
  ctx.arc(shx, shy, topH * 0.34, 0, TAU)
  ctx.fill()
  const sht = ctx.createRadialGradient(shx, shy - topH * 0.1, topH * 0.04, shx, shy, topH * 0.28)
  sht.addColorStop(0, '#fbfcfd')
  sht.addColorStop(0.6, '#c9ccd1')
  sht.addColorStop(1, '#8d9197')
  ctx.fillStyle = sht
  ctx.beginPath()
  ctx.arc(shx, shy, topH * 0.26, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = w * 0.003
  ctx.stroke()

  // --- LCD: recessed black bezel, inset shadow, photo, glass glare ---
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = b * 0.5
  ctx.fillStyle = '#141416'
  roundRect(ctx, -w / 2 - b, -h / 2 - b, w + 2 * b, h + 2 * b, b * 0.35)
  ctx.fill()
  ctx.restore()
  // thin inner bezel rim
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = w * 0.004
  roundRect(ctx, -w / 2 - b * 0.5, -h / 2 - b * 0.5, w + b, h + b, b * 0.25)
  ctx.stroke()
  draw()
  // subtle screen glare across the photo (glossy LCD)
  ctx.save()
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.clip()
  const glare = ctx.createLinearGradient(-w / 2, -h / 2, w * 0.1, h * 0.2)
  glare.addColorStop(0, 'rgba(255,255,255,0.16)')
  glare.addColorStop(0.22, 'rgba(255,255,255,0.05)')
  glare.addColorStop(0.4, 'rgba(255,255,255,0)')
  ctx.fillStyle = glare
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.restore()
  // on-screen UI hints (record dot + battery) for authenticity
  ctx.fillStyle = 'rgba(255,60,60,0.9)'
  ctx.beginPath()
  ctx.arc(-w / 2 + w * 0.06, -h / 2 + w * 0.06, w * 0.012, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'
  ctx.lineWidth = w * 0.006
  roundRect(ctx, w / 2 - w * 0.11, -h / 2 + w * 0.04, w * 0.06, w * 0.032, w * 0.006)
  ctx.stroke()

  // engraved brand under the screen (dark + light offset = emboss)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 ${botH * 0.42}px Arial, sans-serif`
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.fillText('SCRL', 0.6, h / 2 + botH * 0.52 + 0.6)
  ctx.fillStyle = 'rgba(70,74,80,0.95)'
  ctx.fillText('SCRL', 0, h / 2 + botH * 0.52)

  // --- right control column ---
  // mode dial (knurled rim + radial face)
  const dialY = -h * 0.24
  const dialR = w * 0.11
  ctx.fillStyle = '#83878d'
  ctx.beginPath()
  ctx.arc(cx, dialY, dialR, 0, TAU)
  ctx.fill()
  // knurling ticks
  ctx.strokeStyle = 'rgba(40,44,50,0.5)'
  ctx.lineWidth = w * 0.004
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * dialR * 0.86, dialY + Math.sin(a) * dialR * 0.86)
    ctx.lineTo(cx + Math.cos(a) * dialR, dialY + Math.sin(a) * dialR)
    ctx.stroke()
  }
  const dialFace = ctx.createRadialGradient(cx, dialY - dialR * 0.3, dialR * 0.1, cx, dialY, dialR * 0.85)
  dialFace.addColorStop(0, '#eef0f2')
  dialFace.addColorStop(1, '#a9adb3')
  ctx.fillStyle = dialFace
  ctx.beginPath()
  ctx.arc(cx, dialY, dialR * 0.82, 0, TAU)
  ctx.fill()
  // dial indicator
  ctx.strokeStyle = '#3a3d42'
  ctx.lineWidth = w * 0.008
  ctx.beginPath()
  ctx.moveTo(cx, dialY)
  ctx.lineTo(cx, dialY - dialR * 0.7)
  ctx.stroke()

  // 4-way D-pad with raised buttons + centre OK
  const padY = h * 0.16
  const padR = w * 0.15
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = w * 0.02
  ctx.shadowOffsetY = w * 0.006
  const ring = ctx.createRadialGradient(cx, padY - padR * 0.4, padR * 0.2, cx, padY, padR)
  ring.addColorStop(0, '#d6d9dd')
  ring.addColorStop(1, '#9da1a7')
  ctx.fillStyle = ring
  ctx.beginPath()
  ctx.arc(cx, padY, padR, 0, TAU)
  ctx.fill()
  ctx.restore()
  // cross grooves
  ctx.strokeStyle = 'rgba(70,74,80,0.35)'
  ctx.lineWidth = w * 0.004
  for (const a of [0, Math.PI / 2]) {
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * padR * 0.5, padY + Math.sin(a) * padR * 0.5)
    ctx.lineTo(cx - Math.cos(a) * padR * 0.5, padY - Math.sin(a) * padR * 0.5)
    ctx.stroke()
  }
  const okg = ctx.createRadialGradient(cx, padY - padR * 0.18, padR * 0.05, cx, padY, padR * 0.42)
  okg.addColorStop(0, '#f0f2f4')
  okg.addColorStop(1, '#b6babf')
  ctx.fillStyle = okg
  ctx.beginPath()
  ctx.arc(cx, padY, padR * 0.4, 0, TAU)
  ctx.fill()

  // two pill buttons (play / menu) above the pad
  ctx.fillStyle = '#9a9ea4'
  for (const dy of [-h * 0.02, h * 0.4]) {
    roundRect(ctx, cx - w * 0.15, padY + dy - h * 0.34, w * 0.08, h * 0.03, h * 0.015)
    ctx.fill()
    roundRect(ctx, cx + w * 0.07, padY + dy - h * 0.34, w * 0.08, h * 0.03, h * 0.015)
    ctx.fill()
  }
}

// A rounded-bump (scalloped) rectangle path.
function scallopPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const nx = Math.max(2, Math.round(w / (r * 2)))
  const ny = Math.max(2, Math.round(h / (r * 2)))
  const sx = w / nx
  const sy = h / ny
  ctx.beginPath()
  ctx.moveTo(x, y + sy / 2)
  for (let i = 0; i < nx; i++) ctx.arc(x + sx * (i + 0.5), y, sx / 2, Math.PI, 0, false)
  for (let i = 0; i < ny; i++) ctx.arc(x + w, y + sy * (i + 0.5), sy / 2, -Math.PI / 2, Math.PI / 2, false)
  for (let i = nx - 1; i >= 0; i--) ctx.arc(x + sx * (i + 0.5), y + h, sx / 2, 0, Math.PI, false)
  for (let i = ny - 1; i >= 0; i--) ctx.arc(x, y + sy * (i + 0.5), sy / 2, Math.PI / 2, -Math.PI / 2, false)
  ctx.closePath()
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
