import { useRef, useState } from 'react'
import { useEditor } from '../../state/editorStore'
import type { CurveChannel, CurvePoint } from '../../types'

const CHANNELS: Array<{ id: CurveChannel; label: string; color: string }> = [
  { id: 'rgb', label: 'RGB', color: '#e7e9ee' },
  { id: 'r', label: 'R', color: '#ff5b52' },
  { id: 'g', label: 'G', color: '#34c759' },
  { id: 'b', label: 'B', color: '#4aa8ff' },
]

const SIZE = 255

function toPath(points: CurvePoint[]): string {
  const pts = [...points].sort((a, b) => a.x - b.x)
  return pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${SIZE - p.y}`)
    .join(' ')
}

export function CurvesPanel() {
  const curves = useEditor((s) => s.doc.curves)
  const commit = useEditor((s) => s.commit)
  const beginLive = useEditor((s) => s.beginLive)
  const live = useEditor((s) => s.live)
  const endLive = useEditor((s) => s.endLive)
  const svgRef = useRef<SVGSVGElement>(null)
  const [channel, setChannel] = useState<CurveChannel>('rgb')
  const dragIdx = useRef<number | null>(null)

  const points = curves[channel]
  const ch = CHANNELS.find((c) => c.id === channel)!

  const toCurve = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * SIZE
    const y = SIZE - ((e.clientY - rect.top) / rect.height) * SIZE
    return {
      x: Math.max(0, Math.min(SIZE, x)),
      y: Math.max(0, Math.min(SIZE, y)),
    }
  }

  const nearestIndex = (cx: number, cy: number): number | null => {
    let best = -1
    let bestD = 18 * 18
    points.forEach((p, i) => {
      const d = (p.x - cx) ** 2 + (p.y - cy) ** 2
      if (d < bestD) {
        bestD = d
        best = i
      }
    })
    return best === -1 ? null : best
  }

  const onDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const c = toCurve(e)
    const idx = nearestIndex(c.x, c.y)
    if (idx !== null) {
      dragIdx.current = idx
      beginLive()
    } else {
      // Add a new point and start dragging it.
      commit((d) => {
        d.curves[channel] = [...d.curves[channel], { x: c.x, y: c.y }].sort(
          (a, b) => a.x - b.x,
        )
      })
      const newIdx = useEditor
        .getState()
        .doc.curves[channel].findIndex((p) => p.x === c.x && p.y === c.y)
      dragIdx.current = newIdx
      beginLive()
    }
  }

  const onMove = (e: React.PointerEvent) => {
    if (dragIdx.current === null) return
    const c = toCurve(e)
    const idx = dragIdx.current
    live((d) => {
      const pts = d.curves[channel]
      const isFirst = idx === 0
      const isLast = idx === pts.length - 1
      let x = c.x
      if (isFirst) x = 0
      else if (isLast) x = SIZE
      else
        x = Math.max(
          pts[idx - 1].x + 1,
          Math.min(pts[idx + 1].x - 1, c.x),
        )
      pts[idx] = { x, y: c.y }
    })
  }

  const onUp = () => {
    if (dragIdx.current !== null) {
      dragIdx.current = null
      endLive()
    }
  }

  const removePoint = (i: number) => {
    if (i === 0 || i === points.length - 1) return
    commit((d) => {
      d.curves[channel] = d.curves[channel].filter((_, j) => j !== i)
    })
  }

  return (
    <div className="panel">
      <h3 className="panel-title">Tone Curves</h3>

      <div className="row gap">
        {CHANNELS.map((c) => (
          <button
            key={c.id}
            className={channel === c.id ? 'btn chip active' : 'btn chip'}
            onClick={() => setChannel(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        className="curve-editor"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {/* grid */}
        {[0.25, 0.5, 0.75].map((g) => (
          <g key={g}>
            <line x1={g * SIZE} y1={0} x2={g * SIZE} y2={SIZE} className="curve-grid" />
            <line x1={0} y1={g * SIZE} x2={SIZE} y2={g * SIZE} className="curve-grid" />
          </g>
        ))}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} className="curve-diag" />
        <path d={toPath(points)} fill="none" stroke={ch.color} strokeWidth={2.5} />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={SIZE - p.y}
            r={6}
            className="curve-handle"
            stroke={ch.color}
            onDoubleClick={() => removePoint(i)}
          />
        ))}
      </svg>

      <p className="hint">
        Drag points to bend the curve. Tap empty space to add a point,
        double-tap a point to remove it.
      </p>
      <button
        className="btn ghost full"
        onClick={() =>
          commit((d) => {
            d.curves[channel] = [
              { x: 0, y: 0 },
              { x: 255, y: 255 },
            ]
          })
        }
      >
        Reset {ch.label} curve
      </button>
    </div>
  )
}
