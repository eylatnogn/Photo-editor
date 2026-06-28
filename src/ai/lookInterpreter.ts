// Interprets a free-text "look" description and turns it into a concrete set
// of edits. Runs entirely locally — it's a keyword/intent parser, so nothing
// is sent anywhere. It recognises common photographic styles and modifiers
// (e.g. "warm vintage film", "very moody cinematic", "bright and airy").

import {
  DEFAULT_ADJUSTMENTS,
  createSelectiveColor,
  createTexture,
  type Adjustments,
  type EditorDocument,
  type HslBand,
} from '../types'

interface LookAccumulator {
  adj: Adjustments
  tex: ReturnType<typeof createTexture>
  sel: ReturnType<typeof createSelectiveColor>
}

interface Rule {
  label: string
  keywords: string[]
  apply: (acc: LookAccumulator, scale: number) => void
}

const RULES: Rule[] = [
  {
    label: 'Warm',
    keywords: ['warm', 'golden', 'cozy', 'cosy', 'sunny', 'summer', 'sun'],
    apply: (a, s) => {
      a.adj.temperature += 35 * s
      a.adj.highlights -= 5 * s
      a.adj.vibrance += 8 * s
    },
  },
  {
    label: 'Cool',
    keywords: ['cool', 'cold', 'icy', 'winter', 'arctic'],
    apply: (a, s) => {
      a.adj.temperature -= 35 * s
      a.adj.tint -= 8 * s
    },
  },
  {
    label: 'Cinematic teal & orange',
    keywords: ['cinematic', 'cinema', 'movie', 'film look', 'teal', 'blockbuster', 'hollywood'],
    apply: (a, s) => {
      a.adj.contrast += 24 * s
      a.adj.shadows += 18 * s
      a.adj.highlights -= 14 * s
      a.adj.vignette += 24 * s
      a.adj.temperature += 6 * s
      a.sel.blue.h += 22 * s
      a.sel.blue.s += 12 * s
      a.sel.orange.s += 16 * s
      a.sel.orange.l += 5 * s
    },
  },
  {
    label: 'Bright & airy',
    keywords: ['bright', 'airy', 'clean', 'fresh', 'white', 'minimal', 'crisp white'],
    apply: (a, s) => {
      a.adj.exposure += 14 * s
      a.adj.blackPoint += 12 * s
      a.adj.highlights += 10 * s
      a.adj.saturation += 5 * s
      a.adj.contrast -= 5 * s
    },
  },
  {
    label: 'Moody / dramatic',
    keywords: ['moody', 'dramatic', 'dark', 'dim', 'gloomy', 'broody'],
    apply: (a, s) => {
      a.adj.exposure -= 8 * s
      a.adj.contrast += 28 * s
      a.adj.shadows += 24 * s
      a.adj.highlights -= 18 * s
      a.adj.vignette += 34 * s
      a.adj.blackPoint += 10 * s
    },
  },
  {
    label: 'Vibrant / punchy',
    keywords: ['vibrant', 'punchy', 'pop', 'vivid', 'colorful', 'colourful', 'bold', 'saturated'],
    apply: (a, s) => {
      a.adj.saturation += 34 * s
      a.adj.vibrance += 30 * s
      a.adj.contrast += 14 * s
      a.adj.sharpen += 14 * s
    },
  },
  {
    label: 'Faded / matte',
    keywords: ['faded', 'matte', 'muted', 'desaturated', 'washed'],
    apply: (a, s) => {
      a.adj.saturation -= 25 * s
      a.adj.contrast -= 16 * s
      a.adj.blackPoint += 22 * s
      a.adj.highlights += 6 * s
    },
  },
  {
    label: 'Soft pastel / dreamy',
    keywords: ['pastel', 'dreamy', 'soft', 'ethereal', 'romantic'],
    apply: (a, s) => {
      a.adj.saturation -= 14 * s
      a.adj.contrast -= 12 * s
      a.adj.highlights += 12 * s
      a.adj.temperature += 6 * s
      a.tex.bokeh += 22 * s
    },
  },
  {
    label: 'Black & white',
    keywords: ['black and white', 'b&w', 'bw', 'monochrome', 'mono', 'grayscale', 'greyscale'],
    apply: (a, s) => {
      a.adj.grayscale = Math.max(a.adj.grayscale, 100)
      a.adj.contrast += 18 * s
    },
  },
  {
    label: 'Noir',
    keywords: ['noir', 'film noir'],
    apply: (a, s) => {
      a.adj.grayscale = 100
      a.adj.contrast += 30 * s
      a.adj.vignette += 35 * s
      a.adj.blackPoint += 14 * s
    },
  },
  {
    label: 'Vintage film',
    keywords: ['vintage', 'retro', 'film', 'analog', 'analogue', 'nostalgic', 'old', 'vsco', 'aesthetic', '70s', '80s', '90s'],
    apply: (a, s) => {
      a.adj.sepia += 28 * s
      a.adj.contrast -= 8 * s
      a.adj.saturation -= 12 * s
      a.adj.blackPoint += 20 * s
      a.adj.temperature += 12 * s
      a.adj.grain += 20 * s
      a.tex.dust += 24 * s
      a.tex.lightLeak += 28 * s
      a.tex.leakStyle = 'warm'
    },
  },
  {
    label: 'Sunset / autumn',
    keywords: ['sunset', 'autumn', 'fall', 'orange', 'amber'],
    apply: (a, s) => {
      a.adj.temperature += 40 * s
      a.adj.tint += 10 * s
      a.adj.saturation += 16 * s
      a.sel.orange.s += 20 * s
      a.tex.lightLeak += 18 * s
      a.tex.leakStyle = 'sunset'
    },
  },
  {
    label: 'Glow / bloom',
    keywords: ['glow', 'bloom', 'hazy', 'haze'],
    apply: (a, s) => {
      a.tex.bokeh += 30 * s
      a.adj.highlights += 12 * s
      a.adj.exposure += 6 * s
    },
  },
  {
    label: 'Sharp / detailed',
    keywords: ['sharp', 'detailed', 'hd', 'clarity', 'crisp'],
    apply: (a, s) => {
      a.adj.sharpen += 35 * s
      a.adj.contrast += 10 * s
    },
  },
  {
    label: 'Portrait / skin',
    keywords: ['portrait', 'skin', 'beauty', 'headshot', 'selfie'],
    apply: (a, s) => {
      a.adj.temperature += 6 * s
      a.adj.contrast += 6 * s
      a.adj.sharpen += 8 * s
      a.adj.vibrance += 8 * s
      a.sel.orange.s += 8 * s
      a.sel.orange.l += 4 * s
    },
  },
]

