import { useEditor } from '../../state/editorStore'
import { Slider } from '../ui/Slider'
import type { Adjustments } from '../../types'

// Helper to build a slider bound to a single adjustment key.
function adj(key: keyof Adjustments) {
  return (value: number) =>
    (doc: import('../../types').EditorDocument) => {
      doc.adjustments[key] = value
    }
}

export function AdjustmentsPanel() {
  const a = useEditor((s) => s.doc.adjustments)

  return (
    <div className="panel">
      <h3 className="panel-title">Light</h3>
      <Slider label="Exposure" value={a.exposure} min={-100} max={100} apply={adj('exposure')} />
      <Slider label="Brightness" value={a.brightness} min={-100} max={100} apply={adj('brightness')} />
      <Slider label="Contrast" value={a.contrast} min={-100} max={100} apply={adj('contrast')} />
      <Slider label="Highlights" value={a.highlights} min={-100} max={100} apply={adj('highlights')} />
      <Slider label="Shadows" value={a.shadows} min={-100} max={100} apply={adj('shadows')} />

      <h3 className="panel-title">Color</h3>
      <Slider label="Saturation" value={a.saturation} min={-100} max={100} apply={adj('saturation')} />
      <Slider label="Vibrance" value={a.vibrance} min={-100} max={100} apply={adj('vibrance')} />
      <Slider label="Temperature" value={a.temperature} min={-100} max={100} apply={adj('temperature')} />
      <Slider label="Tint" value={a.tint} min={-100} max={100} apply={adj('tint')} />
      <Slider label="Hue" value={a.hue} min={-180} max={180} apply={adj('hue')} format={(v) => `${Math.round(v)}°`} />

      <h3 className="panel-title">Tone / Levels</h3>
      <Slider label="Black Point" value={a.blackPoint} min={0} max={254} apply={adj('blackPoint')} defaultValue={0} />
      <Slider label="White Point" value={a.whitePoint} min={1} max={255} apply={adj('whitePoint')} defaultValue={255} />
      <Slider label="Gamma" value={a.gamma} min={0.2} max={2.5} step={0.01} apply={adj('gamma')} defaultValue={1} format={(v) => v.toFixed(2)} />

      <h3 className="panel-title">Effects</h3>
      <Slider label="Sharpen" value={a.sharpen} min={0} max={100} apply={adj('sharpen')} defaultValue={0} />
      <Slider label="Blur" value={a.blur} min={0} max={20} step={0.5} apply={adj('blur')} defaultValue={0} format={(v) => `${v.toFixed(1)}px`} />
      <Slider label="Vignette" value={a.vignette} min={0} max={100} apply={adj('vignette')} defaultValue={0} />
      <Slider label="Grain" value={a.grain} min={0} max={100} apply={adj('grain')} defaultValue={0} />
      <Slider label="Grayscale" value={a.grayscale} min={0} max={100} apply={adj('grayscale')} defaultValue={0} />
      <Slider label="Sepia" value={a.sepia} min={0} max={100} apply={adj('sepia')} defaultValue={0} />
      <Slider label="Invert" value={a.invert} min={0} max={100} apply={adj('invert')} defaultValue={0} />
    </div>
  )
}
