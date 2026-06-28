import { useEditor } from '../../state/editorStore'
import { uid } from '../../utils'
import type { TextLayer } from '../../types'

const FONTS = [
  'Inter, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Impact, sans-serif',
  'Comic Sans MS, cursive',
  'Times New Roman, serif',
]

export function TextPanel() {
  const layers = useEditor((s) => s.doc.layers)
  const selectedId = useEditor((s) => s.selectedLayerId)
  const addLayer = useEditor((s) => s.addLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const removeLayer = useEditor((s) => s.removeLayer)
  const selectLayer = useEditor((s) => s.selectLayer)

  const textLayers = layers.filter((l): l is TextLayer => l.type === 'text')
  const selected = textLayers.find((l) => l.id === selectedId) ?? null

  const addText = () => {
    const layer: TextLayer = {
      id: uid('text'),
      type: 'text',
      text: 'Double-click to edit',
      x: 0.5,
      y: 0.5,
      fontSize: 48,
      fontFamily: FONTS[0],
      color: '#ffffff',
      bold: true,
      italic: false,
      align: 'center',
      opacity: 1,
      rotation: 0,
    }
    addLayer(layer)
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Text</h3>
      <button className="btn primary full" onClick={addText}>
        + Add text
      </button>

      {textLayers.length > 0 && (
        <div className="layer-list">
          {textLayers.map((l) => (
            <button
              key={l.id}
              className={l.id === selectedId ? 'layer-row active' : 'layer-row'}
              onClick={() => selectLayer(l.id)}
            >
              <span className="layer-name">{l.text.split('\n')[0] || 'Text'}</span>
              <span
                className="layer-del"
                onClick={(e) => {
                  e.stopPropagation()
                  removeLayer(l.id)
                }}
              >
                ✕
              </span>
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <div className="layer-editor">
          <label className="mini-label">Content</label>
          <textarea
            className="text-input"
            rows={2}
            value={selected.text}
            onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
          />

          <label className="mini-label">Font</label>
          <select
            className="select"
            value={selected.fontFamily}
            onChange={(e) =>
              updateLayer(selected.id, { fontFamily: e.target.value })
            }
          >
            {FONTS.map((f) => (
              <option key={f} value={f}>
                {f.split(',')[0]}
              </option>
            ))}
          </select>

          <label className="mini-label">Size: {selected.fontSize}</label>
          <input
            type="range"
            min={8}
            max={200}
            value={selected.fontSize}
            onChange={(e) =>
              updateLayer(selected.id, { fontSize: Number(e.target.value) })
            }
          />

          <label className="mini-label">Rotation: {selected.rotation}°</label>
          <input
            type="range"
            min={-180}
            max={180}
            value={selected.rotation}
            onChange={(e) =>
              updateLayer(selected.id, { rotation: Number(e.target.value) })
            }
          />

          <label className="mini-label">Opacity: {Math.round(selected.opacity * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={selected.opacity}
            onChange={(e) =>
              updateLayer(selected.id, { opacity: Number(e.target.value) })
            }
          />

          <div className="row gap">
            <label className="mini-label">Color</label>
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
            />
          </div>

          <div className="row gap">
            <button
              className={selected.bold ? 'btn chip active' : 'btn chip'}
              onClick={() => updateLayer(selected.id, { bold: !selected.bold })}
            >
              B
            </button>
            <button
              className={selected.italic ? 'btn chip active' : 'btn chip'}
              onClick={() => updateLayer(selected.id, { italic: !selected.italic })}
            >
              I
            </button>
            {(['left', 'center', 'right'] as const).map((al) => (
              <button
                key={al}
                className={selected.align === al ? 'btn chip active' : 'btn chip'}
                onClick={() => updateLayer(selected.id, { align: al })}
              >
                {al[0].toUpperCase()}
              </button>
            ))}
          </div>
          <p className="hint">Drag the text on the canvas to reposition it.</p>
        </div>
      ) : (
        <p className="hint">Add a text layer, then select it here to edit.</p>
      )}
    </div>
  )
}
