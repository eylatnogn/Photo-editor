import { useEditor } from '../../state/editorStore'
import { Slider } from '../ui/Slider'
import { Icon } from '../ui/Icon'
import type { EditorDocument } from '../../types'

const ASPECTS: Array<{ label: string; ratio: number | null }> = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '3:2', ratio: 3 / 2 },
  { label: '2:3', ratio: 2 / 3 },
]

function setAspectCrop(ratio: number | null) {
  return (doc: EditorDocument) => {
    if (ratio === null) {
      doc.transform.crop = { x: 0, y: 0, width: 1, height: 1 }
      return
    }
    // Largest centered rect of the given aspect within the unit square.
    let w = 1
    let h = w / ratio
    if (h > 1) {
      h = 1
      w = h * ratio
    }
    doc.transform.crop = {
      x: (1 - w) / 2,
      y: (1 - h) / 2,
      width: w,
      height: h,
    }
  }
}

export function CropPanel() {
  const transform = useEditor((s) => s.doc.transform)
  const commit = useEditor((s) => s.commit)

  const rotate90 = () =>
    commit((d) => {
      d.transform.rotation = (d.transform.rotation + 90) % 360
    })

  return (
    <div className="panel">
      <h3 className="panel-title">Crop &amp; Rotate</h3>

      <label className="mini-label">Aspect ratio</label>
      <div className="aspect-grid">
        {ASPECTS.map((a) => (
          <button
            key={a.label}
            className="btn chip"
            onClick={() => commit(setAspectCrop(a.ratio))}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="row gap">
        <button className="btn" onClick={rotate90}>
          <Icon name="rotate" size={16} /> Rotate 90°
        </button>
        <button
          className="btn"
          onClick={() => commit((d) => (d.transform.flipH = !d.transform.flipH))}
        >
          <Icon name="flipH" size={16} /> Flip H
        </button>
        <button
          className="btn"
          onClick={() => commit((d) => (d.transform.flipV = !d.transform.flipV))}
        >
          <Icon name="flipV" size={16} /> Flip V
        </button>
      </div>

      <Slider
        label="Straighten"
        value={transform.rotation > 180 ? transform.rotation - 360 : transform.rotation}
        min={-45}
        max={45}
        step={0.5}
        defaultValue={0}
        format={(v) => `${v.toFixed(1)}°`}
        apply={(v) => (d) => {
          d.transform.rotation = ((v % 360) + 360) % 360
        }}
      />

      <button
        className="btn ghost full"
        onClick={() =>
          commit((d) => {
            d.transform.crop = { x: 0, y: 0, width: 1, height: 1 }
            d.transform.rotation = 0
            d.transform.flipH = false
            d.transform.flipV = false
          })
        }
      >
        Reset crop &amp; rotation
      </button>

      <p className="hint">
        Drag the handles on the image to fine-tune the crop region.
      </p>
    </div>
  )
}
