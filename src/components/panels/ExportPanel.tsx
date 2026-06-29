import { useEffect, useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { renderDocument } from '../../engine/render'
import { buildCarousel } from '../../engine/carousel'
import { canvasToBlob } from '../../ai/backgroundRemoval'
import { downloadBlob, stripExtension } from '../../utils'
import { makeZip } from '../../utils/zip'
import { useAddPhoto } from '../../hooks/useAddPhoto'
import { Icon } from '../ui/Icon'

type Format = 'image/png' | 'image/jpeg' | 'image/webp'

const FORMATS: Array<{ id: Format; label: string; ext: string }> = [
  { id: 'image/png', label: 'PNG', ext: 'png' },
  { id: 'image/jpeg', label: 'JPEG', ext: 'jpg' },
  { id: 'image/webp', label: 'WebP', ext: 'webp' },
]

const CAROUSEL_ASPECTS = [
  { label: '4:5', value: 4 / 5 },
  { label: '1:1', value: 1 },
  { label: '1.91:1', value: 1.91 },
]

export function ExportPanel() {
  const source = useEditor((s) => s.source)
  const doc = useEditor((s) => s.doc)
  const fileName = useEditor((s) => s.fileName)
  const retouch = useEditor((s) => s.retouch)

  const mode = useEditor((s) => s.exportMode)
  const setMode = useEditor((s) => s.setExportMode)
  const addPhoto = useAddPhoto()
  const [format, setFormat] = useState<Format>('image/png')
  const [quality, setQuality] = useState(0.92)
  const [scale, setScale] = useState(1)
  const [busy, setBusy] = useState(false)

  const [slides, setSlides] = useState(3)
  const [slideAspect, setSlideAspect] = useState(4 / 5)
  const [preview, setPreview] = useState<string[]>([])

  const ext = FORMATS.find((f) => f.id === format)!.ext
  const base = fileName ? stripExtension(fileName) : 'edited'

  const renderComposition = () => {
    const out = document.createElement('canvas')
    renderDocument(source!, doc, out, { heal: retouch.heal, erase: retouch.erase })
    return out
  }

  // Live carousel preview (low-res).
  useEffect(() => {
    if (mode !== 'carousel' || !source) {
      setPreview([])
      return
    }
    const comp = renderComposition()
    const pieces = buildCarousel(comp, slides, slideAspect, 260)
    setPreview(pieces.map((c) => c.toDataURL('image/png')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, slides, slideAspect, doc, source, retouch])

  const exportSingle = async () => {
    if (!source || busy) return
    setBusy(true)
    try {
      const out = renderComposition()
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
      downloadBlob(blob, `${base}-edited.${ext}`)
    } finally {
      setBusy(false)
    }
  }

  const exportCarousel = async () => {
    if (!source || busy) return
    setBusy(true)
    try {
      const comp = renderComposition()
      const pieces = buildCarousel(comp, slides, slideAspect, 1080)
      const entries = await Promise.all(
        pieces.map(async (c, i) => {
          const blob = await canvasToBlob(c, format, format === 'image/png' ? undefined : quality)
          const buf = new Uint8Array(await blob.arrayBuffer())
          return { name: `${base}-${i + 1}.${ext}`, data: buf }
        }),
      )
      downloadBlob(makeZip(entries), `${base}-carousel-${slides}.zip`)
    } finally {
      setBusy(false)
    }
  }

  // Single-export output dimensions for display.
  let outW = 0
  let outH = 0
  if (source) {
    const sw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const sh = source instanceof HTMLImageElement ? source.naturalHeight : source.height
    outW = Math.round(sw * doc.transform.crop.width * scale)
    outH = Math.round(sh * doc.transform.crop.height * scale)
  }
  const slideH = Math.round(1080 / slideAspect)

  return (
    <div className="panel">
      <h3 className="panel-title">Export</h3>

      <div className="row gap">
        <button
          className={mode === 'single' ? 'btn chip active' : 'btn chip'}
          onClick={() => setMode('single')}
        >
          Single image
        </button>
        <button
          className={mode === 'carousel' ? 'btn chip active' : 'btn chip'}
          onClick={() => setMode('carousel')}
        >
          Carousel
        </button>
      </div>

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
          <label className="mini-label">Quality: {Math.round(quality * 100)}%</label>
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

      {mode === 'single' ? (
        <>
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
          <button className="btn primary full big" onClick={exportSingle} disabled={busy}>
            {busy ? 'Rendering…' : (<><Icon name="export" size={16} /> Download</>)}
          </button>
        </>
      ) : (
        <>
          <p className="hint">
            Splits your image into a seamless Instagram carousel — post the
            slides in order and swiping reads as one continuous panorama. Add
            more photos and arrange them across the frame to build it out.
          </p>

          <label className="btn full">
            <Icon name="photo" size={15} /> Add photo to carousel
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) addPhoto(f)
                e.target.value = ''
              }}
            />
          </label>

          <label className="mini-label">Slides</label>
          <div className="row gap">
            {[2, 3, 4, 5, 6].map((n) => (
              <button
                key={n}
                className={slides === n ? 'btn chip active' : 'btn chip'}
                onClick={() => setSlides(n)}
              >
                {n}
              </button>
            ))}
          </div>

          <label className="mini-label">Slide ratio</label>
          <div className="row gap">
            {CAROUSEL_ASPECTS.map((a) => (
              <button
                key={a.label}
                className={Math.abs(slideAspect - a.value) < 0.01 ? 'btn chip active' : 'btn chip'}
                onClick={() => setSlideAspect(a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>

          {preview.length > 0 && (
            <div className="carousel-preview">
              {preview.map((src, i) => (
                <img key={i} src={src} alt={`Slide ${i + 1}`} />
              ))}
            </div>
          )}

          <p className="hint">
            {slides} slides · 1080 × {slideH}px each · downloads as a .zip
            (post {base}-1 … {base}-{slides} in order)
          </p>

          <button className="btn primary full big" onClick={exportCarousel} disabled={busy}>
            {busy ? 'Rendering…' : (<><Icon name="export" size={16} /> Download carousel</>)}
          </button>
        </>
      )}
    </div>
  )
}
