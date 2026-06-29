// Composites several photos into a single 35mm film-strip image (vertical),
// returned as a canvas that can be added as one image layer.

function coverDraw(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  iw: number,
  ih: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sRatio = iw / ih
  const dRatio = dw / dh
  let sw = iw
  let sh = ih
  let sx = 0
  let sy = 0
  if (sRatio > dRatio) {
    sw = ih * dRatio
    sx = (iw - sw) / 2
  } else {
    sh = iw / dRatio
    sy = (ih - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
}

interface SizedImage {
  img: CanvasImageSource
  w: number
  h: number
}

export function buildFilmStrip(images: SizedImage[]): HTMLCanvasElement {
  const n = Math.max(1, images.length)
  const cellW = 620
  const cellH = 470
  const side = 92 // sprocket border on left/right
  const gap = 16
  const endB = 34
  const W = cellW + side * 2
  const H = endB * 2 + n * cellH + (n - 1) * gap

  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#0b0b0b'
  ctx.fillRect(0, 0, W, H)

  for (let i = 0; i < n; i++) {
    const y = endB + i * (cellH + gap)
    const im = images[i % images.length]
    coverDraw(ctx, im.img, im.w, im.h, side, y, cellW, cellH)
  }

  // sprocket holes down both sprocket borders
  ctx.fillStyle = 'rgba(238,236,228,0.92)'
  const holeW = side * 0.42
  const holeH = side * 0.34
  const step = holeH * 2.1
  for (let y = endB * 0.4; y < H - holeW; y += step) {
    ctx.fillRect(side * 0.28 - holeW / 2 + holeW / 2, y, holeW, holeH)
    ctx.fillRect(W - side * 0.28 - holeW / 2, y, holeW, holeH)
  }

  // edge markings
  ctx.save()
  ctx.fillStyle = 'rgba(226,150,40,0.95)'
  ctx.font = `${side * 0.34}px "Courier New", monospace`
  ctx.textBaseline = 'middle'
  ctx.translate(side * 0.62, H * 0.5)
  ctx.rotate(-Math.PI / 2)
  ctx.textAlign = 'center'
  ctx.fillText('SCRL 400  •  SCRL 400  •  SCRL 400', 0, 0)
  ctx.restore()

  return c
}
