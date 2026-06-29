// Save/restore full editing sessions ("drafts") to IndexedDB so users can come
// back to them later. The base photo, every layer image and the destructive
// retouch layers are stored as blobs; the editable document is stored as JSON.

import type { EditorDocument } from '../types'
import { renderDocument, type RenderSource } from './render'
import { primeImage } from './imageCache'
import { useEditor } from '../state/editorStore'
import type { RetouchLayers } from '../state/editorStore'
import { uid } from '../utils'

export interface ProjectMeta {
  id: string
  name: string
  fileName: string
  createdAt: number
  updatedAt: number
  thumbnail: string // small data URL for the gallery
}

interface ProjectData {
  id: string
  source: Blob
  doc: EditorDocument
  heal: Blob | null
  erase: Blob | null
}

const DB_NAME = 'aperture'
const DB_VERSION = 1
const META = 'meta'
const DATA = 'data'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(DATA)) db.createObjectStore(DATA, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
        t.oncomplete = () => db.close()
      }),
  )
}

// --- helpers ---------------------------------------------------------------

function dims(src: CanvasImageSource): { w: number; h: number } {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight }
  const s = src as HTMLCanvasElement | ImageBitmap
  return { w: s.width, h: s.height }
}

function toBlob(src: CanvasImageSource): Promise<Blob> {
  const { w, h } = dims(src)
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  c.getContext('2d')!.drawImage(src, 0, 0)
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  )
}

function loadSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error('image load failed'))
    img.src = src
  })
}

async function srcToDataURL(src: string): Promise<string> {
  if (src.startsWith('data:')) return src
  const img = await loadSrc(src)
  const { w, h } = dims(img)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c.toDataURL('image/png')
}

async function blobToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob)
  try {
    const img = await loadSrc(url)
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    c.getContext('2d')!.drawImage(img, 0, 0)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Embed any blob:/http: layer images as data URLs so they survive a reload.
async function serializeDoc(doc: EditorDocument): Promise<EditorDocument> {
  const copy: EditorDocument = structuredClone(doc)
  for (const l of copy.layers) {
    if (l.type === 'image') l.src = await srcToDataURL(l.src)
  }
  return copy
}

function makeThumbnail(source: RenderSource, doc: EditorDocument, retouch: RetouchLayers): string {
  const full = document.createElement('canvas')
  renderDocument(source, doc, full, { heal: retouch.heal, erase: retouch.erase })
  const max = 360
  const scale = Math.min(1, max / Math.max(full.width, full.height))
  const t = document.createElement('canvas')
  t.width = Math.max(1, Math.round(full.width * scale))
  t.height = Math.max(1, Math.round(full.height * scale))
  const ctx = t.getContext('2d')!
  ctx.drawImage(full, 0, 0, t.width, t.height)
  return t.toDataURL('image/jpeg', 0.72)
}

// --- public API ------------------------------------------------------------

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await tx<ProjectMeta[]>(META, 'readonly', (s) => s.getAll())
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteProject(id: string): Promise<void> {
  await tx(META, 'readwrite', (s) => s.delete(id))
  await tx(DATA, 'readwrite', (s) => s.delete(id))
}

export async function renameProject(id: string, name: string): Promise<void> {
  const meta = await tx<ProjectMeta | undefined>(META, 'readonly', (s) => s.get(id))
  if (!meta) return
  await tx(META, 'readwrite', (s) => s.put({ ...meta, name, updatedAt: Date.now() }))
}

// Save the current editor session. Reuses the active project id when present so
// repeated saves update one draft instead of piling up copies.
export async function saveCurrentProject(name?: string): Promise<ProjectMeta> {
  const st = useEditor.getState()
  if (!st.source) throw new Error('Nothing to save')

  const id = st.currentProjectId ?? uid('proj')
  const existing = st.currentProjectId
    ? await tx<ProjectMeta | undefined>(META, 'readonly', (s) => s.get(id))
    : undefined
  const now = Date.now()

  const [source, doc] = await Promise.all([toBlob(st.source), serializeDoc(st.doc)])
  const heal = st.retouch.heal ? await toBlob(st.retouch.heal) : null
  const erase = st.retouch.erase ? await toBlob(st.retouch.erase) : null
  const thumbnail = makeThumbnail(st.source, st.doc, st.retouch)

  const meta: ProjectMeta = {
    id,
    name: name ?? existing?.name ?? st.fileName ?? 'Untitled draft',
    fileName: st.fileName,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    thumbnail,
  }
  const data: ProjectData = { id, source, doc, heal, erase }

  await tx(META, 'readwrite', (s) => s.put(meta))
  await tx(DATA, 'readwrite', (s) => s.put(data))
  useEditor.getState().setCurrentProjectId(id)
  return meta
}

// Load a draft back into the editor.
export async function openProject(id: string): Promise<void> {
  const data = await tx<ProjectData | undefined>(DATA, 'readonly', (s) => s.get(id))
  if (!data) throw new Error('Draft not found')
  const meta = await tx<ProjectMeta | undefined>(META, 'readonly', (s) => s.get(id))

  const source = await blobToCanvas(data.source)
  const heal = data.heal ? await blobToCanvas(data.heal) : null
  const erase = data.erase ? await blobToCanvas(data.erase) : null

  // Decode layer images up front so they draw on the first render.
  await Promise.all(
    data.doc.layers
      .filter((l) => l.type === 'image')
      .map((l) =>
        loadSrc((l as { src: string }).src)
          .then((img) => primeImage((l as { src: string }).src, img))
          .catch(() => undefined),
      ),
  )

  useEditor.getState().loadProject({
    source,
    fileName: meta?.fileName ?? 'draft',
    doc: data.doc,
    retouch: { heal, erase },
    projectId: id,
  })
}
