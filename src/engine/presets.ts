import type { FilterPreset } from '../types'

// One-click filter presets. Each is just a partial set of adjustments layered
// on top of the user's manual edits at render time.
export const FILTER_PRESETS: FilterPreset[] = [
  { name: 'Original', adjustments: {} },
  {
    name: 'Vivid',
    adjustments: { saturation: 25, contrast: 15, vibrance: 20, sharpen: 15 },
  },
  {
    name: 'Mono',
    adjustments: { grayscale: 100, contrast: 12 },
  },
  {
    name: 'Noir',
    adjustments: { grayscale: 100, contrast: 35, blackPoint: 25, vignette: 40 },
  },
  {
    name: 'Vintage',
    adjustments: { sepia: 45, contrast: -8, saturation: -15, vignette: 30, grain: 20 },
  },
  {
    name: 'Warm',
    adjustments: { temperature: 35, saturation: 10, highlights: -10 },
  },
  {
    name: 'Cool',
    adjustments: { temperature: -35, tint: -10, saturation: 5 },
  },
  {
    name: 'Fade',
    adjustments: { contrast: -20, blackPoint: 30, saturation: -20, brightness: 8 },
  },
  {
    name: 'Pop',
    adjustments: { saturation: 40, vibrance: 30, contrast: 20, sharpen: 25 },
  },
  {
    name: 'Dramatic',
    adjustments: { contrast: 45, shadows: 30, highlights: -25, vignette: 35, sharpen: 20 },
  },
  {
    name: 'Sunset',
    adjustments: { temperature: 45, tint: 12, saturation: 20, shadows: 15 },
  },
  {
    name: 'Invert',
    adjustments: { invert: 100 },
  },
]

export function getPreset(name: string | null): FilterPreset | undefined {
  if (!name) return undefined
  return FILTER_PRESETS.find((p) => p.name === name)
}
