import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../state/editorStore'
import { renderDocument } from '../engine/render'
import { magicHeal, stampHeal, stampSmooth } from '../engine/retouch'
import { hitLayer } from '../engine/layerGeometry'
import { onImageLoad } from '../engine/imageCache'
import { LayerTransform } from './LayerTransform'

const LAYER_TOOLS = new Set(['text', 'sticker', 'layers'])
import {
  createEmptyDocument,
  createFrame,
  DEFAULT_TRANSFORM,
  type DrawLayer,
  type EditorDocument,
} from '../types'
import { uid, clamp } from '../utils'

const PREVIEW_MAX = 1600

// Strip geometry (transform/frame/layers) so normalized pointer coordinates
// map directly onto the source pixels — used by crop and retouch tools.
function flattenDoc(doc: EditorDocument): EditorDocument {
  return {
    ...doc,
    transform: { ...DEFAULT_TRANSFORM, crop: { ...DEFAULT_TRANSFORM.crop } },
    frame: createFrame(),
    layers: [],
  }
}

type CropHandle =
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move' | null

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const source = useEditor((s) => s.source)
  const doc = useEditor((s) => s.doc)
  const showOriginal = useEditor((s) => s.showOriginal)
  const activeTool = useEditor((s) => s.activeTool)

  const live = useEditor((s) => s.live)
  const beginLive = useEditor((s) => s.beginLive)
  const endLive = useEditor((s) => s.endLive)
  const selectLayer = useEditor((s) => s.selectLayer)

  const retouch = useEditor((s) => s.retouch)
  const retouchVersion = useEditor((s) => s.retouchVersion)
  const retouchTool = useEditor((s) => s.retouchTool)
  const beginRetouch = useEditor((s) => s.beginRetouch)
  const bumpRetouch = useEditor((s) => s.bumpRetouch)
  const commitRetouch = useEditor((s) => s.commitRetouch)

  // Downscaled preview source for fast live rendering.
  const [previewSource, setPreviewSource] = useState<HTMLCanvasElement | null>(
    null,
  )
  // Source sampled at retouch-layer resolution (for heal sampling / erase).
  const sampleRef = useRef<HTMLCanvasElement | null>(null)
  const retouching = useRef(false)
  const lastPt = useRef<{ x: number; y: number } | null>(null)

  // Interaction refs (persist across re-renders during a drag).
  const cropDrag = useRef<{
    handle: Exclude<CropHandle, null>
    start: { x: number; y: number }
    orig: typeof doc.transform.crop
  } | null>(null)
  const drawingId = useRef<string | null>(null)

  // Re-render when a layer image finishes decoding.
  const [imgTick, setImgTick] = useState(0)
  useEffect(() => onImageLoad(() => setImgTick((t) => t + 1)), [])

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

    // Build a sample canvas matching the retouch-layer resolution.
    const heal = useEditor.getState().retouch.heal
    if (heal) {
      const sc = document.createElement('canvas')
      sc.width = heal.width
      sc.height = heal.height
      sc.getContext('2d')!.drawImage(source as CanvasImageSource, 0, 0, sc.width, sc.height)
      sampleRef.current = sc
    }
  }, [source])

  // Re-render whenever the document, preview, or retouch layers change.
  useEffect(() => {
    if (!previewSource || !canvasRef.current) return
    const flatten = activeTool === 'crop' || activeTool === 'retouch'
    const renderDoc = flatten
      ? flattenDoc(doc)
      : showOriginal
      ? createEmptyDocument()
      : doc
    renderDocument(previewSource, renderDoc, canvasRef.current, {
      heal: retouch.heal,
      erase: retouch.erase,
    })
    fitCanvas()
  }, [previewSource, doc, showOriginal, activeTool, retouch, retouchVersion, imgTick])

  // Size the canvas element (in CSS px) to fit the available stage while
  // preserving the image's aspect ratio. Done in JS because percentage-based
  // fitting of a <canvas> inside flexbox is unreliable across browsers.
  function fitCanvas() {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage || !canvas.width || !canvas.height) return
    const cs = getComputedStyle(stage)
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const availW = stage.clientWidth - padX
    const availH = stage.clientHeight - padY
    if (availW <= 0 || availH <= 0) return
    const ratio = canvas.width / canvas.height
    let w = availW
    let h = w / ratio
    if (h > availH) {
      h = availH
      w = h * ratio
    }
    canvas.style.width = `${Math.round(w)}px`
    canvas.style.height = `${Math.round(h)}px`
  }

  // Refit when the stage resizes (e.g. dragging the mobile sheet, rotating).
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => fitCanvas())
    ro.observe(stage)
    return () => ro.disconnect()
  }, [])

  // Switching tools can change the rendered dimensions (e.g. crop shows the
  // full frame) and the panel layout. Refit once more after layout settles so
  // the preview can never be left at a stale size.
  useEffect(() => {
    const id = requestAnimationFrame(() => fitCanvas())
    return () => cancelAnimationFrame(id)
  }, [activeTool])

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

  // Paint a cleanup/airbrush stroke onto the heal layer, interpolating
  // between the previous and current point for smooth coverage.
  const strokeRetouch = (n: { x: number; y: number }) => {
    const heal = retouch.heal
    const sample = sampleRef.current
    if (!heal || !sample) return
    const ctx = heal.getContext('2d')!
    const w = heal.width
    const h = heal.height
    const radius = Math.max(3, (retouchTool.size / 1000) * Math.max(w, h))
    const x = n.x * w
    const y = n.y * h
    const from = lastPt.current ?? { x, y }
    const dist = Math.hypot(x - from.x, y - from.y)
    const steps = Math.max(1, Math.floor(dist / (radius * 0.4)))
    for (let i = 1; i <= steps; i++) {
      const px = from.x + (x - from.x) * (i / steps)
      const py = from.y + (y - from.y) * (i / steps)
      if (retouchTool.mode === 'cleanup') {
        stampHeal(ctx, sample, px, py, radius)
      } else {
        stampSmooth(ctx, sample, px, py, radius, retouchTool.hardness)
      }
    }
    lastPt.current = { x, y }
    bumpRetouch()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!previewSource) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const n = getNorm(e)

    if (activeTool === 'retouch') {
      const heal = retouch.heal
      if (!heal) return
      beginRetouch()
      if (retouchTool.mode === 'erase') {
        const sample = sampleRef.current
        if (sample) {
          magicHeal(
            heal.getContext('2d')!,
            sample,
            n.x * heal.width,
            n.y * heal.height,
            retouchTool.tolerance,
          )
          bumpRetouch()
        }
        commitRetouch()
      } else {
        retouching.current = true
        lastPt.current = null
        strokeRetouch(n)
      }
      return
    }

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

    // Layer tools: tap to select the topmost layer under the pointer (moving
    // and transforming is handled by the on-canvas transform box).
    if (LAYER_TOOLS.has(activeTool) && canvasRef.current) {
      const cw = canvasRef.current.width
      const ch = canvasRef.current.height
      let hit: string | null = null
      for (let i = doc.layers.length - 1; i >= 0; i--) {
        const l = doc.layers[i]
        if (l.hidden || l.locked) continue
        if (hitLayer(l, n.x * cw, n.y * ch, cw, ch)) {
          hit = l.id
          break
        }
      }
      selectLayer(hit)
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!previewSource) return
    const n = getNorm(e)

    // Note: don't gate on e.buttons — touch pointer moves often report
    // buttons === 0, which would break brush strokes on mobile. The
    // retouching/drawing refs (set on pointerdown, cleared on up) track press.
    if (retouching.current) {
      strokeRetouch(n)
      return
    }

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

    if (drawingId.current) {
      const id = drawingId.current
      live((d) => {
        const layer = d.layers.find((l) => l.id === id)
        if (layer && layer.type === 'draw') layer.points.push(n)
      })
      return
    }
  }

  const onPointerUp = () => {
    if (retouching.current) {
      retouching.current = false
      lastPt.current = null
      commitRetouch()
    }
    if (cropDrag.current) {
      cropDrag.current = null
      endLive()
    }
    if (drawingId.current) {
      drawingId.current = null
      endLive()
    }
  }

  const cursor =
    activeTool === 'draw' || activeTool === 'crop' || activeTool === 'retouch'
      ? 'crosshair'
      : 'default'

  return (
    <div className="canvas-stage" ref={stageRef}>
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
        <LayerTransform canvasRef={canvasRef} />
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