const AMPLIFIERS = ['very', 'extra', 'super', 'really', 'strong', 'strongly', 'heavy', 'heavily', 'intense', 'max']
const REDUCERS = ['subtle', 'subtly', 'slight', 'slightly', 'gentle', 'gently', 'mild', 'hint', 'touch']

const FIELD_RANGE: Partial<Record<keyof Adjustments, [number, number]>> = {
  brightness: [-100, 100],
  contrast: [-100, 100],
  saturation: [-100, 100],
  exposure: [-100, 100],
  temperature: [-100, 100],
  tint: [-100, 100],
  highlights: [-100, 100],
  shadows: [-100, 100],
  vibrance: [-100, 100],
  hue: [-180, 180],
  sharpen: [0, 100],
  blur: [0, 20],
  vignette: [0, 100],
  grain: [0, 100],
  grayscale: [0, 100],
  sepia: [0, 100],
  invert: [0, 100],
  blackPoint: [0, 120],
  whitePoint: [140, 255],
  gamma: [0.2, 2.5],
}

function clampAdjustments(adj: Adjustments) {
  ;(Object.keys(FIELD_RANGE) as (keyof Adjustments)[]).forEach((k) => {
    const [lo, hi] = FIELD_RANGE[k]!
    adj[k] = Math.max(lo, Math.min(hi, adj[k]))
  })
}

function clampBands(sel: LookAccumulator['sel']) {
  ;(Object.keys(sel) as HslBand[]).forEach((b) => {
    sel[b].h = Math.max(-100, Math.min(100, sel[b].h))
    sel[b].s = Math.max(-100, Math.min(100, sel[b].s))
    sel[b].l = Math.max(-100, Math.min(100, sel[b].l))
  })
}

export interface LookResult {
  recognized: string[]
  mutate: (doc: EditorDocument) => void
}

export function interpretLook(prompt: string): LookResult | null {
  const text = ` ${prompt.toLowerCase()} `
  const scale = AMPLIFIERS.some((w) => text.includes(` ${w} `))
    ? 1.4
    : REDUCERS.some((w) => text.includes(` ${w} `))
    ? 0.6
    : 1

  const acc: LookAccumulator = {
    adj: { ...DEFAULT_ADJUSTMENTS },
    tex: createTexture(),
    sel: createSelectiveColor(),
  }

  const recognized: string[] = []
  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      rule.apply(acc, scale)
      recognized.push(rule.label)
    }
  }

  if (recognized.length === 0) return null

  clampAdjustments(acc.adj)
  clampBands(acc.sel)

  return {
    recognized,
    mutate: (doc) => {
      doc.adjustments = acc.adj
      doc.texture = acc.tex
      doc.selectiveColor = acc.sel
      doc.activeFilter = null
    },
  }
}
