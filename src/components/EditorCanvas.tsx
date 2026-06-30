import { useEffect, useRef, useState } from 'react'
import { useEditor } from '../state/editorStore'
import { renderDocument } from '../engine/render'
import {
  brushRepair,
  brushClone,
  brushSmooth,
  brushDodgeBurn,
  brushSharpen,
  magicRemove,
} from '../engine/retouch'
import { hitLayer } from '../engine/layerGeometry'
import { onImageLoad } from '../engine/imageCache'
import { LayerTransform } from './LayerTransform'
import { Icon } from './ui/Icon'

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
  const setRetouchTool = useEditor((s) => s.setRetouchTool)
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
  const cloneStart = useRef<{ x: number; y: number } | null>(null)

  // Interaction refs (persist across re-renders during a drag).
  const cropDrag = useRef<{
    handle: Exclude<CropHandle, null>
    start: { x: number; y: number }
    orig: typeof doc.transform.crop
  } | null>(null)
  const drawingId = useRef<string | null>(null)
  const layerMove = useRef<{
    id: string
    start: { x: number; y: number }
    orig: { x: number; y: number }
  } | null>(null)

  // View transform for inspecting the preview (does NOT alter the image).
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number; cx: number; cy: number } | null>(null)

  // Keep the panned image from drifting entirely out of the stage.
  const clampView = (v: { zoom: number; x: number; y: number }) => {
    const canvas = canvasRef.current
    const stage = stageRef.current
    if (!canvas || !stage || v.zoom <= 1) return { zoom: v.zoom, x: 0, y: 0 }
    const maxX = Math.max(0, (canvas.clientWidth * v.zoom - stage.clientWidth) / 2)
    const maxY = Math.max(0, (canvas.clientHeight * v.zoom - stage.clientHeight) / 2)
    return { zoom: v.zoom, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) }
  }

  // Zoom toward a screen point (keeps the pixel under the cursor in place).
  const zoomAt = (clientX: number, clientY: number, nextZoom: number) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const cxr = clientX - (rect.left + rect.width / 2)
    const cyr = clientY - (rect.top + rect.height / 2)
    setView((v) => {
      const z = clamp(nextZoom, 1, 8)
      const k = z / v.zoom
      return clampView({ zoom: z, x: cxr - (cxr - v.x) * k, y: cyr - (cyr - v.y) * k })
    })
  }

  const zoomByButton = (factor: number) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.zoom * factor)
  }
  const resetView = () => setView({ zoom: 1, x: 0, y: 0 })

  // Reset the view whenever a different photo is loaded.
  useEffect(() => {
    resetView()
  }, [source])

  // ctrl/⌘ + wheel zooms toward the cursor; plain wheel / trackpad pans.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoomAt(e.clientX, e.clientY, view.zoom * Math.exp(-e.deltaY * 0.0015))
      } else if (view.zoom > 1) {
        e.preventDefault()
        setView((v) => clampView({ zoom: v.zoom, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.zoom])

  // Re-render when a layer image finishes decoding.
  const [imgTick, setImgTick] = useState(0)
  useEffect(() => onImageLoad(() => setImgTick((t) => t + 1)), [])

  // Re-render once web fonts (scrapbook scripts etc.) finish loading so text
  // layers aren't left rendered in a fallback face.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
    if (!fonts) return
    const bump = () => setImgTick((t) => t + 1)
    fonts.ready.then(bump)
    fonts.addEventListener?.('loadingdone', bump)
    return () => fonts.removeEventListener?.('loadingdone', bump)
  }, [])

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
    const base = sampleRef.current
    if (!heal || !base) return
    const w = heal.width
    const h = heal.height
    const radius = Math.max(3, (retouchTool.size / 1000) * Math.max(w, h))
    const { mode, strength, cloneSource } = retouchTool
    const x = n.x * w
    const y = n.y * h
    const from = lastPt.current ?? { x, y }
    // Clone keeps a fixed source→paint offset locked at the stroke's start.
    const cloneOff = cloneSource && cloneStart.current
      ? { dx: cloneStart.current.x - cloneSource.x * w, dy: cloneStart.current.y - cloneSource.y * h }
      : null
    const dist = Math.hypot(x - from.x, y - from.y)
    const steps = Math.max(1, Math.floor(dist / (radius * 0.35)))
    for (let i = 1; i <= steps; i++) {
      const px = from.x + (x - from.x) * (i / steps)
      const py = from.y + (y - from.y) * (i / steps)
      switch (mode) {
        case 'repair':
          brushRepair(base, heal, px, py, radius, strength)
          break
        case 'smooth':
          brushSmooth(base, heal, px, py, radius, strength)
          break
        case 'dodge':
          brushDodgeBurn(base, heal, px, py, radius, strength, 1)
          break
        case 'burn':
          brushDodgeBurn(base, heal, px, py, radius, strength, -1)
          break
        case 'sharpen':
          brushSharpen(base, heal, px, py, radius, strength)
          break
        case 'clone':
          if (cloneOff) brushClone(base, heal, px, py, radius, strength, px - cloneOff.dx, py - cloneOff.dy)
          break
      }
    }
    lastPt.current = { x, y }
    bumpRetouch()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!previewSource) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    // Second finger down → start a pinch-zoom and finalize any single stroke.
    if (pointers.current.size === 2) {
      onPointerUp()
      const [a, b] = [...pointers.current.values()]
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: view.zoom,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      }
      return
    }
    if (pointers.current.size > 2) return
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const n = getNorm(e)

    if (activeTool === 'retouch') {
      const heal = retouch.heal
      if (!heal) return
      // Clone tool: the first tap (no source yet) just sets the source point.
      if (retouchTool.mode === 'clone' && !retouchTool.cloneSource) {
        setRetouchTool({ cloneSource: { x: n.x, y: n.y } })
        return
      }
      beginRetouch()
      if (retouchTool.mode === 'remove') {
        const sample = sampleRef.current
        if (sample) {
          magicRemove(
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
        cloneStart.current = { x: n.x * heal.width, y: n.y * heal.height }
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

    // Layer tools: tap the topmost layer under the pointer to select it AND
    // start moving it in the same gesture (resize/rotate use the box handles).
    if (LAYER_TOOLS.has(activeTool) && canvasRef.current) {
      const cw = canvasRef.current.width
      const ch = canvasRef.current.height
      let hit: typeof doc.layers[number] | null = null
      for (let i = doc.layers.length - 1; i >= 0; i--) {
        const l = doc.layers[i]
        if (l.hidden || l.locked) continue
        if (hitLayer(l, n.x * cw, n.y * ch, cw, ch)) {
          hit = l
          break
        }
      }
      selectLayer(hit?.id ?? null)
      if (hit && hit.type !== 'draw') {
        beginLive()
        layerMove.current = { id: hit.id, start: n, orig: { x: hit.x, y: hit.y } }
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!previewSource) return
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    // Pinch-zoom + two-finger pan.
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const p = pinch.current
      zoomAt(cx, cy, p.zoom * (dist / p.dist))
      const dx = cx - p.cx
      const dy = cy - p.cy
      if (dx || dy) setView((v) => clampView({ zoom: v.zoom, x: v.x + dx, y: v.y + dy }))
      pinch.current = { ...p, cx, cy }
      return
    }

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

    if (layerMove.current) {
      const { id, start, orig } = layerMove.current
      const dx = n.x - start.x
      const dy = n.y - start.y
      live((d) => {
        const l = d.layers.find((x) => x.id === id)
        if (l && l.type !== 'draw') {
          l.x = clamp(orig.x + dx, -0.2, 1.2)
          l.y = clamp(orig.y + dy, -0.2, 1.2)
        }
      })
    }
  }

  const onPointerUp = (e?: React.PointerEvent) => {
    if (e) pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
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
    if (layerMove.current) {
      layerMove.current = null
      endLive()
    }
  }

  const cursor =
    activeTool === 'draw' || activeTool === 'crop' || activeTool === 'retouch'
      ? 'crosshair'
      : 'default'

  return (
    <div className="canvas-stage" ref={stageRef}>
      <div
        className="canvas-wrap"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
        }}
      >
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
        <CarouselGuide canvasRef={canvasRef} />
      </div>

      <div className="zoom-ctrl" role="group" aria-label="Preview zoom">
        <button
          className="zoom-btn"
          onClick={() => zoomByButton(1 / 1.4)}
          disabled={view.zoom <= 1.001}
          title="Zoom out"
        >
          <Icon name="zoomOut" size={17} />
        </button>
        <button
          className="zoom-pct"
          onClick={resetView}
          title="Reset zoom (fit)"
        >
          {Math.round(view.zoom * 100)}%
        </button>
        <button
          className="zoom-btn"
          onClick={() => zoomByButton(1.4)}
          disabled={view.zoom >= 7.99}
          title="Zoom in"
        >
          <Icon name="zoomIn" size={17} />
        </button>
      </div>
    </div>
  )
}

