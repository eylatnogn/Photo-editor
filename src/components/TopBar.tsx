import { useEditor } from '../state/editorStore'
import { loadImageFromFile } from '../utils'

export function TopBar() {
  const fileName = useEditor((s) => s.fileName)
  const hasImage = useEditor((s) => s.hasImage)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const past = useEditor((s) => s.past)
  const future = useEditor((s) => s.future)
  const resetEdits = useEditor((s) => s.resetEdits)
  const setShowOriginal = useEditor((s) => s.setShowOriginal)
  const loadImage = useEditor((s) => s.loadImage)

  const openFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = await loadImageFromFile(file)
    loadImage(img, file.name)
    e.target.value = ''
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">◎</span>
        <span className="brand-name">Aperture</span>
      </div>

      {hasImage && (
        <>
          <div className="topbar-center">
            <span className="filename">{fileName}</span>
          </div>

          <div className="topbar-actions">
            <button
              className="btn icon"
              onClick={undo}
              disabled={past.length === 0}
              title="Undo (Ctrl+Z)"
            >
              ↶
            </button>
            <button
              className="btn icon"
              onClick={redo}
              disabled={future.length === 0}
              title="Redo (Ctrl+Shift+Z)"
            >
              ↷
            </button>
            <button
              className="btn"
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              onPointerCancel={() => setShowOriginal(false)}
              title="Hold to compare with original"
            >
              <span className="btn-text">Compare</span>
              <span className="btn-icon-only">◐</span>
            </button>
            <button className="btn ghost hide-mobile" onClick={resetEdits}>
              Reset
            </button>
            <label className="btn">
              <span className="btn-text">Open</span>
              <span className="btn-icon-only">📁</span>
              <input
                type="file"
                accept="image/*"
                onChange={openFile}
                hidden
              />
            </label>
          </div>
        </>
      )}
    </header>
  )
}
