import { useEditor } from '../../state/editorStore'
import type { RetouchMode } from '../../state/editorStore'
import { Icon, type IconName } from '../ui/Icon'

interface ToolDef {
  id: RetouchMode
  label: string
  icon: IconName
  desc: string
}

const TOOLS: ToolDef[] = [
  {
    id: 'repair',
    label: 'Repair',
    icon: 'heal',
    desc: 'Brush over spots, blemishes or small distractions — they’re replaced with clean nearby texture, colour-matched so they blend in.',
  },
  {
    id: 'remove',
    label: 'Remove',
    icon: 'wand',
    desc: 'Tap an object to erase it — the surrounding background is filled in over it. Works best on fairly even backgrounds (sky, walls, water). Tap again to extend.',
  },
  {
    id: 'clone',
    label: 'Clone',
    icon: 'copy',
    desc: 'Copy one part of the photo onto another. Tap once to set the source, then brush where you want it painted.',
  },
  {
    id: 'smooth',
    label: 'Smooth',
    icon: 'smooth',
    desc: 'Soften skin, noise or texture. Brush gently — no colour is painted, it just blurs what’s underneath.',
  },
  {
    id: 'dodge',
    label: 'Brighten',
    icon: 'sun',
    desc: 'Lighten as you brush — great for eyes, teeth, highlights or lifting shadows on a face.',
  },
  {
    id: 'burn',
    label: 'Darken',
    icon: 'moon',
    desc: 'Darken as you brush — deepen shadows, add contour or rein in blown-out areas.',
  },
  {
    id: 'sharpen',
    label: 'Sharpen',
    icon: 'sparkle',
    desc: 'Add local crispness — bring out detail in eyes, hair or text without sharpening the whole photo.',
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
  const active = TOOLS.find((t) => t.id === tool.mode)!
  const isBrush = tool.mode !== 'remove'

  return (
    <div className="panel">
      <h3 className="panel-title">Retouch</h3>

      <div className="retouch-grid">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool.mode === t.id ? 'mode-cell active' : 'mode-cell'}
            onClick={() => setTool({ mode: t.id })}
            title={t.label}
          >
            <span className="mode-icon">
              <Icon name={t.icon} size={20} />
            </span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <p className="hint">{active.desc}</p>

      {tool.mode === 'clone' && (
        <div className="clone-status">
          <span className={tool.cloneSource ? 'dot on' : 'dot'} />
          {tool.cloneSource ? 'Source set — brush to clone' : 'Tap the photo to set a source'}
          {tool.cloneSource && (
            <button className="btn tiny" onClick={() => setTool({ cloneSource: null })}>
              Reset source
            </button>
          )}
        </div>
      )}

      {isBrush ? (
        <>
          <label className="mini-label">Brush size: {tool.size}</label>
          <input
            type="range"
            min={4}
            max={120}
            value={tool.size}
            onChange={(e) => setTool({ size: Number(e.target.value) })}
          />
          <label className="mini-label">Strength: {Math.round(tool.strength * 100)}%</label>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={tool.strength}
            onChange={(e) => setTool({ strength: Number(e.target.value) })}
          />
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
            Higher tolerance removes a wider range of colours per tap.
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
