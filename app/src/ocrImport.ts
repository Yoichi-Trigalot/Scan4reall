import type { TexteBrut, Tome } from './db'
import type { Page } from './pages'

// Contract with the OCR shortcut (ADR 0001): each Page's text follows its marker
const MARKER = /^=== T(\d+)-R(\d+) ===\s*$/

export type OcrEntry = { numero: number; rang: number; texte: string }

/** Splits a shortcut output file into one entry per marker. Text before the first marker is dropped. */
export function parseOcr(content: string): OcrEntry[] {
  const entries: OcrEntry[] = []
  let current: { numero: number; rang: number; lines: string[] } | undefined
  const flush = () => {
    if (current) entries.push({ numero: current.numero, rang: current.rang, texte: current.lines.join('\n').trim() })
  }
  for (const line of content.split(/\r?\n/)) {
    const m = MARKER.exec(line)
    if (m) {
      flush()
      current = { numero: Number(m[1]), rang: Number(m[2]), lines: [] }
    } else {
      current?.lines.push(line)
    }
  }
  flush()
  return entries
}

export type ImportReport = {
  importes: number
  vides: number
  // Markers that cannot be attached: another Tome's file, or a Rang this Tome doesn't have
  autreTome: number
  rangInconnu: number
}

/** Attaches entries to the Tome's current Pages by Rang, freezing the Rang -> Capture mapping. */
export function attach(entries: OcrEntry[], tome: Tome, pages: Page[]): { textes: TexteBrut[]; report: ImportReport } {
  const byRang = new Map(pages.map((p) => [p.rang, p]))
  const report: ImportReport = { importes: 0, vides: 0, autreTome: 0, rangInconnu: 0 }
  const textes: TexteBrut[] = []
  const now = Date.now()
  for (const e of entries) {
    if (e.numero !== tome.numero) {
      report.autreTome++
      continue
    }
    const page = byRang.get(e.rang)
    if (!page) {
      report.rangInconnu++
      continue
    }
    textes.push({ tomeId: tome.id, rang: e.rang, captureId: page.capture.id, cote: page.cote, texte: e.texte, importeLe: now })
    report.importes++
    if (!e.texte) report.vides++
  }
  return { textes, report }
}
