// Core data model for the editor.
// The entire edited state is described declaratively here so it can be
// snapshotted for undo/redo and re-rendered deterministically from the
// original source image.

export interface Adjustments {
  brightness: number // -100..100
  contrast: number // -100..100
  saturation: number // -100..100
  exposure: number // -100..100
  temperature: number // -100..100 (blue <-> orange)
  tint: number // -100..100 (green <-> magenta)
  highlights: number // -100..100
  shadows: number // -100..100
  vibrance: number // -100..100
  hue: number // -180..180 (degrees)
  sharpen: number // 0..100
  blur: number // 0..20 (px radius)
  vignette: number // 0..100
  grain: number // 0..100
  grayscale: number // 0..100
  sepia: number // 0..100
  invert: number // 0..100
  // Levels / tone
  blackPoint: number // 0..255
  whitePoint: number // 0..255
  gamma: number // 0.1..3.0
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  temperature: 0,
  tint: 0,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  hue: 0,
  sharpen: 0,
  blur: 0,
  vignette: 0,
  grain: 0,
  grayscale: 0,
  sepia: 0,
  invert: 0,
  blackPoint: 0,
  whitePoint: 255,
  gamma: 1,
}

export interface Transform {
  rotation: number // degrees, free
  flipH: boolean
  flipV: boolean
  // Crop rectangle in normalized [0..1] coordinates of the source image.
  crop: { x: number; y: number; width: number; height: number }
}

export const DEFAULT_TRANSFORM: Transform = {
  rotation: 0,
  flipH: false,
  flipV: false,
  crop: { x: 0, y: 0, width: 1, height: 1 },
}

export interface TextLayer {
  id: string
  type: 'text'
  text: string
  x: number // normalized 0..1 (center)
  y: number // normalized 0..1 (center)
  fontSize: number // px relative to a 1000px reference width
  fontFamily: string
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  opacity: number // 0..1
  rotation: number // degrees
}

export interface DrawLayer {
  id: string
  type: 'draw'
  color: string
  size: number // brush size in source px
  points: Array<{ x: number; y: number }> // normalized 0..1
  opacity: number // 0..1
}

export type Layer = TextLayer | DrawLayer

export interface FilterPreset {
  name: string
  adjustments: Partial<Adjustments>
}

// ----- Premium: Selective Color (HSL) -----
// Eight color bands, each with hue shift / saturation / luminance offsets.
export const HSL_BANDS = [
  'red',
  'orange',
  'yellow',
  'green',
  'aqua',
  'blue',
  'purple',
  'magenta',
] as const
export type HslBand = (typeof HSL_BANDS)[number]

export interface HslChannel {
  h: number // -100..100 hue shift
  s: number // -100..100 saturation
  l: number // -100..100 luminance
}

export type SelectiveColor = Record<HslBand, HslChannel>

export function createSelectiveColor(): SelectiveColor {
  const out = {} as SelectiveColor
  for (const b of HSL_BANDS) out[b] = { h: 0, s: 0, l: 0 }
  return out
}

// ----- Premium: Tone Curves -----
export interface CurvePoint {
  x: number // 0..255 input
  y: number // 0..255 output
}
export type CurveChannel = 'rgb' | 'r' | 'g' | 'b'
export type Curves = Record<CurveChannel, CurvePoint[]>

export function createCurves(): Curves {
  const linear: CurvePoint[] = [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ]
  return {
    rgb: linear.map((p) => ({ ...p })),
    r: linear.map((p) => ({ ...p })),
    g: linear.map((p) => ({ ...p })),
    b: linear.map((p) => ({ ...p })),
  }
}

// ----- Premium: Texture overlays -----
export type LeakStyle = 'warm' | 'sunset' | 'cool' | 'rainbow'
export interface TextureSettings {
  lightLeak: number // 0..100
  leakStyle: LeakStyle
  leakAngle: number // 0..360 which corner/side
  dust: number // 0..100
  bokeh: number // 0..100
}
export function createTexture(): TextureSettings {
  return { lightLeak: 0, leakStyle: 'warm', leakAngle: 45, dust: 0, bokeh: 0 }
}

// ----- Premium: Borders & frames -----
export type FrameType = 'none' | 'solid' | 'rounded' | 'film' | 'polaroid'
export interface FrameSettings {
  type: FrameType
  size: number // 0..25 (percent of min dimension)
  color: string
}
export function createFrame(): FrameSettings {
  return { type: 'none', size: 6, color: '#ffffff' }
}

// A full, serializable description of an edit session.
export interface EditorDocument {
  adjustments: Adjustments
  transform: Transform
  layers: Layer[]
  activeFilter: string | null
  selectiveColor: SelectiveColor
  curves: Curves
  texture: TextureSettings
  frame: FrameSettings
}

export function createEmptyDocument(): EditorDocument {
  return {
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    transform: { ...DEFAULT_TRANSFORM, crop: { ...DEFAULT_TRANSFORM.crop } },
    layers: [],
    activeFilter: null,
    selectiveColor: createSelectiveColor(),
    curves: createCurves(),
    texture: createTexture(),
    frame: createFrame(),
  }
}

export type ToolId =
  | 'adjust'
  | 'filters'
  | 'curves'
  | 'selective'
  | 'crop'
  | 'retouch'
  | 'text'
  | 'draw'
  | 'texture'
  | 'frame'
  | 'ai'
  | 'export'
