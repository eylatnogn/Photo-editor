import { useEffect } from 'react'
import { useEditor } from './state/editorStore'
import { Dropzone } from './components/Dropzone'
import { TopBar } from './components/TopBar'
import { Toolbar, TOOLS } from './components/Toolbar'
import { EditorCanvas } from './components/EditorCanvas'
import { AdjustmentsPanel } from './components/panels/AdjustmentsPanel'
import { FiltersPanel } from './components/panels/FiltersPanel'
import { CropPanel } from './components/panels/CropPanel'
import { TextPanel } from './components/panels/TextPanel'
import { DrawPanel } from './components/panels/DrawPanel'
import { AIPanel } from './components/panels/AIPanel'
import { ExportPanel } from './components/panels/ExportPanel'

function ActivePanel() {
  const tool = useEditor((s) => s.activeTool)
  switch (tool) {
    case 'adjust':
      return <AdjustmentsPanel />
    case 'filters':
      return <FiltersPanel />
    case 'crop':
      return <CropPanel />
    case 'text':
      return <TextPanel />
    case 'draw':
      return <DrawPanel />
    case 'ai':
      return <AIPanel />
    case 'export':
      return <ExportPanel />
    default:
      return null
  }
}

export default function App() {
  const hasImage = useEditor((s) => s.hasImage)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const activeTool = useEditor((s) => s.activeTool)
  const panelOpen = useEditor((s) => s.panelOpen)
  const setPanelOpen = useEditor((s) => s.setPanelOpen)

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      )
        return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  if (!hasImage) {
    return (
      <div className="app">
        <Dropzone />
      </div>
    )
  }

  const toolLabel = TOOLS.find((t) => t.id === activeTool)?.label ?? ''

  return (
    <div className="app editing">
      <TopBar />
      <div className="workspace">
        <Toolbar />
        <main className="stage-area">
          <EditorCanvas />
        </main>
        <aside className={panelOpen ? 'sidebar' : 'sidebar collapsed'}>
          <button
            className="sheet-header"
            onClick={() => setPanelOpen(!panelOpen)}
            aria-label={panelOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <span className="sheet-grip" />
            <span className="sheet-title">{toolLabel}</span>
            <span className="sheet-chevron">{panelOpen ? '▾' : '▴'}</span>
          </button>
          <div className="sheet-body">
            <ActivePanel />
          </div>
        </aside>
      </div>
    </div>
  )
}
