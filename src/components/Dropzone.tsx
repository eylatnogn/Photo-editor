import { useEffect, useState } from 'react'
import { useEditor } from '../state/editorStore'
import { loadImageFromFile } from '../utils'
import { listProjects } from '../engine/projects'
import { Icon } from './ui/Icon'

export function Dropzone() {
  const loadImage = useEditor((s) => s.loadImage)
  const setDraftsOpen = useEditor((s) => s.setDraftsOpen)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draftCount, setDraftCount] = useState(0)

  useEffect(() => {
    listProjects()
      .then((d) => setDraftCount(d.length))
      .catch(() => undefined)
  }, [])

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError(null)
    try {
      const img = await loadImageFromFile(file)
      loadImage(img, file.name)
    } catch {
      setError('Could not open that image.')
    }
  }

  return (
    <div
      className={dragging ? 'dropzone dragging' : 'dropzone'}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const file = e.dataTransfer.files?.[0]
        if (file) handleFile(file)
      }}
    >
      <div className="dropzone-inner">
        <div className="dropzone-icon">
          <Icon name="logo" size={64} strokeWidth={1.4} />
        </div>
        <h1>Aperture Photo Editor</h1>
        <p className="sub">
          Crop, retouch, filter, add text and remove backgrounds with AI — all
          in your browser. Nothing is uploaded; your photos never leave your
          device.
        </p>
        <label className="btn primary big">
          Choose a photo
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
        <p className="drop-hint">or drag &amp; drop an image here</p>
        {draftCount > 0 && (
          <button className="btn ghost resume-drafts" onClick={() => setDraftsOpen(true)}>
            <Icon name="folder" size={16} /> Resume a draft ({draftCount})
          </button>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="feature-row">
          <span><Icon name="adjust" size={15} /> 20+ adjustments</span>
          <span><Icon name="filters" size={15} /> Filters</span>
          <span><Icon name="crop" size={15} /> Crop &amp; rotate</span>
          <span><Icon name="ai" size={15} /> AI tools</span>
          <span><Icon name="text" size={15} /> Text &amp; draw</span>
        </div>
      </div>
    </div>
  )
}
