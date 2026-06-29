// Geometry helpers for selecting and transforming layers. All boxes are
// returned in canvas-bitmap pixels (the editor maps them to screen).

import type { Layer, TextLayer } from '../types'
import { imageEffectiveRatio } from '../types'
import { measureSticker } from './stickers'

export interface LayerBox {
  cx: number
  cy: number
  w: number
  h: number
  rot: number // degrees
}

const mctx = document.createElement('canvas').getContext('2d')!

function textBox(layer: TextLayer, canvasW: number): { w: number; h: number } {
  const scale = canvasW / 1000
  const px = layer.fontSize * scale
  const lines = layer.text.split('\n')
  let maxW = px
  if (layer.style === 'plain') {
    mctx.font = `${layer.italic ? 'italic ' : ''}${layer.bold ? 'bold ' : ''}${px}px ${layer.fontFamily}`
    for (const l of lines) maxW = Math.max(maxW, mctx.measureText(l).width)
    return { w: maxW, h: lines.length * px * 1.2 }
  }
  if (layer.style === 'bubble') {
    const d = px
    const gap = px * 0.14
    for (const l of lines) {
      const n = [...l].length
      maxW = Math.max(maxW, n * (d + gap) - gap)
    }
    return { w: maxW, h: lines.length * px * 1.25 }
  }
  // cut-out
  mctx.font = `800 ${px}px Georgia, serif`
  const pad = px * 0.16
  for (const l of lines) {
    let total = 0
    for (const c of [...l]) total += mctx.measureText(c).width + pad * 2
    maxW = Math.max(maxW, total)
  }
  return { w: maxW, h: lines.length * px * 1.4 }
}

export function layerBox(
  layer: Layer,
  canvasW: number,
  canvasH: number,
): LayerBox | null {
  let w = 0
  let h = 0
  if (layer.type === 'image') {
    w = layer.scale * canvasW
    h = w / imageEffectiveRatio(layer)
  } else if (layer.type === 'sticker') {
    const m = measureSticker(mctx, layer.sticker, layer.scale * canvasW, layer.text)
    w = m.w
    h = m.h
  } else if (layer.type === 'text') {
    const m = textBox(layer, canvasW)
    w = m.w
    h = m.h
  } else {
    return null // draw layers aren't transformable
  }
  return { cx: layer.x * canvasW, cy: layer.y * canvasH, w, h, rot: layer.rotation }
}

// Is the canvas-px point inside the (rotated) layer box?
export function hitLayer(
  layer: Layer,
  px: number,
  py: number,
  canvasW: number,
  canvasH: number,
): boolean {
  const b = layerBox(layer, canvasW, canvasH)
  if (!b) return false
  const rad = (-b.rot * Math.PI) / 180
  const dx = px - b.cx
  const dy = py - b.cy
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
  const m = Math.max(b.w, b.h) * 0.08 + 6 // small touch margin
  return Math.abs(lx) <= b.w / 2 + m && Math.abs(ly) <= b.h / 2 + m
}
