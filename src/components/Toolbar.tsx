import { useEditor } from '../state/editorStore'
import type { ToolId } from '../types'
import { Icon, type IconName } from './ui/Icon'

export const TOOLS: Array<{ id: ToolId; icon: IconName; label: string }> = [
  { id: 'adjust', icon: 'adjust', label: 'Adjust' },
  { id: 'filters', icon: 'filters', label: 'Filters' },
  { id: 'curves', icon: 'curves', label: 'Curves' },
  { id: 'selective', icon: 'color', label: 'Color' },
  { id: 'crop', icon: 'crop', label: 'Crop' },
  { id: 'retouch', icon: 'retouch', label: 'Retouch' },
  { id: 'texture', icon: 'texture', label: 'Texture' },
  { id: 'frame', icon: 'frame', label: 'Frame' },
  { id: 'text', icon: 'text', label: 'Text' },
  { id: 'draw', icon: 'draw', label: 'Draw' },
  { id: 'ai', icon: 'ai', label: 'AI' },
  { id: 'export', icon: 'export', label: 'Export' },
]

export function Toolbar() {
  const activeTool = useEditor((s) => s.activeTool)
  const panelOpen = useEditor((s) => s.panelOpen)
  const setActiveTool = useEditor((s) => s.setActiveTool)
  const setPanelOpen = useEditor((s) => s.setPanelOpen)
  const selectLayer = useEditor((s) => s.selectLayer)

  return (
    <nav className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={activeTool === t.id ? 'tool active' : 'tool'}
          onClick={() => {
            // Re-tapping the active tool toggles the panel (handy on mobile).
            if (activeTool === t.id) {
              setPanelOpen(!panelOpen)
            } else {
              setActiveTool(t.id)
            }
            if (t.id !== 'text') selectLayer(null)
          }}
          title={t.label}
        >
          <span className="tool-icon">
            <Icon name={t.icon} size={20} />
          </span>
          <span className="tool-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
