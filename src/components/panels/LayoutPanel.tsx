import { useRef } from 'react'
import { useEditor } from '../../state/editorStore'
import { LAYOUT_TEMPLATES, makeLayout } from '../../engine/layout'
import { Slider } from '../ui/Slider'
import { RemoveBgButton } from '../RemoveBgButton'
import { primeImage } from '../../engine/imageCache'
import { loadImageFromFile } from '../../utils'
import type { Layout } from '../../types'

const BG_SWATCHES = ['#ffffff', '#000000', '#f1ece0', '#111319', '#ffd9e2', '#dce8ff', '#e7f0dd']

// Tiny SVG preview of a template's slot arrangement.
function TemplateThumb({ id }: { id: string }) {
  const t = LAYOUT_TEMPLATES.find((x) => x.id === id)!
  const W = 40
  const H = t.aspect >= 1 ? W / t.aspect : W
  const ww = t.aspect >= 1 ? W : W * t.aspect
  return (
    <svg viewBox={`0 0 ${ww} ${H}`} width={ww} height={H} className="tpl-thumb">
      {t.rects.map((r, i) => (
        <rect
          key={i}
          x={r.x * ww + 1}
          y={r.y * H + 1}
          width={r.w * ww - 2}
          height={r.h * H - 2}
          rx={1.5}
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

export function LayoutPanel() {
  const layout = useEditor((s) => s.doc.layout)
  const applyLayout = useEditor((s) => s.applyLayout)
  const clearLayout = useEditor((s) => s.clearLayout)
  const commit = useEditor((s) => s.commit)
  const selectedSlotId = useEditor((s) => s.selectedSlotId)
  const fillSlot = useEditor((s) => s.fillSlot)
  const updateSlot = useEditor((s) => s.updateSlot)
  const replaceInput = useRef<HTMLInputElement>(null)

  const selSlot = layout?.slots.find((s) => s.id === selectedSlotId) ?? null
  const filled = layout ? layout.slots.filter((s) => s.src).length : 0

  const setLayoutProp = (patch: Partial<Layout>) =>
    commit((d) => {
      if (d.layout) Object.assign(d.layout, patch)
    })

  const onReplace = async (file: File) => {
    if (!selSlot) return
    const img = await loadImageFromFile(file)
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    const url = c.toDataURL('image/jpeg', 0.92)
    primeImage(url, img)
    fillSlot(selSlot.id, url, img.naturalWidth / img.naturalHeight)
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Layout templates</h3>
      <p className="hint">
        Pick a grid, then tap each frame on the photo to drop a picture in. Add
        text, stickers or drawings from the other tools to layer over the top.
      </p>

      <div className="tpl-grid">
        {LAYOUT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            className={layout?.template === t.id ? 'tpl-cell active' : 'tpl-cell'}
            onClick={() => applyLayout(t.id)}
            title={`${t.label} · ${t.count} photos`}
          >
            <TemplateThumb id={t.id} />
            <span>{t.count}</span>
          </button>
        ))}
      </div>

      {layout && (
        <>
          <div className="row spread" style={{ marginTop: 8 }}>
            <span className="hint" style={{ margin: 0 }}>
              {filled}/{layout.slots.length} filled
            </span>
            <button className="btn tiny" onClick={clearLayout}>
              Remove layout
            </button>
          </div>

          {selSlot ? (
            <div className="layer-editor selected-photo">
              <div className="row spread">
                <label className="mini-label" style={{ margin: 0 }}>
                  Selected frame
                </label>
                <button className="btn tiny" onClick={() => replaceInput.current?.click()}>
                  {selSlot.src ? 'Replace' : 'Add photo'}
                </button>
              </div>
              <Slider
                label="Zoom"
                value={selSlot.zoom}
                min={1}
                max={4}
                step={0.02}
                defaultValue={1}
                format={(v) => `${v.toFixed(1)}×`}
                apply={(z) => (d) => {
                  const sl = d.layout?.slots.find((s) => s.id === selSlot.id)
                  if (sl) sl.zoom = z
                }}
              />
              <p className="hint" style={{ marginBottom: 8 }}>
                Drag inside the frame on the photo to reposition it.
              </p>
              {selSlot.src && (
                <RemoveBgButton
                  src={selSlot.src}
                  block
                  onDone={(url, ratio) => updateSlot(selSlot.id, { src: url, naturalRatio: ratio })}
                />
              )}
              <input
                ref={replaceInput}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) onReplace(f)
                  e.target.value = ''
                }}
              />
            </div>
          ) : (
            <p className="hint">Tap a frame on the photo to add or adjust a picture.</p>
          )}

          <h3 className="panel-title">Layout style</h3>
          <Slider
            label="Spacing"
            value={layout.gap}
            min={0}
            max={0.06}
            step={0.002}
            defaultValue={0.014}
            format={(v) => `${Math.round((v / 0.06) * 100)}%`}
            apply={(g) => (d) => {
              if (d.layout) d.layout.gap = g
            }}
          />
          <Slider
            label="Corner radius"
            value={layout.radius}
            min={0}
            max={0.5}
            step={0.01}
            defaultValue={0.04}
            format={(v) => `${Math.round((v / 0.5) * 100)}%`}
            apply={(r) => (d) => {
              if (d.layout) d.layout.radius = r
            }}
          />
          <Slider
            label="Outer margin"
            value={layout.padding}
            min={0}
            max={0.08}
            step={0.004}
            defaultValue={0.02}
            format={(v) => `${Math.round((v / 0.08) * 100)}%`}
            apply={(p) => (d) => {
              if (d.layout) d.layout.padding = p
            }}
          />
          <label className="mini-label">Background</label>
          <div className="swatches">
            {BG_SWATCHES.map((c) => (
              <button
                key={c}
                className={layout.background === c ? 'swatch active' : 'swatch'}
                style={{ background: c }}
                onClick={() => setLayoutProp({ background: c })}
              />
            ))}
            <input
              type="color"
              value={layout.background}
              onChange={(e) => setLayoutProp({ background: e.target.value })}
            />
          </div>

          <label className="mini-label">Shape</label>
          <div className="row gap">
            {aspectChoices(layout).map((a) => (
              <button
                key={a.label}
                className={Math.abs(layout.aspect - a.value) < 0.001 ? 'btn chip active' : 'btn chip'}
                onClick={() => setLayoutProp({ aspect: a.value })}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Offer the template's native shape plus common post shapes.
function aspectChoices(layout: Layout) {
  const base = [
    { label: 'Square', value: 1 },
    { label: 'Portrait', value: 4 / 5 },
    { label: 'Story', value: 9 / 16 },
    { label: 'Landscape', value: 16 / 9 },
  ]
  const native = makeLayout(layout.template).aspect
  if (!base.some((b) => Math.abs(b.value - native) < 0.001))
    base.unshift({ label: 'Original', value: native })
  return base
}
