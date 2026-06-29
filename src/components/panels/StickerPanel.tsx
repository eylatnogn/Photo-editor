import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { STICKERS, drawSticker, type StickerCategory, type StickerDef } from '../../engine/stickers'
import { drawFramedImage } from '../../engine/render'
import { buildFilmStrip } from '../../engine/filmstrip'
import { primeImage } from '../../engine/imageCache'
import { loadImageFromFile, uid } from '../../utils'
import { Icon } from '../ui/Icon'
import { PhotoFraming } from '../PhotoFraming'
import { FULL_CROP } from '../../types'
import type { ImageFrame, ImageLayer, StickerLayer } from '../../types'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

const CATEGORIES: Array<{ id: StickerCategory; label: string }> = [
  { id: 'doodle', label: 'Doodles' },
  { id: 'collage', label: 'Collage' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'retro', label: 'Retro' },
  { id: 'tape', label: 'Tape' },
  { id: 'label', label: 'Labels' },
  { id: 'emoji', label: 'Emoji' },
]

const FRAMES: Array<{ id: ImageFrame; label: string }> = [
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'film', label: 'Film' },
  { id: 'negative', label: 'Negative' },
  { id: 'camera', label: 'Camera' },
  { id: 'tape', label: 'Taped' },
  { id: 'white', label: 'Border' },
  { id: 'scallop', label: 'Scallop' },
  { id: 'retro', label: 'Date' },
  { id: 'vignette', label: 'Aged' },
  { id: 'none', label: 'Plain' },
]

const COLORS = ['#ffffff', '#000000', '#1a1a1a', '#ff3b67', '#ffcc00', '#34c759', '#007aff', '#ff7eb6', '#e7d8a8']

function coverInto(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, dw: number, dh: number) {
  const sR = iw / ih
  const dR = dw / dh
  let sw = iw
  let sh = ih
  let sx = 0
  let sy = 0
  if (sR > dR) { sw = ih * dR; sx = (iw - sw) / 2 } else { sh = iw / dR; sy = (ih - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
}

// A thumbnail of the current photo shown inside a given frame.
function FrameThumb({ frame, sample }: { frame: ImageFrame; sample: HTMLCanvasElement | null }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    if (!sample) return
    ctx.save()
    ctx.translate(c.width / 2, c.height / 2)
    const pw = c.width * 0.6
    const ph = pw * 0.75
    drawFramedImage(ctx, sample, pw, ph, frame)
    ctx.restore()
  }, [frame, sample])
  return <canvas ref={ref} width={108} height={108} className="frame-thumb-canvas" />
}

function StickerThumb({ def }: { def: StickerDef }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#9aa0aa'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.save()
    ctx.translate(c.width / 2, c.height / 2)
    const wide = (def.aspect ?? 1) > 1
    drawSticker(ctx, def.id, wide ? c.width * 0.92 : c.width * 0.62, def.defaultColor, def.hasText ? 'Aa' : undefined)
    ctx.restore()
  }, [def])
  return <canvas ref={ref} width={52} height={52} className="sticker-thumb" />
}

function canvasToObjectImage(canvas: HTMLCanvasElement): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((res, rej) => {
    canvas.toBlob((blob) => {
      if (!blob) return rej(new Error('toBlob failed'))
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => res({ url, img })
      img.onerror = rej
      img.src = url
    }, 'image/png')
  })
}

