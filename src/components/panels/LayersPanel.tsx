import { useRef } from 'react'
import { useEditor } from '../../state/editorStore'
import { useAddPhoto } from '../../hooks/useAddPhoto'
import { Icon } from '../ui/Icon'
import { RemoveBgButton } from '../RemoveBgButton'
import { getSticker } from '../../engine/stickers'
import type { Layer } from '../../types'

function layerName(l: Layer): string {
  switch (l.type) {
    case 'text':
      return l.text.split('\n')[0] || 'Text'
    case 'image':
      return 'Photo'
    case 'sticker': {
      const def = getSticker(l.sticker)
      return def?.emoji ? `Sticker ${def.emoji}` : def?.label ?? 'Sticker'
    }
    case 'draw':
      return 'Drawing'
  }
}

function layerIcon(l: Layer): Parameters<typeof Icon>[0]['name'] {
  switch (l.type) {
    case 'text':
      return 'text'
    case 'image':
      return 'photo'
    case 'sticker':
      return 'sticker'
    case 'draw':
      return 'draw'
  }
}

export function LayersPanel() {
  const layers = useEditor((s) => s.doc.layers)
  const source = useEditor((s) => s.source)
  const selectedId = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const removeLayer = useEditor((s) => s.removeLayer)
  const moveLayer = useEditor((s) => s.moveLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)
  const addPhoto = useAddPhoto()
  const fileInput = useRef<HTMLInputElement>(null)

  const selected = layers.find((l) => l.id === selectedId)
  // Front-most (drawn last) at the top of the list.
  const ordered = [...layers].reverse()

  return (
    <div className="panel">
      <h3 className="panel-title">Layers</h3>
      <button className="btn primary block" onClick={() => fileInput.current?.click()}>
        <Icon name="photo" size={16} /> Add photos
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ''
          for (const f of files) await addPhoto(f)
        }}
      />

      {layers.length === 0 ? (
        <p className="hint">
          Add text, photos or stickers and they'll stack here — drag to reorder,
          hide, lock or delete them. Your base photo stays locked at the bottom.
        </p>
      ) : (
        <div className="layer-stack">
          {ordered.map((l) => {
            const idx = layers.indexOf(l)
            return (
              <div
                key={l.id}
                className={l.id === selectedId ? 'lyr-row active' : 'lyr-row'}
                onClick={() => selectLayer(l.id)}
              >
                <Icon name={layerIcon(l)} size={15} />
                <span className="lyr-name">{layerName(l)}</span>
                <button
                  className="lyr-btn"
                  title="Bring forward"
                  disabled={idx === layers.length - 1}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveLayer(l.id, 'up')
                  }}
                >
                  <Icon name="chevronUp" size={15} />
                </button>
                <button
                  className="lyr-btn"
                  title="Send backward"
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation()
                    moveLayer(l.id, 'down')
                  }}
                >
                  <Icon name="chevronDown" size={15} />
                </button>
                <button
                  className="lyr-btn"
                  title={l.hidden ? 'Show' : 'Hide'}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateLayer(l.id, { hidden: !l.hidden })
                  }}
                >
                  <Icon name={l.hidden ? 'eyeOff' : 'eye'} size={15} />
                </button>
                <button
                  className="lyr-btn"
                  title={l.locked ? 'Unlock' : 'Lock'}
                  onClick={(e) => {
                    e.stopPropagation()
                    updateLayer(l.id, { locked: !l.locked })
                  }}
                >
                  <Icon name={l.locked ? 'lock' : 'unlock'} size={15} />
                </button>
                <button
                  className="lyr-btn"
                  title="Duplicate"
                  onClick={(e) => {
                    e.stopPropagation()
                    duplicateLayer(l.id)
                  }}
                >
                  <Icon name="copy" size={14} />
                </button>
                <button
                  className="lyr-btn danger"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeLayer(l.id)
                  }}
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            )
          })}
          {source && (
            <div className="lyr-row base" title="Your base photo — locked">
              <Icon name="photo" size={15} />
              <span className="lyr-name">Main image</span>
              <span className="lyr-base-tag">
                <Icon name="lock" size={13} /> Locked
              </span>
            </div>
          )}
        </div>
      )}

      {layers.length === 0 && source && (
        <div className="layer-stack">
          <div className="lyr-row base" title="Your base photo — locked">
            <Icon name="photo" size={15} />
            <span className="lyr-name">Main image</span>
            <span className="lyr-base-tag">
              <Icon name="lock" size={13} /> Locked
            </span>
          </div>
        </div>
      )}

      {selected && (
        <>
          <label className="mini-label">
            Opacity: {Math.round(selected.opacity * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={selected.opacity}
            onChange={(e) => updateLayer(selected.id, { opacity: Number(e.target.value) })}
          />
          {selected.type === 'image' && (
            <div style={{ marginTop: 10 }}>
              <RemoveBgButton
                src={selected.src}
                block
                onDone={(url, ratio) => updateLayer(selected.id, { src: url, naturalRatio: ratio })}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
