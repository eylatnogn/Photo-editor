// Splits a finished composition into N seamless carousel slides. Posted in
// order to an Instagram carousel, swiping through them reads as one continuous
// panorama — each slide is an adjacent slice of the same wide image.

export function buildCarousel(
  render: HTMLCanvasElement,
  slides: number,
  slideAspect: number, // width / height of each slide (e.g. 0.8 for 4:5)
  outW = 1080,
  offset = 0.5, // 0..1 position of the crop along the cropped axis
): HTMLCanvasElement[] {
  const outH = Math.round(outW / slideAspect)
  const panoAspect = slides * slideAspect
  const W = render.width
  const H = render.height

  // Crop the composition to the panorama aspect ratio, positioned by `offset`.
  let cw: number
  let ch: number
  let cx: number
  let cy: number
  if (W / H > panoAspect) {
    ch = H
    cw = H * panoAspect
    cx = (W - cw) * offset
    cy = 0
  } else {
    cw = W
    ch = W / panoAspect
    cx = 0
    cy = (H - ch) * offset
  }

  // Scale the crop into a single full-resolution panorama, then slice it.
  const panoW = slides * outW
  const pano = document.createElement('canvas')
  pano.width = panoW
  pano.height = outH
  const pctx = pano.getContext('2d')!
  pctx.imageSmoothingQuality = 'high'
  pctx.drawImage(render, cx, cy, cw, ch, 0, 0, panoW, outH)

  const out: HTMLCanvasElement[] = []
  for (let i = 0; i < slides; i++) {
    const c = document.createElement('canvas')
    c.width = outW
    c.height = outH
    c.getContext('2d')!.drawImage(pano, i * outW, 0, outW, outH, 0, 0, outW, outH)
    out.push(c)
  }
  return out
}
