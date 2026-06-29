import { useEffect, useState } from 'react'
import { useEditor } from '../state/editorStore'
import {
  listProjects,
  openProject,
  deleteProject,
  renameProject,
  saveCurrentProject,
  type ProjectMeta,
} from '../engine/projects'
import { Icon } from './ui/Icon'

function timeAgo(ts: number): string {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hr ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}

export function DraftsModal() {
  const open = useEditor((s) => s.draftsOpen)
  const setOpen = useEditor((s) => s.setDraftsOpen)
  const hasImage = useEditor((s) => s.hasImage)
  const currentId = useEditor((s) => s.currentProjectId)

  const [drafts, setDrafts] = useState<ProjectMeta[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')

  const refresh = () => listProjects().then(setDrafts).catch(() => setError('Could not read your drafts.'))

  useEffect(() => {
    if (open) {
      setError(null)
      refresh()
    }
  }, [open])

  if (!open) return null

  const saveNow = async (asNew: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (asNew) useEditor.getState().setCurrentProjectId(null)
      await saveCurrentProject()
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  }

  const load = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      await openProject(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that draft.')
      setBusy(false)
    }
  }

  const remove = async (id: string) => {
    setBusy(true)
    try {
      await deleteProject(id)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const commitRename = async (id: string) => {
    const n = name.trim()
    setEditing(null)
    if (n) {
      await renameProject(id, n)
      await refresh()
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal drafts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Your drafts</h2>
          <button className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>

        {hasImage && (
          <div className="drafts-actions">
            <button className="btn primary" disabled={busy} onClick={() => saveNow(false)}>
              <Icon name="save" size={15} /> {currentId ? 'Save changes' : 'Save this draft'}
            </button>
            {currentId && (
              <button className="btn" disabled={busy} onClick={() => saveNow(true)}>
                <Icon name="copy" size={15} /> Save as new
              </button>
            )}
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        {drafts.length === 0 ? (
          <p className="hint drafts-empty">
            No saved drafts yet. Save your work here and pick it back up any time —
            everything stays on this device.
          </p>
        ) : (
          <div className="drafts-grid">
            {drafts.map((d) => (
              <div key={d.id} className={d.id === currentId ? 'draft-card current' : 'draft-card'}>
                <button className="draft-thumb" disabled={busy} onClick={() => load(d.id)} title="Open draft">
                  <img src={d.thumbnail} alt="" />
                  {d.id === currentId && <span className="draft-badge">Editing</span>}
                </button>
                <div className="draft-meta">
                  {editing === d.id ? (
                    <input
                      className="draft-name-input"
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => commitRename(d.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename(d.id)
                        if (e.key === 'Escape') setEditing(null)
                      }}
                    />
                  ) : (
                    <button
                      className="draft-name"
                      onClick={() => {
                        setEditing(d.id)
                        setName(d.name)
                      }}
                      title="Rename"
                    >
                      {d.name}
                    </button>
                  )}
                  <span className="draft-time">{timeAgo(d.updatedAt)}</span>
                </div>
                <button
                  className="draft-del"
                  disabled={busy}
                  onClick={() => remove(d.id)}
                  title="Delete draft"
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