// Dashed outline + slide dividers showing exactly what a carousel will keep.
function CarouselGuide({
  canvasRef,
}: {
  canvasRef: React.RefObject<HTMLCanvasElement>
}) {
  const exportMode = useEditor((s) => s.exportMode)
  const { slides, aspect, offset } = useEditor((s) => s.carousel)
  useEditor((s) => s.doc) // re-render when the canvas re-renders

  const canvas = canvasRef.current
  if (exportMode !== 'carousel' || !canvas || !canvas.width) return null
  const cAspect = canvas.width / canvas.height
  const panoAspect = slides * aspect
  let cw = 1
  let ch = 1
  let left = 0
  let top = 0
  if (cAspect > panoAspect) {
    cw = panoAspect / cAspect
    left = (1 - cw) * offset
  } else {
    ch = cAspect / panoAspect
    top = (1 - ch) * offset
  }
  const pct = (v: number) => `${v * 100}%`

  return (
    <div className="carousel-guide">
      <div
        className="cg-rect"
        style={{ left: pct(left), top: pct(top), width: pct(cw), height: pct(ch) }}
      >
        {Array.from({ length: slides - 1 }).map((_, i) => (
          <span key={i} className="cg-divider" style={{ left: pct((i + 1) / slides) }} />
        ))}
        {Array.from({ length: slides }).map((_, i) => (
          <span key={i} className="cg-num" style={{ left: pct((i + 0.5) / slides) }}>
            {i + 1}
          </span>
        ))}
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
