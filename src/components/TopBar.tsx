import { useState } from 'react'
import { useEditor } from '../state/editorStore'
import { loadImageFromFile } from '../utils'
import { saveCurrentProject } from '../engine/projects'
import { Icon } from './ui/Icon'

export function TopBar() {
  const fileName = useEditor((s) => s.fileName)
  const hasImage = useEditor((s) => s.hasImage)
  const undo = useEditor((s) => s.undo)
  const redo = useEditor((s) => s.redo)
  const canUndo = useEditor((s) => s.actionLog.length > 0)
  const canRedo = useEditor((s) => s.actionRedo.length > 0)
  const resetEdits = useEditor((s) => s.resetEdits)
  const setShowOriginal = useEditor((s) => s.setShowOriginal)
  const loadImage = useEditor((s) => s.loadImage)
  const setDraftsOpen = useEditor((s) => s.setDraftsOpen)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const openFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const img = await loadImageFromFile(file)
    loadImage(img, file.name)
    e.target.value = ''
  }

  const saveDraft = async () => {
    setSaveState('saving')
    try {
      await saveCurrentProject()
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1800)
    } catch {
      setSaveState('idle')
    }
  }

  return (
    <header className="topbar">
      <div className="brand">
        <span className="logo">
          <Icon name="logo" size={22} />
        </span>
        <span className="brand-name">Vividly</span>
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
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <Icon name="undo" size={18} />
            </button>
            <button
              className="btn icon"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Icon name="redo" size={18} />
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
              <span className="btn-icon-only">
                <Icon name="compare" size={16} />
              </span>
            </button>
            <button className="btn ghost hide-mobile" onClick={resetEdits}>
              Reset
            </button>
            <button
              className={saveState === 'saved' ? 'btn saved' : 'btn'}
              onClick={saveDraft}
              disabled={saveState === 'saving'}
              title="Save a draft to come back to later"
            >
              <span className="btn-text">
                {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Save'}
              </span>
              <span className="btn-icon-only">
                <Icon name="save" size={16} />
              </span>
            </button>
            <button
              className="btn"
              onClick={() => setDraftsOpen(true)}
              title="Open a saved draft"
            >
              <span className="btn-text">Drafts</span>
              <span className="btn-icon-only">
                <Icon name="folder" size={16} />
              </span>
            </button>
            <label className="btn">
              <span className="btn-text">Open</span>
              <span className="btn-icon-only">
                <Icon name="open" size={16} />
              </span>
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
