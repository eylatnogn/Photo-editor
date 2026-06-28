import { useEditor } from '../../state/editorStore'
import { Slider } from '../ui/Slider'
import type { FrameType } from '../../types'

const FRAME_TYPES: Array<{ id: FrameType; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'solid', label: 'Solid' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'film', label: 'Film' },
  { id: 'polaroid', label: 'Polaroid' },
]

const PRESET_COLORS = ['#ffffff', '#000000', '#f4efe6', '#1d2029', '#ff3b30']

export function FramePanel() {
  const frame = useEditor((s) => s.doc.frame)
  const commit = useEditor((s) => s.commit)
  const usesColor = frame.type === 'solid' || frame.type === 'rounded' || frame.type === 'polaroid'

  return (
    <div className="panel">
      <h3 className="panel-title">Borders &amp; Frames</h3>

      <div className="aspect-grid">
        {FRAME_TYPES.map((f) => (
          <button
            key={f.id}
            className={frame.type === f.id ? 'btn chip active' : 'btn chip'}
            onClick={() => commit((d) => (d.frame.type = f.id))}
          >
            {f.label}
          </button>
        ))}
      </div>

      {frame.type !== 'none' && (
        <>
          <Slider
            label="Thickness"
            value={frame.size}
            min={1}
            max={25}
            step={0.5}
            defaultValue={6}
            format={(v) => `${v.toFixed(1)}%`}
            apply={(v) => (d) => {
              d.frame.size = v
            }}
          />

          {usesColor && (
            <>
              <label className="mini-label">Color</label>
              <div className="swatches">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={frame.color === c ? 'swatch active' : 'swatch'}
                    style={{ background: c }}
                    onClick={() => commit((d) => (d.frame.color = c))}
                  />
                ))}
                <input
                  type="color"
                  value={frame.color}
                  onChange={(e) => commit((d) => (d.frame.color = e.target.value))}
                />
              </div>
            </>
          )}
        </>
      )}

      <p className="hint">
        Frames are added around the final image and included at full resolution
        when you export.
      </p>
    </div>
  )
}
