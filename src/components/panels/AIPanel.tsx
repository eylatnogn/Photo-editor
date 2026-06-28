import { useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { removeImageBackground } from '../../ai/backgroundRemoval'
import { interpretLook } from '../../ai/lookInterpreter'
import { Icon } from '../ui/Icon'
import type { RenderSource } from '../../engine/render'

const LOOK_SUGGESTIONS = [
  'Warm vintage film',
  'Moody cinematic',
  'Bright & airy',
  'Soft pastel',
  'Punchy & vibrant',
  'Black & white noir',
]

function sourceToCanvas(src: RenderSource): HTMLCanvasElement {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0)
  return c
}

// Analyze the image and pick black/white points to stretch contrast, plus a
// gentle vibrance/sharpen bump — a fast, dependency-free "auto enhance".
function computeAutoEnhance(src: RenderSource) {
  const w = src instanceof HTMLImageElement ? src.naturalWidth : src.width
  const h = src instanceof HTMLImageElement ? src.naturalHeight : src.height
  const scale = Math.min(1, 200 / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale))
  c.height = Math.max(1, Math.round(h * scale))
  const ctx = c.getContext('2d')!
  ctx.drawImage(src as CanvasImageSource, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  const hist = new Array(256).fill(0)
  let total = 0
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    )
    hist[lum]++
    total++
  }
  // Find 1st and 99th percentile luminance.
  const lowCut = total * 0.01
  const highCut = total * 0.99
  let acc = 0
  let black = 0
  let white = 255
  for (let i = 0; i < 256; i++) {
    acc += hist[i]
    if (acc <= lowCut) black = i
    if (acc <= highCut) white = i
  }
  return {
    blackPoint: Math.min(black, 60),
    whitePoint: Math.max(white, 195),
  }
}

export function AIPanel() {
  const source = useEditor((s) => s.source)
  const ai = useEditor((s) => s.ai)
  const setAI = useEditor((s) => s.setAI)
  const replaceSource = useEditor((s) => s.replaceSource)
  const commit = useEditor((s) => s.commit)
  const [lookPrompt, setLookPrompt] = useState('')
  const [lookMsg, setLookMsg] = useState<string | null>(null)
  const [lookErr, setLookErr] = useState(false)

  const applyLook = (text: string) => {
    const prompt = text.trim()
    if (!prompt || !source) return
    const result = interpretLook(prompt)
    if (!result) {
      setLookErr(true)
      setLookMsg(
        "Couldn't read that look. Try words like warm, moody, vintage, vibrant, pastel, cinematic or black & white.",
      )
      return
    }
    commit(result.mutate)
    setLookErr(false)
    setLookMsg(`Applied: ${result.recognized.join(' · ')}`)
  }

  const runRemoveBackground = async () => {
    if (!source || ai.processing) return
    setAI({ processing: true, progress: 0, stage: 'Loading model…', error: null })
    try {
      const canvas = sourceToCanvas(source)
      const result = await removeImageBackground(canvas, (p) => {
        setAI({ progress: p.progress, stage: p.stage })
      })
      replaceSource(result)
      setAI({ processing: false, progress: 1, stage: 'Done' })
    } catch (err) {
      setAI({
        processing: false,
        error:
          err instanceof Error
            ? err.message
            : 'Background removal failed. It needs network access to fetch the model on first use.',
      })
    }
  }

  const runAutoEnhance = () => {
    if (!source) return
    const { blackPoint, whitePoint } = computeAutoEnhance(source)
    commit((d) => {
      d.adjustments.blackPoint = blackPoint
      d.adjustments.whitePoint = whitePoint
      d.adjustments.contrast = Math.max(d.adjustments.contrast, 8)
      d.adjustments.vibrance = Math.max(d.adjustments.vibrance, 12)
      d.adjustments.sharpen = Math.max(d.adjustments.sharpen, 10)
    })
  }

  return (
    <div className="panel">
      <h3 className="panel-title">AI Tools</h3>

      <div className="ai-card">
        <div className="ai-card-title">
          <Icon name="wand" size={17} /> Enhance to a look
        </div>
        <p className="hint">
          Describe the vibe you want and the editor builds the look for you —
          interpreted on-device, nothing is uploaded.
        </p>
        <textarea
          className="text-input"
          rows={2}
          placeholder="e.g. warm vintage film, soft and dreamy…"
          value={lookPrompt}
          onChange={(e) => setLookPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              applyLook(lookPrompt)
            }
          }}
        />
        <div className="look-chips">
          {LOOK_SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="btn chip"
              onClick={() => {
                setLookPrompt(s)
                applyLook(s)
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          className="btn primary full"
          onClick={() => applyLook(lookPrompt)}
          disabled={!lookPrompt.trim()}
        >
          Apply look
        </button>
        {lookMsg && (
          <p className={lookErr ? 'error-text' : 'hint success'}>{lookMsg}</p>
        )}
      </div>

      <div className="ai-card">
        <div className="ai-card-title">
          <Icon name="sparkle" size={17} /> Auto Enhance
        </div>
        <p className="hint">
          Analyzes the histogram and balances exposure, contrast and color in
          one click. Runs instantly, offline.
        </p>
        <button className="btn primary full" onClick={runAutoEnhance}>
          Auto Enhance
        </button>
      </div>

      <div className="ai-card">
        <div className="ai-card-title">
          <Icon name="scissors" size={17} /> Remove Background
        </div>
        <p className="hint">
          Cuts out the subject and makes the background transparent, running an
          AI segmentation model in your browser. The model (~40MB) downloads on
          first use, so this needs an internet connection the first time.
        </p>
        <button
          className="btn primary full"
          onClick={runRemoveBackground}
          disabled={ai.processing}
        >
          {ai.processing ? 'Processing…' : 'Remove Background'}
        </button>

        {ai.processing && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${Math.round(ai.progress * 100)}%` }}
            />
            <span className="progress-label">{ai.stage}</span>
          </div>
        )}

        {ai.error && <p className="error-text">{ai.error}</p>}
      </div>
    </div>
  )
}
