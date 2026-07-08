// AI background removal. Runs entirely in the browser via @imgly's
// background-removal package (ONNX model executed with WASM/WebGL). The model
// weights are fetched on first use, so this requires network access the first
// time it runs.

import { removeBackground } from '@imgly/background-removal'

export interface BgRemovalProgress {
  stage: string
  progress: number // 0..1
}

/**
 * Remove the background from a source canvas/image, returning a new image
 * element with a transparent background. Reports coarse progress via the
 * optional callback.
 */
export async function removeImageBackground(
  source: HTMLCanvasElement | Blob,
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<HTMLImageElement> {
  const blob =
    source instanceof Blob ? source : await canvasToBlob(source, 'image/png')

  const resultBlob = await removeBackground(blob, {
    output: { format: 'image/png' },
    progress: (key: string, current: number, total: number) => {
      if (onProgress) {
        onProgress({
          stage: key,
          progress: total > 0 ? current / total : 0,
        })
      }
    },
  })

  return blobToImage(resultBlob)
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type,
      quality,
    )
  })
}

function loadSrc(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not decode image'))
    img.src = src
  })
}

/**
 * Cut out the subject of an individual image (a photo layer or collage slot),
 * returning a transparent PNG data URL plus its decoded image + aspect ratio.
 * The data URL keeps the cutout self-contained so it survives save/reload.
 */
export async function cutoutFromSrc(
  src: string,
  onProgress?: (p: BgRemovalProgress) => void,
): Promise<{ url: string; ratio: number; img: HTMLImageElement }> {
  const img = await loadSrc(src)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  const cut = await removeImageBackground(c, onProgress)
  const out = document.createElement('canvas')
  out.width = cut.naturalWidth
  out.height = cut.naturalHeight
  out.getContext('2d')!.drawImage(cut, 0, 0)
  return { url: out.toDataURL('image/png'), ratio: cut.naturalWidth / cut.naturalHeight, img: cut }
}

export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load processed image'))
    }
    img.src = url
  })
}
