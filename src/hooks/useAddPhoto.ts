import { useEditor } from '../state/editorStore'
import { primeImage } from '../engine/imageCache'
import { loadImageFromFile, uid } from '../utils'

// Shared "add a photo layer" action used by the Stickers and Carousel panels.
export function useAddPhoto() {
  const addLayer = useEditor((s) => s.addLayer)
  return async (file: File) => {
    const img = await loadImageFromFile(file)
    primeImage(img.src, img)
    const ratio = img.naturalWidth / img.naturalHeight
    // Size so a portrait photo doesn't tower over the canvas.
    const scale = Math.max(0.18, Math.min(0.45, 0.55 * ratio))
    addLayer({
      id: uid('image'),
      type: 'image',
      src: img.src,
      x: 0.5,
      y: 0.5,
      scale,
      rotation: 0,
      opacity: 1,
      naturalRatio: ratio,
      frame: 'none',
    })
  }
}
