// A small set of consistent inline SVG line icons (stroke = currentColor) used
// throughout the editor in place of emoji, for a crisp, uniform look.

export type IconName =
  | 'logo'
  | 'adjust'
  | 'filters'
  | 'curves'
  | 'color'
  | 'crop'
  | 'retouch'
  | 'texture'
  | 'frame'
  | 'text'
  | 'draw'
  | 'ai'
  | 'export'
  | 'undo'
  | 'redo'
  | 'compare'
  | 'open'
  | 'close'
  | 'rotate'
  | 'flipH'
  | 'flipV'
  | 'heal'
  | 'airbrush'
  | 'eraser'
  | 'sparkle'
  | 'wand'
  | 'scissors'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  strokeWidth?: number
}

const PATHS: Record<IconName, JSX.Element> = {
  logo: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" />
    </>
  ),
  adjust: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2.2" fill="var(--panel)" />
      <circle cx="15" cy="12" r="2.2" fill="var(--panel)" />
      <circle cx="8" cy="17" r="2.2" fill="var(--panel)" />
    </>
  ),
  filters: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  curves: (
    <>
      <path d="M4 20 C 8 20 9 8 13 8 S 18 5 20 4" />
      <path d="M4 20 20 4" strokeDasharray="2 3" opacity="0.35" />
    </>
  ),
  color: (
    <path d="M12 3.2C12 3.2 5.5 11 5.5 15a6.5 6.5 0 0 0 13 0C18.5 11 12 3.2 12 3.2Z" />
  ),
  crop: (
    <>
      <path d="M7 2.5V16a1.5 1.5 0 0 0 1.5 1.5H22" />
      <path d="M2 7h13.5A1.5 1.5 0 0 1 17 8.5V22" />
    </>
  ),
  retouch: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  texture: (
    <g fill="currentColor" stroke="none">
      <circle cx="6" cy="7" r="1.1" />
      <circle cx="11.5" cy="5" r="1" />
      <circle cx="17" cy="8" r="1.2" />
      <circle cx="8" cy="13" r="1" />
      <circle cx="14" cy="12" r="1.3" />
      <circle cx="19" cy="14.5" r="1" />
      <circle cx="6" cy="18" r="1.2" />
      <circle cx="12" cy="18.5" r="1" />
      <circle cx="18" cy="19.5" r="1.1" />
    </g>
  ),
  frame: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1" />
    </>
  ),
  text: <path d="M5 5h14M12 5v14M9 19h6" />,
  draw: (
    <>
      <path d="M4 20l.9-4L15.5 5.4a2 2 0 0 1 2.8 0l.3.3a2 2 0 0 1 0 2.8L8 19.1 4 20Z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  ai: (
    <g fill="currentColor" stroke="none">
      <path d="M12 4l1.5 4.2L17.7 9.7l-4.2 1.5L12 15.4l-1.5-4.2L6.3 9.7l4.2-1.5Z" />
      <path d="M18 14l.7 1.9 1.9.7-1.9.7L18 19.2l-.7-1.9-1.9-.7 1.9-.7Z" />
    </g>
  ),
  export: <path d="M12 3v12M7 10l5 5 5-5M4 20h16" />,
  undo: (
    <>
      <path d="M9 6.5 4.5 11 9 15.5" />
      <path d="M4.5 11H14a5 5 0 0 1 0 10h-3" />
    </>
  ),
  redo: (
    <>
      <path d="M15 6.5 19.5 11 15 15.5" />
      <path d="M19.5 11H10a5 5 0 0 0 0 10h3" />
    </>
  ),
  compare: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" />
    </>
  ),
  open: (
    <path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8A1.5 1.5 0 0 1 20.5 9v9a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18Z" />
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  rotate: (
    <>
      <path d="M19.5 7A8 8 0 1 0 21 13" />
      <path d="M19.5 3v4.2h-4.2" />
    </>
  ),
  flipH: (
    <>
      <path d="M12 3v18" />
      <path d="M9 7 4 12l5 5Z" fill="currentColor" stroke="none" />
      <path d="M15 7l5 5-5 5Z" />
    </>
  ),
  flipV: (
    <>
      <path d="M3 12h18" />
      <path d="M7 9l5-5 5 5Z" fill="currentColor" stroke="none" />
      <path d="M7 15l5 5 5-5Z" />
    </>
  ),
  heal: (
    <>
      <rect x="3.2" y="8.5" width="17.6" height="7" rx="3.5" transform="rotate(-45 12 12)" />
      <path d="M12 9.5v5M9.5 12h5" />
    </>
  ),
  airbrush: (
    <>
      <rect x="7.5" y="10" width="7" height="11" rx="1.6" />
      <path d="M9.5 10V7.5h4V10" />
      <path d="M14.5 9h3" />
      <g fill="currentColor" stroke="none">
        <circle cx="19.5" cy="5.5" r="0.8" />
        <circle cx="20.5" cy="8" r="0.7" />
        <circle cx="18.6" cy="9" r="0.7" />
      </g>
    </>
  ),
  eraser: (
    <>
      <path d="M5 15.5 13 7.5a2 2 0 0 1 2.9 0l2.6 2.6a2 2 0 0 1 0 2.9l-6 6H8Z" />
      <path d="M8 21h11" />
    </>
  ),
  sparkle: (
    <g fill="currentColor" stroke="none">
      <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z" />
    </g>
  ),
  wand: (
    <>
      <path d="M5 19 14.5 9.5" />
      <path
        d="M16.5 4l.8 2.4 2.4.8-2.4.8-.8 2.4-.8-2.4-2.4-.8 2.4-.8Z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  scissors: (
    <>
      <circle cx="6.5" cy="7" r="2.2" />
      <circle cx="6.5" cy="17" r="2.2" />
      <path d="M8.4 8.3 20 16M8.4 15.7 20 8M8.4 8.3 13.5 12" />
    </>
  ),
}

export function Icon({ name, size = 20, className, strokeWidth = 1.7 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
