import { useRef, useState, type ReactNode } from 'react'
import { useEditor } from '../state/editorStore'

interface SheetProps {
  title: string
  children: ReactNode
}

/**
 * The mobile bottom sheet. Drag the grip to resize the panel (which grows or
 * shrinks the preview above it); the chosen height is kept while the body
 * scrolls independently. A tap on the grip collapses / expands it.
 */
export function Sheet({ title, children }: SheetProps) {
  const panelOpen = useEditor((s) => s.panelOpen)
  const setPanelOpen = useEditor((s) => s.setPanelOpen)
  const asideRef = useRef<HTMLDivElement>(null)
  const [heightPx, setHeightPx] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const drag = useRef<{ startY: number; startH: number; moved: boolean } | null>(
    null,
  )

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    const h = asideRef.current?.getBoundingClientRect().height ?? 0
    drag.current = { startY: e.clientY, startH: h, moved: false }
    setResizing(true)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dy = drag.current.startY - e.clientY
    if (Math.abs(dy) > 5) drag.current.moved = true
    const max = window.innerHeight * 0.85
    const next = Math.max(96, Math.min(max, drag.current.startH + dy))
    setHeightPx(next)
    if (!panelOpen) setPanelOpen(true)
  }

  const onPointerUp = () => {
    setResizing(false)
    if (drag.current && !drag.current.moved) {
      // Treat a tap (no drag) as collapse / expand.
      setPanelOpen(!panelOpen)
    }
    drag.current = null
  }

  const style =
    heightPx != null
      ? ({ ['--sheet-h']: `${heightPx}px` } as React.CSSProperties)
      : undefined

  return (
    <aside
      ref={asideRef}
      className={
        resizing
          ? 'sidebar resizing'
          : panelOpen
          ? 'sidebar'
          : 'sidebar collapsed'
      }
      style={style}
    >
      <div
        className="sheet-header"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="sheet-grip" />
        <span className="sheet-title">{title}</span>
        <span className="sheet-chevron">{panelOpen ? '▾' : '▴'}</span>
      </div>
      <div className="sheet-body">{children}</div>
    </aside>
  )
}