export function StickerPanel() {
  const source = useEditor((s) => s.source)
  const addLayer = useEditor((s) => s.addLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const layers = useEditor((s) => s.doc.layers)
  const selectedId = useEditor((s) => s.selectedLayerId)
  const [cat, setCat] = useState<StickerCategory>('doodle')

  const frameInput = useRef<HTMLInputElement>(null)
  const stripInput = useRef<HTMLInputElement>(null)
  const pendingFrame = useRef<ImageFrame>('none')

  const selected = layers.find((l) => l.id === selectedId)
  const selImage = selected?.type === 'image' ? (selected as ImageLayer) : null
  const selSticker = selected?.type === 'sticker' ? (selected as StickerLayer) : null
  const selDef = selSticker && STICKERS.find((s) => s.id === selSticker.sticker)

  // Small sample of the current photo to preview frames with.
  const sample = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 200
    c.height = 150
    const ctx = c.getContext('2d')!
    if (source) {
      const iw = source instanceof HTMLImageElement ? source.naturalWidth : source.width
      const ih = source instanceof HTMLImageElement ? source.naturalHeight : source.height
      coverInto(ctx, source as CanvasImageSource, iw, ih, c.width, c.height)
    } else {
      const g = ctx.createLinearGradient(0, 0, c.width, c.height)
      g.addColorStop(0, '#6a8cff')
      g.addColorStop(1, '#ff7eb6')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, c.width, c.height)
    }
    return c
  }, [source])

  const addFramedPhoto = async (file: File, frame: ImageFrame) => {
    const img = await loadImageFromFile(file)
    primeImage(img.src, img)
    const ratio = img.naturalWidth / img.naturalHeight
    const scale = Math.max(0.18, Math.min(0.45, 0.55 * ratio))
    addLayer({
      id: uid('image'),
      type: 'image',
      src: img.src,
      x: 0.5,
      y: 0.5,
      scale,
      rotation: frame === 'tape' || frame === 'polaroid' ? -4 : 0,
      opacity: 1,
      naturalRatio: ratio,
      frame,
      crop: { x: 0, y: 0, width: 1, height: 1 },
    })
  }

  const addStrip = async (files: FileList) => {
    const chosen = Array.from(files).slice(0, 4)
    const imgs = await Promise.all(chosen.map((f) => loadImageFromFile(f)))
    const strip = buildFilmStrip(imgs.map((i) => ({ img: i, w: i.naturalWidth, h: i.naturalHeight })))
    const { url, img } = await canvasToObjectImage(strip)
    primeImage(url, img)
    addLayer({
      id: uid('image'),
      type: 'image',
      src: url,
      x: 0.5,
      y: 0.5,
      scale: 0.3,
      rotation: -3,
      opacity: 1,
      naturalRatio: strip.width / strip.height,
      frame: 'none',
      crop: { x: 0, y: 0, width: 1, height: 1 },
    })
  }

  // Zoom keeps the crop centred and square-uniform so the photo isn't distorted.
  const cropZoom = (img: ImageLayer) => {
    const c = img.crop ?? FULL_CROP
    return 1 / Math.max(c.width, c.height)
  }
  const setZoom = (img: ImageLayer, z: number) => {
    const f = clamp(1 / z, 0.2, 1)
    const c = img.crop ?? FULL_CROP
    const cx = c.x + c.width / 2
    const cy = c.y + c.height / 2
    updateLayer(img.id, {
      crop: {
        x: clamp(cx - f / 2, 0, 1 - f),
        y: clamp(cy - f / 2, 0, 1 - f),
        width: f,
        height: f,
      },
    })
  }

  const addSticker = (def: StickerDef) => {
    const scale = def.category === 'emoji' ? 0.13 : (def.aspect ?? 1) > 1 ? 0.5 : 0.18
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
      text: def.hasText ? def.defaultText ?? 'Text' : undefined,
    })
  }

  return (
    <div className="panel">
      {selImage && (
        <div className="layer-editor selected-photo">
          <div className="row spread">
            <label className="mini-label">Editing selected photo</label>
            <button
              className="btn tiny"
              onClick={() => updateLayer(selImage.id, { crop: { ...FULL_CROP } })}
            >
              Reset framing
            </button>
          </div>
          <PhotoFraming layer={selImage} />
          <label className="mini-label">Zoom: {cropZoom(selImage).toFixed(1)}×</label>
          <input
            type="range"
            min={1}
            max={5}
            step={0.1}
            value={cropZoom(selImage)}
            onChange={(e) => setZoom(selImage, Number(e.target.value))}
          />
          <label className="mini-label">Size: {Math.round(selImage.scale * 100)}%</label>
          <input
            type="range"
            min={0.1}
            max={0.95}
            step={0.01}
            value={selImage.scale}
            onChange={(e) => updateLayer(selImage.id, { scale: Number(e.target.value) })}
          />
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
          <label className="mini-label">Opacity: {Math.round(selImage.opacity * 100)}%</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.01}
            value={selImage.opacity}
            onChange={(e) => updateLayer(selImage.id, { opacity: Number(e.target.value) })}
          />
        </div>
      )}

      <h3 className="panel-title">Photo frames</h3>
      <p className="hint">Tap a frame, pick a photo, and it drops onto your image as a movable layer.</p>
      <div className="frame-grid">
        {FRAMES.map((f) => (
          <button
            key={f.id}
            className="frame-cell"
            onClick={() => {
              pendingFrame.current = f.id
              frameInput.current?.click()
            }}
          >
            <FrameThumb frame={f.id} sample={sample} />
            <span>{f.label}</span>
          </button>
        ))}
        <button className="frame-cell" onClick={() => stripInput.current?.click()}>
          <span className="frame-strip-icon">
            <Icon name="layers" size={26} />
          </span>
          <span>Film strip</span>
        </button>
      </div>
      <input
        ref={frameInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) addFramedPhoto(f, pendingFrame.current)
          e.target.value = ''
        }}
      />
      <input
        ref={stripInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) addStrip(e.target.files)
          e.target.value = ''
        }}
      />

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
          <label className="mini-label">Opacity: {Math.round(selSticker.opacity * 100)}%</label>
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
    </div>
  )
}
