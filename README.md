# Aperture — Photo Editor

A full-featured, browser-based photo editor built with **React + TypeScript + Vite**.
All editing happens client-side on a Canvas/WebAssembly pipeline — your photos
never leave your device.

![status](https://img.shields.io/badge/status-active-success)

## Features

### Adjustments (20+ controls)
- **Light** — exposure, brightness, contrast, highlights, shadows
- **Color** — saturation, vibrance, temperature, tint, hue
- **Tone / Levels** — black point, white point, gamma
- **Effects** — sharpen, blur, vignette, film grain, grayscale, sepia, invert

### Filters
- 12 one-click presets (Vivid, Mono, Noir, Vintage, Warm, Cool, Fade, Pop,
  Dramatic, Sunset, Invert) with live thumbnails
- Presets layer on top of manual edits, so you can still fine-tune any look

### Crop & geometry
- Drag-handle crop with rule-of-thirds overlay
- Aspect-ratio presets (1:1, 4:3, 16:9, 3:2, and more)
- Rotate 90°, free straighten (±45°), horizontal/vertical flip

### Text & drawing
- Multi-line text layers: font, size, color, bold/italic, alignment, rotation,
  opacity — drag to reposition directly on the image
- Freehand brush with color swatches, size and opacity

### AI tools
- **Remove Background** — in-browser AI segmentation (ONNX model via
  [@imgly/background-removal](https://github.com/imgly/background-removal-js));
  the model downloads on first use, so it needs network access the first time
- **Auto Enhance** — instant, offline histogram-based exposure/contrast/color
  balancing

### Workflow
- Full **undo/redo** history (`Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`)
- Hold **Compare** to see the original
- Export to **PNG / JPEG / WebP** with quality control and 50% / 100% / 200%
  resizing, rendered at full source resolution

## Getting started

```bash
npm install
npm run dev        # start the dev server (http://localhost:5173)
npm run build      # type-check + production build
npm run preview    # preview the production build
```

## Architecture

The editor is built around a declarative, serializable document model so every
edit can be snapshotted for undo/redo and re-rendered deterministically.

```
src/
├── types/            # EditorDocument model (adjustments, transform, layers)
├── state/            # Zustand store with live/commit history model
├── engine/
│   ├── filters.ts    # pure pixel routines (tone LUT, HSL, sharpen, vignette…)
│   ├── render.ts     # the render pipeline (transform → pixels → layers)
│   └── presets.ts    # filter preset definitions
├── ai/               # in-browser AI background removal
├── components/       # Toolbar, TopBar, EditorCanvas, Dropzone
│   ├── panels/       # one panel per tool
│   └── ui/           # reusable Slider wired to the history model
└── utils/            # image loading, downloads, ids
```

**Rendering pipeline** (`engine/render.ts`):
1. Apply crop + flip + rotation to the source
2. Apply blur via the native canvas filter
3. Single-pass per-pixel color adjustments (exposure → contrast → levels →
   white balance → tone → HSL → grayscale/sepia/invert) using a precomputed
   256-entry tone LUT for speed
4. Convolution sharpen, vignette, film grain
5. Composite text and drawing layers

A downscaled preview source keeps live editing fast; export re-runs the same
pipeline at full resolution.

## Notes
- Background removal fetches a ~40 MB model on first use; subsequent runs are
  cached by the browser.
- Everything else runs fully offline.
