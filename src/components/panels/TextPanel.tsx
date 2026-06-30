import { useEditor } from '../../state/editorStore'
import { uid } from '../../utils'
import { Icon } from '../ui/Icon'
import type { TextLayer } from '../../types'

// Curated font set — scrapbook scripts, elegant serifs, display & pixel faces
// (loaded from Google Fonts in index.html) plus dependable system stacks.
const FONTS: Array<{ label: string; family: string }> = [
  { label: 'Clean Sans', family: 'Inter, sans-serif' },
  { label: 'Handwriting', family: '"Caveat", cursive' },
  { label: 'Script', family: '"Dancing Script", cursive' },
  { label: 'Signature', family: '"Sacramento", cursive' },
  { label: 'Elegant', family: '"Playfair Display", serif' },
  { label: 'Retro Script', family: '"Lobster", cursive' },
  { label: 'Brush', family: '"Pacifico", cursive' },
  { label: 'Marker', family: '"Gloria Hallelujah", cursive' },
  { label: 'Poster', family: '"Bebas Neue", sans-serif' },
  { label: 'Chunky', family: '"Shrikhand", serif' },
  { label: 'Pixel', family: '"Press Start 2P", monospace' },
  { label: 'Terminal', family: '"VT323", monospace' },
  { label: 'Classic Serif', family: 'Georgia, serif' },
  { label: 'Typewriter', family: '"Courier New", monospace' },
  { label: 'Impact', family: 'Impact, sans-serif' },
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
      text: 'Your text',
      x: 0.5,
      y: 0.5,
      fontSize: 48,
      fontFamily: FONTS[0].family,
      color: '#ffffff',
      bold: true,
      italic: false,
      align: 'center',
      opacity: 1,
      rotation: 0,
      style: 'plain',
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
                <Icon name="close" size={13} />
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

          <label className="mini-label">Style</label>
          <div className="row gap">
            {(['plain', 'cutout', 'bubble'] as const).map((st) => (
              <button
                key={st}
                className={selected.style === st ? 'btn chip active' : 'btn chip'}
                onClick={() => updateLayer(selected.id, { style: st })}
              >
                {st === 'plain' ? 'Plain' : st === 'cutout' ? 'Cut-out' : 'Bubble'}
              </button>
            ))}
          </div>

          <label className="mini-label">Font</label>
          <select
            className="select"
            value={selected.fontFamily}
            onChange={(e) =>
              updateLayer(selected.id, { fontFamily: e.target.value })
            }
          >
            {FONTS.map((f) => (
              <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.label}
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
