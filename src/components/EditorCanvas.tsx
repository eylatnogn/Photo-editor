import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../state/editorStore'
import { renderDocument } from '../engine/render'
import { createEmptyDocument, type DrawLayer } from '../types'
import { uid, clamp } from '../utils'

const PREVIEW_MAX = 1600

type CropHandle =
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move' | null

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const source = useEditor((s) => s.source)
  const doc = useEditor((s) => s.doc)
  const showOriginal = useEditor((s) => s.showOriginal)
  const activeTool = useEditor((s) => s.activeTool)
  const selectedLayerId = useEditor((s) => s.selectedLayerId)

  const live = useEditor((s) => s.live)
  const beginLive = useEditor((s) => s.beginLive)
  const endLive = useEditor((s) => s.endLive)
  const updateLayer = useEditor((s) => s.updateLayer)

  // Downscaled preview source for fast live rendering.
  const [previewSource, setPreviewSource] = useState<HTMLCanvasElement | null>(
    null,
  )

  // Interaction refs (persist across re-renders during a drag).
  const cropDrag = useRef<{
    handle: Exclude<CropHandle, null>
    start: { x: number; y: number }
    orig: typeof doc.transform.crop
  } | null>(null)
  const drawingId = useRef<string | null>(null)
  const textDrag = useRef<{
    id: string
    start: { x: number; y: number }
    orig: { x: number; y: number }
  } | null>(null)

  useEffect(() => {
    if (!source) {
      setPreviewSource(null)
      return
    }
    const sw =
      source instanceof HTMLImageElement ? source.naturalWidth : source.width
    const sh =
      source instanceof HTMLImageElement ? source.naturalHeight : source.height
    const scale = Math.min(1, PREVIEW_MAX / Math.max(sw, sh))
    const pc = document.createElement('canvas')
    pc.width = Math.max(1, Math.round(sw * scale))
    pc.height = Math.max(1, Math.round(sh * scale))
    pc
      .getContext('2d')!
      .drawImage(source as CanvasImageSource, 0, 0, pc.width, pc.height)
    setPreviewSource(pc)
  }, [source])

  // Re-render whenever the document or preview changes.
  useEffect(() => {
    if (!previewSource || !canvasRef.current) return
    const renderDoc =
      activeTool === 'crop'
        ? // Show the full, un-cropped, un-rotated frame while cropping.
          {
            ...doc,
            transform: { ...createEmptyDocument().transform },
            layers: [],
          }
        : showOriginal
        ? createEmptyDocument()
        : doc
    renderDocument(previewSource, renderDoc, canvasRef.current)
  }, [previewSource, doc, showOriginal, activeTool])

  const getNorm = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    }
  }

  const detectHandle = (nx: number, ny: number): CropHandle => {
    const c = doc.transform.crop
    const t = 0.035
    const near = (a: number, b: number) => Math.abs(a - b) < t
    const onL = near(nx, c.x)
    const onR = near(nx, c.x + c.width)
    const onT = near(ny, c.y)
    const onB = near(ny, c.y + c.height)
    const insideX = nx > c.x - t && nx < c.x + c.width + t
    const insideY = ny > c.y - t && ny < c.y + c.height + t
    if (onL && onT) return 'nw'
    if (onR && onT) return 'ne'
    if (onL && onB) return 'sw'
    if (onR && onB) return 'se'
    if (onT && insideX) return 'n'
    if (onB && insideX) return 's'
    if (onL && insideY) return 'w'
    if (onR && insideY) return 'e'
    if (
      nx > c.x &&
      nx < c.x + c.width &&
      ny > c.y &&
      ny < c.y + c.height
    )
      return 'move'
    return null
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!previewSource) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const n = getNorm(e)

    if (activeTool === 'crop') {
      const handle = detectHandle(n.x, n.y)
      if (handle) {
        beginLive()
        cropDrag.current = {
          handle,
          start: n,
          orig: { ...doc.transform.crop },
        }
      }
      return
    }

    if (activeTool === 'draw') {
      const brush = useEditor.getState().brush
      const layer: DrawLayer = {
        id: uid('draw'),
        type: 'draw',
        color: brush.color,
        size: brush.size,
        opacity: brush.opacity,
        points: [n],
      }
      drawingId.current = layer.id
      beginLive()
      live((d) => d.layers.push(layer))
      return
    }

    if (activeTool === 'text' && selectedLayerId) {
      const layer = doc.layers.find((l) => l.id === selectedLayerId)
      if (layer && layer.type === 'text') {
        beginLive()
        textDrag.current = {
          id: layer.id,
          start: n,
          orig: { x: layer.x, y: layer.y },
        }
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!previewSource) return
    const n = getNorm(e)

    if (cropDrag.current) {
      const { handle, orig, start } = cropDrag.current
      const dx = n.x - start.x
      const dy = n.y - start.y
      const minSize = 0.05
      live((d) => {
        if (handle === 'move') {
          d.transform.crop = {
            x: clamp(orig.x + dx, 0, 1 - orig.width),
            y: clamp(orig.y + dy, 0, 1 - orig.height),
            width: orig.width,
            height: orig.height,
          }
          return
        }
        let x1 = orig.x
        let y1 = orig.y
        let x2 = orig.x + orig.width
        let y2 = orig.y + orig.height
        if (handle.includes('w')) x1 = clamp(orig.x + dx, 0, x2 - minSize)
        if (handle.includes('e'))
          x2 = clamp(orig.x + orig.width + dx, x1 + minSize, 1)
        if (handle.includes('n')) y1 = clamp(orig.y + dy, 0, y2 - minSize)
        if (handle.includes('s'))
          y2 = clamp(orig.y + orig.height + dy, y1 + minSize, 1)
        d.transform.crop = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 }
      })
      return
    }

    if (drawingId.current && (e.buttons & 1)) {
      const id = drawingId.current
      live((d) => {
        const layer = d.layers.find((l) => l.id === id)
        if (layer && layer.type === 'draw') layer.points.push(n)
      })
      return
    }

    if (textDrag.current) {
      const { id, orig, start } = textDrag.current
      updateLayer(id, {
        x: clamp(orig.x + (n.x - start.x), 0, 1),
        y: clamp(orig.y + (n.y - start.y), 0, 1),
      })
    }
  }

  const onPointerUp = () => {
    if (cropDrag.current) {
      cropDrag.current = null
      endLive()
    }
    if (drawingId.current) {
      drawingId.current = null
      endLive()
    }
    if (textDrag.current) {
      textDrag.current = null
      endLive()
    }
  }

  const cursor = activeTool === 'draw' || activeTool === 'crop' ? 'crosshair' : 'default'

  return (
    <div className="canvas-stage">
      <div className="canvas-wrap">
        <canvas
          ref={canvasRef}
          className="edit-canvas"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {activeTool === 'crop' && <CropOverlay />}
      </div>
    </div>
  )
}

function CropOverlay() {
  const crop = useEditor((s) => s.doc.transform.crop)
  const pct = (v: number) => `${v * 100}%`
  return (
    <div className="crop-overlay">
      <div
        className="crop-rect"
        style={{
          left: pct(crop.x),
          top: pct(crop.y),
          width: pct(crop.width),
          height: pct(crop.height),
        }}
      >
        <span className="ch nw" />
        <span className="ch ne" />
        <span className="ch sw" />
        <span className="ch se" />
        <span className="grid-v" />
        <span className="grid-v second" />
        <span className="grid-h" />
        <span className="grid-h second" />
      </div>
    </div>
  )
}
