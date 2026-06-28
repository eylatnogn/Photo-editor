import { useState } from 'react'
import { useEditor } from '../state/editorStore'
import { loadImageFromFile } from '../utils'

export function Dropzone() {
  const loadImage = useEditor((s) => s.loadImage)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        <div className="dropzone-icon">◎</div>
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
        {error && <p className="error-text">{error}</p>}
        <div className="feature-row">
          <span>🎛️ 20+ adjustments</span>
          <span>🎨 Filters</span>
          <span>⤢ Crop &amp; rotate</span>
          <span>✨ AI background removal</span>
          <span>T Text &amp; draw</span>
        </div>
      </div>
    </div>
  )
}
