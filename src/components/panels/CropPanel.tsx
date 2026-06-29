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

// `ratio` is the desired output width/height in *pixels*. The crop is stored in
// normalized [0..1] source coordinates, so we must account for the source's own
// aspect ratio (srcAspect = sourceWidth / sourceHeight) to land on the right
// shape — otherwise e.g. "1:1" on a 4:3 photo would crop nothing.
function setAspectCrop(ratio: number | null, srcAspect: number) {
  return (doc: EditorDocument) => {
    if (ratio === null) {
      doc.transform.crop = { x: 0, y: 0, width: 1, height: 1 }
      return
    }
    const normRatio = ratio / srcAspect // width/height in normalized space
    let w = 1
    let h = w / normRatio
    if (h > 1) {
      h = 1
      w = h * normRatio
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
  const source = useEditor((s) => s.source)
  const setExportMode = useEditor((s) => s.setExportMode)
  const setActiveTool = useEditor((s) => s.setActiveTool)
  const srcAspect = source
    ? (source instanceof HTMLImageElement ? source.naturalWidth : source.width) /
      (source instanceof HTMLImageElement ? source.naturalHeight : source.height)
    : 1

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
            onClick={() => commit(setAspectCrop(a.ratio, srcAspect))}
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

      <h3 className="panel-title">Carousel</h3>
      <p className="hint">
        Turn a wide shot into a seamless Instagram carousel — it's split into
        slides that read as one continuous panorama when you swipe.
      </p>
      <button
        className="btn primary full"
        onClick={() => {
          setExportMode('carousel')
          setActiveTool('export')
        }}
      >
        <Icon name="layers" size={15} /> Build a carousel
      </button>
    </div>
  )
}
