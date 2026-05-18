import type { DOMOutputSpec } from '@tiptap/pm/model'

/** Raster-free SVG embedded in data URL — works in TipTap/PM (nested SVG + path often break due to namespace). */
function svgDataUrl(innerMarkup: string, stroke: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${innerMarkup}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/* Lucide paperclip / user — paths from lucide-static@0.460.0 */
const PAPERCLIP_PATH
  = '<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>'

const USER_MARKUP
  = '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'

/** Matches `text-emerald-900` chips on `bg-emerald-50`. */
const STROKE_FILE = '#047857'

/** Matches `text-zinc-800` chips. */
const STROKE_CONTACT = '#3f3f46'

function iconImg(src: string): DOMOutputSpec {
  return [
    'img',
    {
      src,
      alt: '',
      width: '14',
      height: '14',
      decoding: 'async',
      class: 'mention-chip-icon',
      draggable: 'false',
    },
  ]
}

/** Lucide `paperclip` rendered as data-URL image. */
export function lucidePaperclipIcon(): DOMOutputSpec {
  return iconImg(svgDataUrl(PAPERCLIP_PATH, STROKE_FILE))
}

/** Lucide `user` rendered as data-URL image. */
export function lucideUserIcon(): DOMOutputSpec {
  return iconImg(svgDataUrl(USER_MARKUP, STROKE_CONTACT))
}
