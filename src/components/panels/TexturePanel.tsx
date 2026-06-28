import { useEditor } from '../../state/editorStore'
import { Slider } from '../ui/Slider'
import type { LeakStyle } from '../../types'

const LEAK_STYLES: Array<{ id: LeakStyle; label: string }> = [
  { id: 'warm', label: 'Warm' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'cool', label: 'Cool' },
  { id: 'rainbow', label: 'Prism' },
]

export function TexturePanel() {
  const tex = useEditor((s) => s.doc.texture)
  const commit = useEditor((s) => s.commit)

  return (
    <div className="panel">
      <h3 className="panel-title">Textures</h3>

      <h3 className="panel-title">Light Leak</h3>
      <Slider
        label="Intensity"
        value={tex.lightLeak}
        min={0}
        max={100}
        defaultValue={0}
        apply={(v) => (d) => {
          d.texture.lightLeak = v
        }}
      />
      <div className="row gap">
        {LEAK_STYLES.map((s) => (
          <button
            key={s.id}
            className={tex.leakStyle === s.id ? 'btn chip active' : 'btn chip'}
            onClick={() => commit((d) => (d.texture.leakStyle = s.id))}
          >
            {s.label}
          </button>
        ))}
      </div>
      <Slider
        label="Position"
        value={tex.leakAngle}
        min={0}
        max={360}
        defaultValue={45}
        format={(v) => `${Math.round(v)}°`}
        apply={(v) => (d) => {
          d.texture.leakAngle = v
        }}
      />

      <h3 className="panel-title">Dust &amp; Scratches</h3>
      <Slider
        label="Amount"
        value={tex.dust}
        min={0}
        max={100}
        defaultValue={0}
        apply={(v) => (d) => {
          d.texture.dust = v
        }}
      />

      <h3 className="panel-title">Bokeh</h3>
      <Slider
        label="Amount"
        value={tex.bokeh}
        min={0}
        max={100}
        defaultValue={0}
        apply={(v) => (d) => {
          d.texture.bokeh = v
        }}
      />

      <button
        className="btn ghost full"
        onClick={() =>
          commit((d) => {
            d.texture.lightLeak = 0
            d.texture.dust = 0
            d.texture.bokeh = 0
          })
        }
      >
        Clear textures
      </button>
    </div>
  )
}
