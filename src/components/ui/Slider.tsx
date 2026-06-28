import { useRef } from 'react'
import { useEditor } from '../../state/editorStore'
import type { EditorDocument } from '../../types'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  // Returns a doc mutator that sets this value.
  apply: (value: number) => (doc: EditorDocument) => void
  format?: (v: number) => string
  defaultValue?: number
}

/**
 * A labelled range slider wired into the editor's live/commit history model:
 * the first interaction in a drag snapshots state for undo, and the snapshot is
 * committed to history on release. A ref guards the snapshot so it is taken
 * exactly once per drag despite intermediate re-renders.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  apply,
  format,
  defaultValue = 0,
}: SliderProps) {
  const beginLive = useEditor((s) => s.beginLive)
  const live = useEditor((s) => s.live)
  const endLive = useEditor((s) => s.endLive)
  const dragging = useRef(false)

  const ensureBegin = () => {
    if (!dragging.current) {
      dragging.current = true
      beginLive()
    }
  }

  const finish = () => {
    if (dragging.current) {
      dragging.current = false
      endLive()
    }
  }

  const display = format ? format(value) : String(Math.round(value))
  const modified = Math.abs(value - defaultValue) > 0.0001

  return (
    <div className="slider">
      <div className="slider-head">
        <span className={modified ? 'slider-label modified' : 'slider-label'}>
          {label}
        </span>
        <span className="slider-value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={ensureBegin}
        onChange={(e) => {
          ensureBegin()
          live(apply(parseFloat(e.target.value)))
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onBlur={finish}
        onDoubleClick={() => {
          beginLive()
          live(apply(defaultValue))
          endLive()
        }}
      />
    </div>
  )
}
