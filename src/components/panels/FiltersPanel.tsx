import { useEffect, useRef } from 'react'
import { useEditor } from '../../state/editorStore'
import { FILTER_PRESETS } from '../../engine/presets'
import { renderDocument } from '../../engine/render'
import { createEmptyDocument } from '../../types'

// Renders a tiny thumbnail of the current image with a given preset applied.
function FilterThumb({ name }: { name: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const source = useEditor((s) => s.source)

  useEffect(() => {
    if (!source || !ref.current) return
    const sw =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const sh =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height
    const size = 120
    const scale = Math.min(size / sw, size / sh)
    const thumb = document.createElement('canvas')
    thumb.width = Math.max(1, Math.round(sw * scale))
    thumb.height = Math.max(1, Math.round(sh * scale))
    thumb
      .getContext('2d')!
      .drawImage(source as CanvasImageSource, 0, 0, thumb.width, thumb.height)
    const doc = createEmptyDocument()
    doc.activeFilter = name === 'Original' ? null : name
    renderDocument(thumb, doc, ref.current)
  }, [source, name])

  return <canvas ref={ref} className="filter-thumb-canvas" />
}

export function FiltersPanel() {
  const active = useEditor((s) => s.doc.activeFilter)
  const commit = useEditor((s) => s.commit)

  return (
    <div className="panel">
      <h3 className="panel-title">Filters</h3>
      <div className="filter-grid">
        {FILTER_PRESETS.map((p) => {
          const isActive =
            active === p.name || (p.name === 'Original' && !active)
          return (
            <button
              key={p.name}
              className={isActive ? 'filter-cell active' : 'filter-cell'}
              onClick={() =>
                commit((d) => {
                  d.activeFilter = p.name === 'Original' ? null : p.name
                })
              }
            >
              <FilterThumb name={p.name} />
              <span>{p.name}</span>
            </button>
          )
        })}
      </div>
      <p className="hint">
        Pick a look, then fine-tune it any time in the Adjust panel — filters
        layer on top of your manual edits.
      </p>
      <div className="active-filter-row">
        <span className="mini-label">Active: {active ?? 'None'}</span>
        {active && (
          <button
            className="btn ghost"
            onClick={() => commit((d) => (d.activeFilter = null))}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}
