import { useEditor } from '../../state/editorStore'
import type { RetouchMode } from '../../state/editorStore'
import { Icon, type IconName } from '../ui/Icon'

const MODES: Array<{ id: RetouchMode; label: string; icon: IconName; desc: string }> = [
  {
    id: 'cleanup',
    label: 'Cleanup',
    icon: 'heal',
    desc: 'Brush over blemishes, spots or distractions to heal them using nearby texture.',
  },
  {
    id: 'smooth',
    label: 'Smooth',
    icon: 'smooth',
    desc: 'Brush over skin, noise or texture to gently blur and soften it — no color is painted.',
  },
  {
    id: 'erase',
    label: 'Magic Eraser',
    icon: 'eraser',
    desc: 'Tap an area to erase everything of a similar color (transparent). Great for clean backgrounds.',
  },
]

export function RetouchPanel() {
  const tool = useEditor((s) => s.retouchTool)
  const setTool = useEditor((s) => s.setRetouchTool)
  const clearRetouch = useEditor((s) => s.clearRetouch)
  const undo = useEditor((s) => s.undo)
  const hasRetouch = useEditor(
    (s) => s.retouchPast.length > 0 || s.retouchVersion > 0,
  )
  const mode = MODES.find((m) => m.id === tool.mode)!

  return (
    <div className="panel">
      <h3 className="panel-title">Retouch</h3>

      <div className="mode-grid">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={tool.mode === m.id ? 'mode-cell active' : 'mode-cell'}
            onClick={() => setTool({ mode: m.id })}
          >
            <span className="mode-icon">
              <Icon name={m.icon} size={22} />
            </span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      <p className="hint">{mode.desc}</p>

      {tool.mode !== 'erase' ? (
        <>
          <label className="mini-label">Brush size: {tool.size}</label>
          <input
            type="range"
            min={4}
            max={120}
            value={tool.size}
            onChange={(e) => setTool({ size: Number(e.target.value) })}
          />

          {tool.mode === 'smooth' && (
            <>
              <label className="mini-label">
                Strength: {Math.round(tool.hardness * 100)}%
              </label>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.01}
                value={tool.hardness}
                onChange={(e) => setTool({ hardness: Number(e.target.value) })}
              />
            </>
          )}
        </>
      ) : (
        <>
          <label className="mini-label">Tolerance: {tool.tolerance}</label>
          <input
            type="range"
            min={5}
            max={120}
            value={tool.tolerance}
            onChange={(e) => setTool({ tolerance: Number(e.target.value) })}
          />
          <p className="hint">
            Higher tolerance erases a wider range of colors per tap.
          </p>
        </>
      )}

      <div className="row gap" style={{ marginTop: 12 }}>
        <button className="btn" onClick={undo}>
          <Icon name="undo" size={15} /> Undo
        </button>
        {hasRetouch && (
          <button className="btn ghost" onClick={clearRetouch}>
            Clear retouch
          </button>
        )}
      </div>
    </div>
  )
}
