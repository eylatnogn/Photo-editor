import { useState } from 'react'
import { useEditor } from '../../state/editorStore'
import { Slider } from '../ui/Slider'
import { HSL_BANDS, type HslBand } from '../../types'

const BAND_COLORS: Record<HslBand, string> = {
  red: '#ff3b30',
  orange: '#ff9500',
  yellow: '#ffcc00',
  green: '#34c759',
  aqua: '#00c7be',
  blue: '#007aff',
  purple: '#5856d6',
  magenta: '#ff2d92',
}

export function SelectiveColorPanel() {
  const sc = useEditor((s) => s.doc.selectiveColor)
  const commit = useEditor((s) => s.commit)
  const [band, setBand] = useState<HslBand>('red')
  const ch = sc[band]
  const modified = (b: HslBand) =>
    sc[b].h !== 0 || sc[b].s !== 0 || sc[b].l !== 0

  return (
    <div className="panel">
      <h3 className="panel-title">Selective Color</h3>
      <p className="hint">
        Tune each color range independently — tap a color, then adjust its hue,
        saturation and luminance.
      </p>

      <div className="band-row">
        {HSL_BANDS.map((b) => (
          <button
            key={b}
            className={
              band === b ? 'band-chip active' : 'band-chip'
            }
            style={{ background: BAND_COLORS[b] }}
            onClick={() => setBand(b)}
            title={b}
          >
            {modified(b) && <span className="band-dot" />}
          </button>
        ))}
      </div>

      <div className="band-name">{band}</div>

      <Slider
        label="Hue"
        value={ch.h}
        min={-100}
        max={100}
        defaultValue={0}
        apply={(v) => (d) => {
          d.selectiveColor[band].h = v
        }}
      />
      <Slider
        label="Saturation"
        value={ch.s}
        min={-100}
        max={100}
        defaultValue={0}
        apply={(v) => (d) => {
          d.selectiveColor[band].s = v
        }}
      />
      <Slider
        label="Luminance"
        value={ch.l}
        min={-100}
        max={100}
        defaultValue={0}
        apply={(v) => (d) => {
          d.selectiveColor[band].l = v
        }}
      />

      <button
        className="btn ghost full"
        onClick={() =>
          commit((d) => {
            d.selectiveColor[band] = { h: 0, s: 0, l: 0 }
          })
        }
      >
        Reset {band}
      </button>
    </div>
  )
}
