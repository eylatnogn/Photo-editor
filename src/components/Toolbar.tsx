import { useEditor } from '../state/editorStore'
import type { ToolId } from '../types'

export const TOOLS: Array<{ id: ToolId; icon: string; label: string }> = [
  { id: 'adjust', icon: '🎛️', label: 'Adjust' },
  { id: 'filters', icon: '🎨', label: 'Filters' },
  { id: 'crop', icon: '⤢', label: 'Crop' },
  { id: 'text', icon: 'T', label: 'Text' },
  { id: 'draw', icon: '✎', label: 'Draw' },
  { id: 'ai', icon: '✨', label: 'AI' },
  { id: 'export', icon: '⤓', label: 'Export' },
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
          <span className="tool-icon">{t.icon}</span>
          <span className="tool-label">{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
