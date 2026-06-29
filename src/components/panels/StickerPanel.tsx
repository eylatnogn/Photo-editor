import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { STICKERS, drawSticker, type StickerCategory, type StickerDef } from '../../engine/stickers'
import { primeImage } from '../../engine/imageCache'
import { loadImageFromFile, uid } from '../../utils'
import { Icon } from '../ui/Icon'
import type { ImageFrame, ImageLayer, StickerLayer } from '../../types'

const CATEGORIES: Array<{ id: StickerCategory; label: string }> = [
  { id: 'shapes', label: 'Shapes' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'doodle', label: 'Doodles' },
  { id: 'tape', label: 'Tape' },
  { id: 'label', label: 'Labels' },
  { id: 'emoji', label: 'Emoji' },
]

const FRAMES: Array<{ id: ImageFrame; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'white', label: 'Border' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'film', label: 'Film' },
  { id: 'negative', label: 'Negative' },
  { id: 'camera', label: 'Camera' },
  { id: 'tape', label: 'Taped' },
  { id: 'vignette', label: 'Aged' },
  { id: 'scallop', label: 'Scallop' },
  { id: 'retro', label: 'Date' },
]

const COLORS = ['#ffffff', '#000000', '#ff3b67', '#ffcc00', '#34c759', '#007aff', '#ff7eb6', '#e7d8a8']

function StickerThumb({ def }: { def: StickerDef }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.save()
    ctx.translate(c.width / 2, c.height / 2)
    const wide = (def.aspect ?? 1) > 1
    drawSticker(ctx, def.id, wide ? c.width * 0.92 : c.width * 0.62, def.defaultColor, def.hasText ? 'Aa' : undefined)
    ctx.restore()
  }, [def])
  return <canvas ref={ref} width={52} height={52} className="sticker-thumb" />
}

export function StickerPanel() {
  const addLayer = useEditor((s) => s.addLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const layers = useEditor((s) => s.doc.layers)
  const selectedId = useEditor((s) => s.selectedLayerId)
  const [cat, setCat] = useState<StickerCategory>('shapes')

  const selected = layers.find((l) => l.id === selectedId)
  const selImage = selected?.type === 'image' ? (selected as ImageLayer) : null
  const selSticker = selected?.type === 'sticker' ? (selected as StickerLayer) : null
  const selDef = selSticker && STICKERS.find((s) => s.id === selSticker.sticker)

  const addPhoto = async (file: File) => {
    const img = await loadImageFromFile(file)
    primeImage(img.src, img)
    const ratio = img.naturalWidth / img.naturalHeight
    // Size so a portrait photo doesn't tower over the canvas; leaves room for
    // a frame to be visible around it.
    const scale = Math.max(0.18, Math.min(0.45, 0.55 * ratio))
    addLayer({
      id: uid('image'),
      type: 'image',
      src: img.src,
      x: 0.5,
      y: 0.5,
      scale,
      rotation: 0,
      opacity: 1,
      naturalRatio: ratio,
      frame: 'none',
    })
  }

  const addSticker = (def: StickerDef) => {
    const scale =
      def.category === 'emoji' ? 0.13 : (def.aspect ?? 1) > 1 ? 0.5 : 0.18
    addLayer({
      id: uid('sticker'),
      type: 'sticker',
      sticker: def.id,
      x: 0.5,
      y: 0.4,
      scale,
      rotation: 0,
      opacity: 1,
      color: def.defaultColor,
      text: def.hasText ? 'Location' : undefined,
    })
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Photos</h3>
      <label className="btn primary full">
        <Icon name="photo" size={16} /> Add photo layer
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

      {selImage && (
        <>
          <label className="mini-label">Frame</label>
          <div className="row gap">
            {FRAMES.map((f) => (
              <button
                key={f.id}
                className={selImage.frame === f.id ? 'btn chip active' : 'btn chip'}
                onClick={() => updateLayer(selImage.id, { frame: f.id })}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="mini-label">
            Opacity: {Math.round(selImage.opacity * 100)}%
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={selImage.opacity}
            onChange={(e) => updateLayer(selImage.id, { opacity: Number(e.target.value) })}
          />
        </>
      )}

      <h3 className="panel-title">Stickers</h3>
      <div className="row gap">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={cat === c.id ? 'btn chip active' : 'btn chip'}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="sticker-grid">
        {STICKERS.filter((s) => s.category === cat).map((def) => (
          <button key={def.id} className="sticker-cell" onClick={() => addSticker(def)}>
            <StickerThumb def={def} />
          </button>
        ))}
      </div>

      {selSticker && (
        <div className="layer-editor">
          <label className="mini-label">Selected sticker</label>
          {selDef?.hasText && (
            <input
              className="text-input"
              value={selSticker.text ?? ''}
              onChange={(e) => updateLayer(selSticker.id, { text: e.target.value })}
            />
          )}
          {selDef?.hasColor && (
            <div className="swatches">
              {COLORS.map((c) => (
                <button
                  key={c}
                  className={selSticker.color === c ? 'swatch active' : 'swatch'}
                  style={{ background: c }}
                  onClick={() => updateLayer(selSticker.id, { color: c })}
                />
              ))}
              <input
                type="color"
                value={selSticker.color}
                onChange={(e) => updateLayer(selSticker.id, { color: e.target.value })}
              />
            </div>
          )}
          <label className="mini-label">
            Opacity: {Math.round(selSticker.opacity * 100)}%
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={selSticker.opacity}
            onChange={(e) => updateLayer(selSticker.id, { opacity: Number(e.target.value) })}
          />
        </div>
      )}

      <p className="hint">
        Tap a sticker or photo to add it, then drag it on the image. Use the
        corner handle to resize and the top handle to rotate.
      </p>
    </div>
  )
}
