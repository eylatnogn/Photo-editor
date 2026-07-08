import { useState } from 'react'
import { cutoutFromSrc } from '../ai/backgroundRemoval'
import { primeImage } from '../engine/imageCache'
import { Icon } from './ui/Icon'

// A reusable "remove background" button for any single image (photo layer or
// collage slot). Runs the in-browser cutout on `src` and hands the resulting
// transparent-PNG data URL + aspect ratio back to `onDone`.
export function RemoveBgButton({
  src,
  onDone,
  block,
}: {
  src: string
  onDone: (url: string, ratio: number) => void
  block?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState(false)

  const run = async () => {
    if (busy) return
    setBusy(true)
    setErr(false)
    setPct(0)
    try {
      const { url, ratio, img } = await cutoutFromSrc(src, (p) => setPct(p.progress))
      primeImage(url, img)
      onDone(url, ratio)
    } catch {
      setErr(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button className={block ? 'btn block' : 'btn'} onClick={run} disabled={busy}>
        <Icon name="scissors" size={14} />
        {busy
          ? pct > 0
            ? `Removing… ${Math.round(pct * 100)}%`
            : 'Removing…'
          : 'Remove background'}
      </button>
      {err && <p className="error-text">Couldn’t remove the background (needs network on first use).</p>}
    </>
  )
}
