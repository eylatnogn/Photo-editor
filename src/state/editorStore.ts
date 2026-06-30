import { create } from 'zustand'
import type { EditorDocument, Layer, ToolId } from '../types'
import { createEmptyDocument } from '../types'
import type { RenderSource } from '../engine/render'

const HISTORY_LIMIT = 60
const RETOUCH_HISTORY_LIMIT = 30

function clone(doc: EditorDocument): EditorDocument {
  return structuredClone(doc)
}

export interface AIState {
  processing: boolean
  progress: number
  stage: string
  error: string | null
}

export interface BrushSettings {
  color: string
  size: number
  opacity: number
}

export type RetouchMode =
  | 'repair'
  | 'clone'
  | 'smooth'
  | 'dodge'
  | 'burn'
  | 'sharpen'
  | 'remove'
export interface RetouchSettings {
  mode: RetouchMode
  size: number // brush diameter control (4..120)
  strength: number // 0..1 effect intensity
  tolerance: number // 0..255 colour spread for the remove tool
  cloneSource: { x: number; y: number } | null // normalized clone anchor
}

// Destructive pixel layers composited into the source at render time.
export interface RetouchLayers {
  heal: HTMLCanvasElement | null
  erase: HTMLCanvasElement | null
}
interface RetouchSnap {
  heal: ImageData | null
  erase: ImageData | null
}
type HistKind = 'doc' | 'retouch'

function sourceDims(src: RenderSource): { w: number; h: number } {
  return src instanceof HTMLImageElement
    ? { w: src.naturalWidth, h: src.naturalHeight }
    : { w: src.width, h: src.height }
}

// Cap retouch layers so flood-fill / snapshots stay memory-bounded; the
// render pipeline scales them back to full source resolution on export.
const RETOUCH_MAX = 2048

function makeRetouch(src: RenderSource): RetouchLayers {
  const { w, h } = sourceDims(src)
  const scale = Math.min(1, RETOUCH_MAX / Math.max(w, h))
  const rw = Math.max(1, Math.round(w * scale))
  const rh = Math.max(1, Math.round(h * scale))
  const heal = document.createElement('canvas')
  heal.width = rw
  heal.height = rh
  const erase = document.createElement('canvas')
  erase.width = rw
  erase.height = rh
  return { heal, erase }
}

function snapRetouch(r: RetouchLayers): RetouchSnap {
  const grab = (c: HTMLCanvasElement | null) =>
    c ? c.getContext('2d')!.getImageData(0, 0, c.width, c.height) : null
  return { heal: grab(r.heal), erase: grab(r.erase) }
}

function restoreRetouch(r: RetouchLayers, snap: RetouchSnap) {
  const put = (c: HTMLCanvasElement | null, data: ImageData | null) => {
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    if (data) ctx.putImageData(data, 0, 0)
  }
  put(r.heal, snap.heal)
  put(r.erase, snap.erase)
}

interface EditorState {
  source: RenderSource | null
  fileName: string
  hasImage: boolean

  doc: EditorDocument
  past: EditorDocument[]
  future: EditorDocument[]
  pending: EditorDocument | null

  // Retouch (destructive) layers + their own history.
  retouch: RetouchLayers
  retouchVersion: number
  retouchPast: RetouchSnap[]
  retouchFuture: RetouchSnap[]
  retouchPending: RetouchSnap | null
  retouchTool: RetouchSettings

  // Unified action ordering across doc + retouch edits.
  actionLog: HistKind[]
  actionRedo: HistKind[]

  activeTool: ToolId
  showOriginal: boolean
  selectedLayerId: string | null
  panelOpen: boolean
  exportMode: 'single' | 'carousel'
  carousel: { slides: number; aspect: number; offset: number }

  // Saved-draft tracking + the drafts gallery overlay.
  currentProjectId: string | null
  draftsOpen: boolean

  brush: BrushSettings
  ai: AIState

  // --- lifecycle ---
  loadImage: (source: RenderSource, fileName: string) => void
  replaceSource: (source: RenderSource) => void
  loadProject: (p: {
    source: RenderSource
    fileName: string
    doc: EditorDocument
    retouch: RetouchLayers
    projectId: string
  }) => void
  setCurrentProjectId: (id: string | null) => void
  setDraftsOpen: (open: boolean) => void

  // --- editing ---
  commit: (mutator: (doc: EditorDocument) => void) => void
  beginLive: () => void
  live: (mutator: (doc: EditorDocument) => void) => void
  endLive: () => void

  // --- retouch ---
  beginRetouch: () => void
  bumpRetouch: () => void
  commitRetouch: () => void
  clearRetouch: () => void
  setRetouchTool: (patch: Partial<RetouchSettings>) => void

  // --- history ---
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  resetEdits: () => void

  // --- ui ---
  setActiveTool: (tool: ToolId) => void
  setShowOriginal: (show: boolean) => void
  selectLayer: (id: string | null) => void
  setPanelOpen: (open: boolean) => void
  setExportMode: (mode: 'single' | 'carousel') => void
  setCarousel: (patch: Partial<{ slides: number; aspect: number; offset: number }>) => void

