import { create } from 'zustand'
import type { EditorDocument, Layer, ToolId } from '../types'
import { createEmptyDocument } from '../types'
import type { RenderSource } from '../engine/render'

const HISTORY_LIMIT = 60

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

interface EditorState {
  // Source image (may be swapped out, e.g. after AI background removal).
  source: RenderSource | null
  fileName: string
  hasImage: boolean

  doc: EditorDocument
  past: EditorDocument[]
  future: EditorDocument[]
  pending: EditorDocument | null

  activeTool: ToolId
  showOriginal: boolean
  selectedLayerId: string | null

  brush: BrushSettings
  ai: AIState

  // --- lifecycle ---
  loadImage: (source: RenderSource, fileName: string) => void
  replaceSource: (source: RenderSource) => void

  // --- editing ---
  commit: (mutator: (doc: EditorDocument) => void) => void
  beginLive: () => void
  live: (mutator: (doc: EditorDocument) => void) => void
  endLive: () => void

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

  // --- layers ---
  addLayer: (layer: Layer) => void
  updateLayer: (id: string, patch: Partial<Layer>) => void
  removeLayer: (id: string) => void

  // --- ai ---
  setAI: (patch: Partial<AIState>) => void

  // --- brush ---
  setBrush: (patch: Partial<BrushSettings>) => void
}

export const useEditor = create<EditorState>((set, get) => ({
  source: null,
  fileName: '',
  hasImage: false,

  doc: createEmptyDocument(),
  past: [],
  future: [],
  pending: null,

  activeTool: 'adjust',
  showOriginal: false,
  selectedLayerId: null,

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
      selectedLayerId: null,
      showOriginal: false,
      ai: { processing: false, progress: 0, stage: '', error: null },
    }),

  replaceSource: (source) => set({ source }),

  commit: (mutator) =>
    set((s) => {
      const next = clone(s.doc)
      mutator(next)
      const past = [...s.past, s.doc].slice(-HISTORY_LIMIT)
      return { doc: next, past, future: [] }
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
      const changed =
        JSON.stringify(s.pending) !== JSON.stringify(s.doc)
      if (!changed) return { pending: null }
      const past = [...s.past, s.pending].slice(-HISTORY_LIMIT)
      return { past, future: [], pending: null }
    }),

  undo: () =>
    set((s) => {
      if (s.past.length === 0) return {}
      const previous = s.past[s.past.length - 1]
      return {
        doc: previous,
        past: s.past.slice(0, -1),
        future: [s.doc, ...s.future],
      }
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {}
      const next = s.future[0]
      return {
        doc: next,
        past: [...s.past, s.doc],
        future: s.future.slice(1),
      }
    }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  resetEdits: () =>
    set((s) => ({
      doc: createEmptyDocument(),
      past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
      future: [],
      selectedLayerId: null,
    })),

  setActiveTool: (tool) => set({ activeTool: tool }),
  setShowOriginal: (show) => set({ showOriginal: show }),
  selectLayer: (id) => set({ selectedLayerId: id }),

  addLayer: (layer) =>
    set((s) => {
      const next = clone(s.doc)
      next.layers.push(layer)
      return {
        doc: next,
        past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: [],
        selectedLayerId: layer.id,
      }
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
        past: [...s.past, s.doc].slice(-HISTORY_LIMIT),
        future: [],
        selectedLayerId: s.selectedLayerId === id ? null : s.selectedLayerId,
      }
    }),

  setAI: (patch) => set((s) => ({ ai: { ...s.ai, ...patch } })),

  setBrush: (patch) => set((s) => ({ brush: { ...s.brush, ...patch } })),
}))
