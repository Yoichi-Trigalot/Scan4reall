import { cleanForOcr } from './cleanForOcr'
import type { Capture } from './db'

/** One page of the book: one half of a Capture. Derived, never stored. */
export type Page = { rang: number; cote: 'gauche' | 'droite'; capture: Capture }

// The k-th Capture yields Rang 2k-1 (left half) and 2k (right half). Position, not
// Capture.ordre, drives the Rang so deleted Captures leave no gaps.
export function pagesOf(captures: Capture[]): Page[] {
  return captures.flatMap((capture, i) => [
    { rang: 2 * i + 1, cote: 'gauche' as const, capture },
    { rang: 2 * i + 2, cote: 'droite' as const, capture },
  ])
}

/** File name shared with the OCR shortcut marker (ADR 0001): T01-R0042 */
export function pageName(tomeNumero: number, rang: number): string {
  return `T${String(tomeNumero).padStart(2, '0')}-R${String(rang).padStart(4, '0')}`
}

// Split is at the exact center: the capture screen shows a guide line there
export function renderPage(page: Page): Promise<ImageBitmap> {
  const { blob, largeur, hauteur } = page.capture
  const half = Math.floor(largeur / 2)
  const x = page.cote === 'gauche' ? 0 : largeur - half
  return createImageBitmap(blob, x, 0, half, hauteur)
}

/** The Page as the OCR receives it: cropped, then cleaned of show-through. */
export async function renderCleanPage(page: Page): Promise<HTMLCanvasElement> {
  const bitmap = await renderPage(page)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  ctx.putImageData(cleanForOcr(ctx.getImageData(0, 0, canvas.width, canvas.height)), 0, 0)
  return canvas
}

const EXPORT_JPEG_QUALITY = 0.9

/** Encodes a Page as the JPEG file the OCR shortcut receives. */
export async function pageFile(page: Page, tomeNumero: number): Promise<File> {
  const canvas = await renderCleanPage(page)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', EXPORT_JPEG_QUALITY))
  if (!blob) throw new Error('Encodage JPEG impossible')
  return new File([blob], `${pageName(tomeNumero, page.rang)}.jpg`, { type: 'image/jpeg' })
}
