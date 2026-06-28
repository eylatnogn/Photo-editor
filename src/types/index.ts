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

// A full, serializable description of an edit session.
export interface EditorDocument {
  adjustments: Adjustments
  transform: Transform
  layers: Layer[]
  activeFilter: string | null
}

export function createEmptyDocument(): EditorDocument {
  return {
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    transform: { ...DEFAULT_TRANSFORM, crop: { ...DEFAULT_TRANSFORM.crop } },
    layers: [],
    activeFilter: null,
  }
}

export type ToolId =
  | 'adjust'
  | 'filters'
  | 'crop'
  | 'text'
  | 'draw'
  | 'ai'
  | 'export'
