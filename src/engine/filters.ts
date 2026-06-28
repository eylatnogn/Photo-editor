// Pure pixel-processing routines. These operate directly on a
// Uint8ClampedArray of RGBA data so they can run on any canvas ImageData.

import type { Adjustments } from '../types'

const clamp = (v: number, lo = 0, hi = 255) => (v < lo ? lo : v > hi ? hi : v)

/**
 * Build a per-channel lookup table (0..255 -> 0..255) for all the
 * adjustments that act on each channel independently. Applying these via a
 * 256-entry LUT is dramatically faster than recomputing per pixel.
 */
function buildToneLUT(adj: Adjustments): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256)

  const exposure = Math.pow(2, adj.exposure / 100) // exposure stops-ish
  const brightness = adj.brightness * 1.275 // -> roughly -128..128
  const contrast = (adj.contrast / 100) * 1 // -1..1
  const contrastFactor = (1.015 * (contrast + 1)) / (1.015 - contrast)
  const black = adj.blackPoint
  const white = Math.max(adj.whitePoint, black + 1)
  const invGamma = 1 / adj.gamma

  for (let i = 0; i < 256; i++) {
    let v = i

    // Exposure (multiplicative) then brightness (additive)
    v = v * exposure + brightness

    // Contrast around mid-grey
    v = contrastFactor * (v - 128) + 128

    // Levels: remap [black, white] -> [0, 255] with gamma
    v = ((v - black) / (white - black)) * 255
    if (v < 0) v = 0
    if (v > 255) v = 255
    v = Math.pow(v / 255, invGamma) * 255

    lut[i] = clamp(v)
  }
  return lut
}

// RGB <-> HSL helpers (operate on 0..1)
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h /= 6
  }
  return [h, s, l]
}

function hue2rgb(p: number, q: number, t: number): number {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number
  let g: number
  let b: number
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return [r * 255, g * 255, b * 255]
}

/**
 * Apply all per-pixel color adjustments in-place.
 */
export function applyAdjustments(data: Uint8ClampedArray, adj: Adjustments): void {
  const lut = buildToneLUT(adj)

  const sat = 1 + adj.saturation / 100 // saturation multiplier
  const vibrance = adj.vibrance / 100
  const hueShift = adj.hue / 360 // fraction of the wheel
  const temp = adj.temperature / 100
  const tint = adj.tint / 100
  const highlights = adj.highlights / 100
  const shadows = adj.shadows / 100
  const grayscale = adj.grayscale / 100
  const sepia = adj.sepia / 100
  const invert = adj.invert / 100

  const needsHsl =
    adj.saturation !== 0 || adj.vibrance !== 0 || adj.hue !== 0
  const needsTone =
    adj.highlights !== 0 || adj.shadows !== 0

  for (let i = 0; i < data.length; i += 4) {
    let r = lut[data[i]]
    let g = lut[data[i + 1]]
    let b = lut[data[i + 2]]

    // White balance: temperature warms/cools, tint shifts green/magenta.
    if (temp !== 0) {
      r = clamp(r + temp * 40)
      b = clamp(b - temp * 40)
    }
    if (tint !== 0) {
      g = clamp(g - tint * 40)
    }

    // Highlight / shadow recovery based on luminance.
    if (needsTone) {
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      if (highlights !== 0) {
        const w = lum * lum // weight toward bright areas
        const f = 1 - highlights * w
        r *= f
        g *= f
        b *= f
      }
      if (shadows !== 0) {
        const w = (1 - lum) * (1 - lum)
        const add = shadows * w * 80
        r += add
        g += add
        b += add
      }
    }

    if (needsHsl) {
      let [h, s, l] = rgbToHsl(r, g, b)
      if (hueShift !== 0) {
        h = (h + hueShift) % 1
        if (h < 0) h += 1
      }
      if (sat !== 1) s *= sat
      if (vibrance !== 0) {
        // Vibrance boosts less-saturated pixels more.
        s += vibrance * (1 - s)
      }
      s = s < 0 ? 0 : s > 1 ? 1 : s
      ;[r, g, b] = hslToRgb(h, s, l)
    }

    // Grayscale mix
    if (grayscale > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      r = r + (lum - r) * grayscale
      g = g + (lum - g) * grayscale
      b = b + (lum - b) * grayscale
    }

    // Sepia mix
    if (sepia > 0) {
      const sr = 0.393 * r + 0.769 * g + 0.189 * b
      const sg = 0.349 * r + 0.686 * g + 0.168 * b
      const sb = 0.272 * r + 0.534 * g + 0.131 * b
      r = r + (sr - r) * sepia
      g = g + (sg - g) * sepia
      b = b + (sb - b) * sepia
    }

    // Invert mix
    if (invert > 0) {
      r = r + (255 - r - r) * invert
      g = g + (255 - g - g) * invert
      b = b + (255 - b - b) * invert
    }

    data[i] = clamp(r)
    data[i + 1] = clamp(g)
    data[i + 2] = clamp(b)
  }
}

/**
 * Sharpen using a 3x3 convolution kernel. `amount` is 0..100.
 */
export function applySharpen(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  if (amount <= 0) return src
  const a = amount / 100
  // Unsharp-ish kernel scaled by amount.
  const center = 1 + 4 * a
  const side = -a
  const out = new Uint8ClampedArray(src.length)
  const w4 = width * 4
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const idx = o + c
        let v = src[idx] * center
        if (x > 0) v += src[idx - 4] * side
        if (x < width - 1) v += src[idx + 4] * side
        if (y > 0) v += src[idx - w4] * side
        if (y < height - 1) v += src[idx + w4] * side
        out[idx] = clamp(v)
      }
      out[o + 3] = src[o + 3]
    }
  }
  return out
}

/**
 * Apply a darkening vignette toward the edges. `amount` is 0..100.
 */
export function applyVignette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0) return
  const a = amount / 100
  const cx = width / 2
  const cy = height / 2
  const maxDist = Math.sqrt(cx * cx + cy * cy)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist
      // Falloff: only darken outer region.
      const f = 1 - a * Math.pow(Math.max(0, dist - 0.3) / 0.7, 2)
      const o = (y * width + x) * 4
      data[o] *= f
      data[o + 1] *= f
      data[o + 2] *= f
    }
  }
}

/**
 * Add monochrome film grain. `amount` is 0..100. Deterministic per pixel so
 * re-renders are stable.
 */
export function applyGrain(
  data: Uint8ClampedArray,
  width: number,
  amount: number,
): void {
  if (amount <= 0) return
  const strength = (amount / 100) * 50
  for (let i = 0; i < data.length; i += 4) {
    const px = (i / 4) % width
    const py = Math.floor(i / 4 / width)
    // Cheap deterministic pseudo-noise.
    const n =
      (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1
    const noise = (n - Math.floor(n) - 0.5) * strength
    data[i] = clamp(data[i] + noise)
    data[i + 1] = clamp(data[i + 1] + noise)
    data[i + 2] = clamp(data[i + 2] + noise)
  }
}