  // --- layers ---
  addLayer: (layer: Layer) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  removeLayer: (id: string) => void
  moveLayer: (id: string, dir: 'up' | 'down') => void
  duplicateLayer: (id: string) => void

  // --- ai ---
  setAI: (patch: Partial<AIState>) => void

  // --- brush ---
  setBrush: (patch: Partial<BrushSettings>) => void
}

// Helper to append a doc-history snapshot and record the action.
function pushDoc(s: EditorState, prev: EditorDocument) {
  return {
    past: [...s.past, prev].slice(-HISTORY_LIMIT),
    future: [] as EditorDocument[],
    actionLog: [...s.actionLog, 'doc' as HistKind].slice(-HISTORY_LIMIT),
    actionRedo: [] as HistKind[],
  }
}

export const useEditor = create<EditorState>((set, get) => ({
  source: null,
  fileName: '',
  hasImage: false,

  doc: createEmptyDocument(),
  past: [],
  future: [],
  pending: null,

  retouch: { heal: null, erase: null },
  retouchVersion: 0,
  retouchPast: [],
  retouchFuture: [],
  retouchPending: null,
  retouchTool: {
    mode: 'repair',
    size: 40,
    strength: 0.7,
    tolerance: 36,
    cloneSource: null,
  },

  actionLog: [],
  actionRedo: [],

  activeTool: 'adjust',
  showOriginal: false,
  selectedLayerId: null,
  panelOpen: true,
  exportMode: 'single',
  carousel: { slides: 3, aspect: 4 / 5, offset: 0.5 },

  currentProjectId: null,
  draftsOpen: false,

  brush: { color: '#ff3b30', size: 8, opacity: 1 },
  ai: { processing: false, progress: 0, stage: '', error: null },

  loadImage: (source, fileName) =>
    set({
      source,
      fileName,
      hasImage: true,
      doc: createEmptyDocument(),
      past: [],
      future: [],
      pending: null,
      retouch: makeRetouch(source),
      retouchVersion: 0,
      retouchPast: [],
      retouchFuture: [],
      retouchPending: null,
      actionLog: [],
      actionRedo: [],
      selectedLayerId: null,
      showOriginal: false,
      currentProjectId: null,
      ai: { processing: false, progress: 0, stage: '', error: null },
    }),

  loadProject: ({ source, fileName, doc, retouch, projectId }) => {
    // Guarantee blank retouch canvases exist even if the draft never used them.
    const base = makeRetouch(source)
    const layers: RetouchLayers = {
      heal: retouch.heal ?? base.heal,
      erase: retouch.erase ?? base.erase,
    }
    set({
      source,
      fileName,
      hasImage: true,
      doc,
      past: [],
      future: [],
      pending: null,
      retouch: layers,
      retouchVersion: get().retouchVersion + 1,
      retouchPast: [],
      retouchFuture: [],
      retouchPending: null,
      actionLog: [],
      actionRedo: [],
      selectedLayerId: null,
      showOriginal: false,
      activeTool: 'adjust',
      currentProjectId: projectId,
      draftsOpen: false,
      ai: { processing: false, progress: 0, stage: '', error: null },
    })
  },

  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  setDraftsOpen: (open) => set({ draftsOpen: open }),

  replaceSource: (source) =>
    set({
      source,
      // The new source may differ in size; reset retouch layers + history.
      retouch: makeRetouch(source),
      retouchVersion: get().retouchVersion + 1,
      retouchPast: [],
      retouchFuture: [],
      retouchPending: null,
    }),

  commit: (mutator) =>
    set((s) => {
      const next = clone(s.doc)
      mutator(next)
      return { doc: next, ...pushDoc(s, s.doc) }
    }),

  beginLive: () => set((s) => ({ pending: clone(s.doc) })),

  live: (mutator) =>
    set((s) => {
      const next = clone(s.doc)
      mutator(next)
      return { doc: next }
    }),

  endLive: () =>
    set((s) => {
      if (!s.pending) return {}
      const changed = JSON.stringify(s.pending) !== JSON.stringify(s.doc)
      if (!changed) return { pending: null }
      return { pending: null, ...pushDoc(s, s.pending) }
    }),

  // --- retouch ---
  beginRetouch: () => set((s) => ({ retouchPending: snapRetouch(s.retouch) })),

  bumpRetouch: () => set((s) => ({ retouchVersion: s.retouchVersion + 1 })),

  commitRetouch: () =>
    set((s) => {
      if (!s.retouchPending) return {}
      return {
        retouchPast: [...s.retouchPast, s.retouchPending].slice(
          -RETOUCH_HISTORY_LIMIT,
        ),
        retouchFuture: [],
        retouchPending: null,
        actionLog: [...s.actionLog, 'retouch' as HistKind].slice(-HISTORY_LIMIT),
        actionRedo: [],
        retouchVersion: s.retouchVersion + 1,
      }
    }),

  clearRetouch: () =>
    set((s) => {
      const before = snapRetouch(s.retouch)
      restoreRetouch(s.retouch, { heal: null, erase: null })
      return {
        retouchPast: [...s.retouchPast, before].slice(-RETOUCH_HISTORY_LIMIT),
        retouchFuture: [],
        actionLog: [...s.actionLog, 'retouch' as HistKind].slice(-HISTORY_LIMIT),
        actionRedo: [],
        retouchVersion: s.retouchVersion + 1,
      }
    }),

  setRetouchTool: (patch) =>
    set((s) => ({ retouchTool: { ...s.retouchTool, ...patch } })),

  // --- unified history ---
  undo: () =>
    set((s) => {
      if (s.actionLog.length === 0) return {}
      const kind = s.actionLog[s.actionLog.length - 1]
      const actionLog = s.actionLog.slice(0, -1)
      const actionRedo = [...s.actionRedo, kind]
      if (kind === 'doc') {
        if (s.past.length === 0) return { actionLog, actionRedo }
        return {
          doc: s.past[s.past.length - 1],
          past: s.past.slice(0, -1),
          future: [s.doc, ...s.future],
          actionLog,
          actionRedo,
        }
      }
      if (s.retouchPast.length === 0) return { actionLog, actionRedo }
      const current = snapRetouch(s.retouch)
      const prev = s.retouchPast[s.retouchPast.length - 1]
      restoreRetouch(s.retouch, prev)
      return {
        retouchPast: s.retouchPast.slice(0, -1),
        retouchFuture: [current, ...s.retouchFuture],
        retouchVersion: s.retouchVersion + 1,
        actionLog,
        actionRedo,
      }
    }),

  redo: () =>
    set((s) => {
      if (s.actionRedo.length === 0) return {}
      const kind = s.actionRedo[s.actionRedo.length - 1]
      const actionRedo = s.actionRedo.slice(0, -1)
      const actionLog = [...s.actionLog, kind]
      if (kind === 'doc') {
        if (s.future.length === 0) return { actionLog, actionRedo }
        return {
          doc: s.future[0],
          past: [...s.past, s.doc],
          future: s.future.slice(1),
          actionLog,
          actionRedo,
        }
      }
      if (s.retouchFuture.length === 0) return { actionLog, actionRedo }
      const current = snapRetouch(s.retouch)
      const next = s.retouchFuture[0]
      restoreRetouch(s.retouch, next)
      return {
        retouchPast: [...s.retouchPast, current],
        retouchFuture: s.retouchFuture.slice(1),
        retouchVersion: s.retouchVersion + 1,
        actionLog,
        actionRedo,
      }
    }),

  canUndo: () => get().actionLog.length > 0,
  canRedo: () => get().actionRedo.length > 0,

  resetEdits: () =>
    set((s) => ({
      doc: createEmptyDocument(),
      ...pushDoc(s, s.doc),
      selectedLayerId: null,
    })),

  setActiveTool: (tool) => set({ activeTool: tool, panelOpen: true }),
  setShowOriginal: (show) => set({ showOriginal: show }),
  selectLayer: (id) => set({ selectedLayerId: id }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  setExportMode: (mode) => set({ exportMode: mode }),
  setCarousel: (patch) => set((s) => ({ carousel: { ...s.carousel, ...patch } })),

  addLayer: (layer) =>
    set((s) => {
      const next = clone(s.doc)
      next.layers.push(layer)
      return { doc: next, ...pushDoc(s, s.doc), selectedLayerId: layer.id }
    }),

  updateLayer: (id, patch) =>
    set((s) => {
      const next = clone(s.doc)
      const idx = next.layers.findIndex((l) => l.id === id)
      if (idx === -1) return {}
      next.layers[idx] = { ...next.layers[idx], ...patch } as Layer
      return { doc: next }
    }),

  removeLayer: (id) =>
    set((s) => {
      const next = clone(s.doc)
      next.layers = next.layers.filter((l) => l.id !== id)
      return {
        doc: next,
        ...pushDoc(s, s.doc),
        selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
      }
    }),

  // Array order = z-order (later draws on top). 'up' = bring forward.
  moveLayer: (id, dir) =>
    set((s) => {
      const next = clone(s.doc)
      const i = next.layers.findIndex((l) => l.id === id)
      if (i === -1) return {}
      const j = dir === 'up' ? i + 1 : i - 1
      if (j < 0 || j >= next.layers.length) return {}
      ;[next.layers[i], next.layers[j]] = [next.layers[j], next.layers[i]]
      return { doc: next, ...pushDoc(s, s.doc) }
    }),

  duplicateLayer: (id) =>
    set((s) => {
      const next = clone(s.doc)
      const src = next.layers.find((l) => l.id === id)
      if (!src) return {}
      const copy = structuredClone(src)
      copy.id = `${src.type}_${Date.now().toString(36)}_${next.layers.length}`
      if (copy.type !== 'draw') {
        copy.x = Math.min(0.95, copy.x + 0.04)
        copy.y = Math.min(0.95, copy.y + 0.04)
      }
      next.layers.push(copy)
      return {
        doc: next,
        ...pushDoc(s, s.doc),
        selectedLayerId: copy.id,
      }
    }),

  setAI: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),

  setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
}))
