import { useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { renderDocument } from '../../engine/render'
import { canvasToBlob } from '../../ai/backgroundRemoval'
import { downloadBlob, stripExtension } from '../../utils'

type Format = 'image/png' | 'image/jpeg' | 'image/webp'

const FORMATS: Array<{ id: Format; label: string; ext: string }> = [
  { id: 'image/png', label: 'PNG', ext: 'png' },
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { id: 'image/webp', label: 'WebP', ext: 'webp' },
]

export function ExportPanel() {
  const source = useEditor((s) => s.source)
  const doc = useEditor((s) => s.doc)
  const fileName = useEditor((s) => s.fileName)
  const retouch = useEditor((s) => s.retouch)

  const [format, setFormat] = useState<Format>('image/png')
  const [quality, setQuality] = useState(0.92)
  const [scale, setScale] = useState(1)
  const [busy, setBusy] = useState(false)

  const exportImage = async () => {
    if (!source || busy) return
    setBusy(true)
    try {
      // Render at full source resolution, including retouch layers.
      const out = document.createElement('canvas')
      renderDocument(source, doc, out, {
        heal: retouch.heal,
        erase: retouch.erase,
      })

      let finalCanvas = out
      if (scale !== 1) {
        const scaled = document.createElement('canvas')
        scaled.width = Math.max(1, Math.round(out.width * scale))
        scaled.height = Math.max(1, Math.round(out.height * scale))
        const sctx = scaled.getContext('2d')!
        sctx.imageSmoothingQuality = 'high'
        sctx.drawImage(out, 0, 0, scaled.width, scaled.height)
        finalCanvas = scaled
      }

      const blob = await canvasToBlob(
        finalCanvas,
        format,
        format === 'image/png' ? undefined : quality,
      )
      const ext = FORMATS.find((f) => f.id === format)!.ext
      const base = fileName ? stripExtension(fileName) : 'edited'
      downloadBlob(blob, `${base}-edited.${ext}`)
    } finally {
      setBusy(false)
    }
  }

  // Estimate output dimensions for display.
  let outW = 0
  let outH = 0
  if (source) {
    const sw =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const sh =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height
    outW = Math.round(sw * doc.transform.crop.width * scale)
    outH = Math.round(sh * doc.transform.crop.height * scale)
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Export</h3>

      <label className="mini-label">Format</label>
      <div className="row gap">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            className={format === f.id ? 'btn chip active' : 'btn chip'}
            onClick={() => setFormat(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {format !== 'image/png' && (
        <>
          <label className="mini-label">
            Quality: {Math.round(quality * 100)}%
          </label>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.01}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        </>
      )}

      <label className="mini-label">Resize</label>
      <div className="row gap">
        {[0.5, 1, 2].map((sc) => (
          <button
            key={sc}
            className={scale === sc ? 'btn chip active' : 'btn chip'}
            onClick={() => setScale(sc)}
          >
            {sc === 1 ? '100%' : sc === 0.5 ? '50%' : '200%'}
          </button>
        ))}
      </div>

      <p className="hint">
        Output: {outW} × {outH}px
        {format === 'image/jpeg' && ' · JPEG flattens transparency'}
      </p>

      <button className="btn primary full big" onClick={exportImage} disabled={busy}>
        {busy ? 'Rendering…' : '⤓ Download'}
      </button>
    </div>
  )
}
