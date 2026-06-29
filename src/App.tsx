import { useEffect } from 'react'
import { useEditor } from './state/editorStore'
import { Dropzone } from './components/Dropzone'
import { TopBar } from './components/TopBar'
import { Toolbar, TOOLS } from './components/Toolbar'
import { Sheet } from './components/Sheet'
import { EditorCanvas } from './components/EditorCanvas'
import { AdjustmentsPanel } from './components/panels/AdjustmentsPanel'
import { FiltersPanel } from './components/panels/FiltersPanel'
import { CurvesPanel } from './components/panels/CurvesPanel'
import { SelectiveColorPanel } from './components/panels/SelectiveColorPanel'
import { CropPanel } from './components/panels/CropPanel'
import { RetouchPanel } from './components/panels/RetouchPanel'
import { TexturePanel } from './components/panels/TexturePanel'
import { FramePanel } from './components/panels/FramePanel'
import { TextPanel } from './components/panels/TextPanel'
import { StickerPanel } from './components/panels/StickerPanel'
import { LayersPanel } from './components/panels/LayersPanel'
import { DrawPanel } from './components/panels/DrawPanel'
import { AIPanel } from './components/panels/AIPanel'
import { ExportPanel } from './components/panels/ExportPanel'
import { DraftsModal } from './components/DraftsModal'

function ActivePanel() {
  const tool = useEditor((s) => s.activeTool)
  switch (tool) {
    case 'adjust':
      return <AdjustmentsPanel />
    case 'filters':
      return <FiltersPanel />
    case 'curves':
      return <CurvesPanel />
    case 'selective':
      return <SelectiveColorPanel />
    case 'crop':
      return <CropPanel />
    case 'retouch':
      return <RetouchPanel />
    case 'texture':
      return <TexturePanel />
    case 'frame':
      return <FramePanel />
    case 'text':
      return <TextPanel />
    case 'sticker':
      return <StickerPanel />
    case 'layers':
      return <LayersPanel />
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
        <DraftsModal />
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
        <Sheet title={toolLabel}>
          <ActivePanel />
        </Sheet>
      </div>
      <DraftsModal />
    </div>
  )
}
