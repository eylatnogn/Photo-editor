import { useEditor } from '../../state/editorStore'
import { Icon } from '../ui/Icon'

const SWATCHES = [
  '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#00c7be',
  '#007aff', '#5856d6', '#af52de', '#ffffff', '#000000',
]

export function DrawPanel() {
  const brush = useEditor((s) => s.brush)
  const setBrush = useEditor((s) => s.setBrush)
  const layers = useEditor((s) => s.doc.layers)
  const removeLayer = useEditor((s) => s.removeLayer)
  const commit = useEditor((s) => s.commit)

  const drawLayers = layers.filter((l) => l.type === 'draw')

  return (
    <div className="panel">
      <h3 className="panel-title">Brush</h3>

      <label className="mini-label">Color</label>
      <div className="swatches">
        {SWATCHES.map((c) => (
          <button
            key={c}
            className={brush.color === c ? 'swatch active' : 'swatch'}
            style={{ background: c }}
            onClick={() => setBrush({ color: c })}
          />
        ))}
        <input
          type="color"
          value={brush.color}
          onChange={(e) => setBrush({ color: e.target.value })}
        />
      </div>

      <label className="mini-label">Size: {brush.size}px</label>
      <input
        type="range"
        min={1}
        max={80}
        value={brush.size}
        onChange={(e) => setBrush({ size: Number(e.target.value) })}
      />

      <label className="mini-label">
        Opacity: {Math.round(brush.opacity * 100)}%
      </label>
      <input
        type="range"
        min={0.05}
        max={1}
        step={0.01}
        value={brush.opacity}
        onChange={(e) => setBrush({ opacity: Number(e.target.value) })}
      />

      <p className="hint">Draw directly on the image with the brush.</p>

      {drawLayers.length > 0 && (
        <>
          <div className="row spread">
            <span className="mini-label">{drawLayers.length} stroke(s)</span>
            <button
              className="btn ghost"
              onClick={() =>
                commit((d) => {
                  d.layers = d.layers.filter((l) => l.type !== 'draw')
                })
              }
            >
              Clear all
            </button>
          </div>
          <div className="layer-list">
            {drawLayers.map((l, i) => (
              <div key={l.id} className="layer-row">
                <span className="layer-swatch" style={{ background: l.color }} />
                <span className="layer-name">Stroke {i + 1}</span>
                <span className="layer-del" onClick={() => removeLayer(l.id)}>
                  <Icon name="close" size={13} />
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
