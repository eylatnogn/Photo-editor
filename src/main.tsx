import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/fonts.css'
import './styles/global.css'

// Kick off loading the self-hosted text fonts so they're ready when the canvas
// draws (canvas text doesn't trigger CSS font loading on its own).
const TEXT_FONTS = [
  'Caveat', 'Dancing Script', 'Sacramento', 'Pacifico', 'Gloria Hallelujah',
  'Playfair Display', 'Lobster', 'Bebas Neue', 'Shrikhand', 'Press Start 2P', 'VT323',
]
if (document.fonts) {
  for (const f of TEXT_FONTS) document.fonts.load(`16px "${f}"`).catch(() => undefined)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
