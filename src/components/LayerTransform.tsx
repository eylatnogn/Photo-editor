import { useRef, type RefObject } from 'react'
import { useEditor } from '../state/editorStore'
import { layerBox } from '../engine/layerGeometry'
import { Icon } from './ui/Icon'
import type { Layer, TextLayer, ImageLayer, StickerLayer } from '../types'

type Movable = TextLayer | ImageLayer | StickerLayer

const LAYER_TOOLS = new Set(['text', 'sticker', 'layers'])
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

interface Props {
  canvasRef: RefObject<HTMLCanvasElement>
}

type DragState = {
  mode: 'move' | 'resize' | 'rotate'
  startNx: number
  startNy: number
  startX: number
  startY: number
  startSize: number
  startRot: number
  startDist: number
  startAngle: number
  cx: number
  cy: number
}

export function LayerTransform({ canvasRef }: Props) {
  const activeTool = useEditor((s) => s.activeTool)
  const layers = useEditor((s) => s.doc.layers)
  const selectedId = useEditor((s) => s.selectedLayerId)
  const beginLive = useEditor((s) => s.beginLive)
  const live = useEditor((s) => s.live)
  const endLive = useEditor((s) => s.endLive)
  const removeLayer = useEditor((s) => s.removeLayer)
  const drag = useRef<DragState | null>(null)

  const layer = layers.find((l) => l.id === selectedId)
  const canvas = canvasRef.current
  if (
    !LAYER_TOOLS.has(activeTool) ||
    !layer ||
    layer.hidden ||
    layer.locked ||
    layer.type === 'draw' ||
    !canvas ||
    !canvas.width
  ) {
    return null
  }

  const cw = canvas.width
  const ch = canvas.height
  const box = layerBox(layer, cw, ch)
  if (!box) return null

  const sizeOf = (l: Layer) =>
    l.type === 'text' ? l.fontSize : l.type === 'image' || l.type === 'sticker' ? l.scale : 1

  const canvasPx = (e: React.PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return {
      nx: (e.clientX - r.left) / r.width,
      ny: (e.clientY - r.top) / r.height,
      px: ((e.clientX - r.left) / r.width) * cw,
      py: ((e.clientY - r.top) / r.height) * ch,
    }
  }

  const mutate = (fn: (l: Movable) => void) =>
    live((d) => {
      const l = d.layers.find((x) => x.id === selectedId)
      if (l && !l.locked && l.type !== 'draw') fn(l)
    })

  const start = (mode: DragState['mode']) => (e: React.PointerEvent) => {
    e.stopPropagation()
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const p = canvasPx(e)
    const cx = layer.x * cw
    const cy = layer.y * ch
    beginLive()
    drag.current = {
      mode,
      startNx: p.nx,
      startNy: p.ny,
      startX: layer.x,
      startY: layer.y,
      startSize: sizeOf(layer),
      startRot: layer.rotation,
      startDist: Math.hypot(p.px - cx, p.py - cy) || 1,
      startAngle: Math.atan2(p.py - cy, p.px - cx),
      cx,
      cy,
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const p = canvasPx(e)
    if (d.mode === 'move') {
      mutate((l) => {
        l.x = clamp(d.startX + (p.nx - d.startNx), -0.2, 1.2)
        l.y = clamp(d.startY + (p.ny - d.startNy), -0.2, 1.2)
      })
    } else if (d.mode === 'resize') {
      const factor = Math.hypot(p.px - d.cx, p.py - d.cy) / d.startDist
      mutate((l) => {
        if (l.type === 'text') l.fontSize = clamp(d.startSize * factor, 6, 600)
        else if (l.type === 'image' || l.type === 'sticker')
          l.scale = clamp(d.startSize * factor, 0.02, 3)
      })
    } else {
      const ang = Math.atan2(p.py - d.cy, p.px - d.cx)
      const deg = ((ang - d.startAngle) * 180) / Math.PI
      mutate((l) => {
        l.rotation = Math.round(d.startRot + deg)
      })
    }
  }

  const onUp = (e: React.PointerEvent) => {
    if (!drag.current) return
    e.stopPropagation()
    drag.current = null
    endLive()
  }

  const pct = (v: number) => `${v * 100}%`

  return (
    <div className="layer-transform">
      <div
        className="lt-box"
        style={{
          left: pct(box.cx / cw),
          top: pct(box.cy / ch),
          width: pct(box.w / cw),
          height: pct(box.h / ch),
          transform: `translate(-50%, -50%) rotate(${box.rot}deg)`,
        }}
        onPointerDown={start('move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <span className="lt-edge" />
        <button
          className="lt-handle lt-rotate"
          onPointerDown={start('rotate')}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Rotate"
        >
          <Icon name="rotate" size={13} />
        </button>
        <button
          className="lt-handle lt-resize"
          onPointerDown={start('resize')}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Resize"
        />
        <button
          className="lt-handle lt-delete"
          onPointerDown={(e) => {
            e.stopPropagation()
            removeLayer(layer.id)
          }}
          aria-label="Delete"
        >
          <Icon name="close" size={12} />
        </button>
      </div>
    </div>
  )
}
