import { useRef } from 'react'
import { useEditor } from '../state/editorStore'
import type { ImageLayer } from '../types'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
type Handle = 'nw' | 'ne' | 'sw' | 'se' | 'move' | null

// Drag a crop box over the photo to choose which part shows inside the frame.
export function PhotoFraming({ layer }: { layer: ImageLayer }) {
  const beginLive = useEditor((s) => s.beginLive)
  const live = useEditor((s) => s.live)
  const endLive = useEditor((s) => s.endLive)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ handle: Exclude<Handle, null>; start: { x: number; y: number }; orig: ImageLayer['crop'] } | null>(null)

  const crop = layer.crop ?? { x: 0, y: 0, width: 1, height: 1 }

  const norm = (e: React.PointerEvent) => {
    const r = boxRef.current!.getBoundingClientRect()
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1),
      y: clamp((e.clientY - r.top) / r.height, 0, 1),
    }
  }

  const detect = (nx: number, ny: number): Handle => {
    const t = 0.08
    const near = (a: number, b: number) => Math.abs(a - b) < t
    const onL = near(nx, crop.x)
    const onR = near(nx, crop.x + crop.width)
    const onT = near(ny, crop.y)
    const onB = near(ny, crop.y + crop.height)
    if (onL && onT) return 'nw'
    if (onR && onT) return 'ne'
    if (onL && onB) return 'sw'
    if (onR && onB) return 'se'
    if (nx > crop.x && nx < crop.x + crop.width && ny > crop.y && ny < crop.y + crop.height) return 'move'
    return null
  }

  const setCrop = (next: ImageLayer['crop']) =>
    live((d) => {
      const l = d.layers.find((x) => x.id === layer.id)
      if (l && l.type === 'image') l.crop = next
    })

  const onDown = (e: React.PointerEvent) => {
    const n = norm(e)
    const h = detect(n.x, n.y)
    if (!h) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    beginLive()
    drag.current = { handle: h, start: n, orig: { ...crop } }
  }

  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const n = norm(e)
    const { handle, orig, start } = drag.current
    const dx = n.x - start.x
    const dy = n.y - start.y
    const min = 0.1
    if (handle === 'move') {
      setCrop({
        x: clamp(orig.x + dx, 0, 1 - orig.width),
        y: clamp(orig.y + dy, 0, 1 - orig.height),
        width: orig.width,
        height: orig.height,
      })
      return
    }
    let x1 = orig.x
    let y1 = orig.y
    let x2 = orig.x + orig.width
    let y2 = orig.y + orig.height
    if (handle.includes('w')) x1 = clamp(orig.x + dx, 0, x2 - min)
    if (handle.includes('e')) x2 = clamp(orig.x + orig.width + dx, x1 + min, 1)
    if (handle.includes('n')) y1 = clamp(orig.y + dy, 0, y2 - min)
    if (handle.includes('s')) y2 = clamp(orig.y + orig.height + dy, y1 + min, 1)
    setCrop({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 })
  }

  const onUp = () => {
    if (drag.current) {
      drag.current = null
      endLive()
    }
  }

  const pct = (v: number) => `${v * 100}%`
  const r = layer.naturalRatio || 1
  return (
    <div
      ref={boxRef}
      className="pfe"
      style={{ aspectRatio: String(r), width: `min(100%, ${Math.round(200 * r)}px)` }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <img className="pfe-img" src={layer.src} alt="" draggable={false} />
      <div
        className="pfe-crop"
        style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.width), height: pct(crop.height) }}
      >
        <span className="pfe-h nw" />
        <span className="pfe-h ne" />
        <span className="pfe-h sw" />
        <span className="pfe-h se" />
      </div>
    </div>
  )
}
