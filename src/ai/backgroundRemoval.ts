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
