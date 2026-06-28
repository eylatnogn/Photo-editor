import { useEffect } from 'react'
import { useEditor } from './state/editorStore'
import { Dropzone } from './components/Dropzone'
import { TopBar } from './components/TopBar'
import { Toolbar } from './components/Toolbar'
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

  return (
    <div className="app editing">
      <TopBar />
      <div className="workspace">
        <Toolbar />
        <main className="stage-area">
          <EditorCanvas />
        </main>
        <aside className="sidebar">
          <ActivePanel />
        </aside>
      </div>
    </div>
  )
}
