import { useEditor } from '../../state/editorStore'
import { Icon } from '../ui/Icon'
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
  const selectedId = useEditor((s) => s.selectedLayerId)
  const selectLayer = useEditor((s) => s.selectLayer)
  const updateLayer = useEditor((s) => s.updateLayer)
  const removeLayer = useEditor((s) => s.removeLayer)
  const moveLayer = useEditor((s) => s.moveLayer)
  const duplicateLayer = useEditor((s) => s.duplicateLayer)

  const selected = layers.find((l) => l.id === selectedId)
  // Front-most (drawn last) at the top of the list.
  const ordered = [...layers].reverse()

  return (
    <div className="panel">
      <h3 className="panel-title">Layers</h3>

      {layers.length === 0 ? (
        <p className="hint">
          No layers yet. Add text, photos or stickers and they'll stack here —
          drag to reorder, hide, lock or delete them.
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
        </>
      )}
    </div>
  )
}
