import type { Correction } from './db'
import { estSuspect, MOTS, pageIllisible, type Connu, type Nettoyage } from './nettoyage'

const BORD = "[\\p{L}\\p{N}’'-]"
const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Replaces whole words only: correcting "Gakkai" must not touch "Gakkaïste". */
export function remplacerMot(texte: string, de: string, vers: string): string {
  return texte.replace(new RegExp(`(?<!${BORD})${echapper(de)}(?!${BORD})`, 'gu'), vers)
}

/** Corrections apply to the cleaned text, so they survive a re-import of the OCR. */
export function appliquerCorrections(n: Nettoyage, corrections: Correction[]): Nettoyage {
  if (corrections.length === 0) return n
  return {
    folios: n.folios,
    paragraphes: n.paragraphes.map((p) =>
      p.map((s) => ({
        rang: s.rang,
        texte: corrections
          .filter((c) => c.rang === undefined || c.rang === s.rang)
          .reduce((t, c) => remplacerMot(t, c.de, c.vers), s.texte),
      })),
    ),
  }
}

export type Occurrence = { rang: number; contexte: string }

/** One suspect word of the Tome, case-insensitive, with every place it appears. */
export type MotSuspect = { cle: string; forme: string; occurrences: Occurrence[] }

const CONTEXTE = 40

type Entree = { formes: Map<string, number>; occurrences: Occurrence[] }

export function listerSuspects(n: Nettoyage, connu: Connu): MotSuspect[] {
  const parCle = new Map<string, Entree>()
  for (const p of n.paragraphes) {
    for (const s of p) {
      for (const m of s.texte.matchAll(MOTS)) {
        if (!estSuspect(m[0], connu)) continue
        const cle = m[0].toLowerCase()
        const entree: Entree = parCle.get(cle) ?? { formes: new Map(), occurrences: [] }
        entree.formes.set(m[0], (entree.formes.get(m[0]) ?? 0) + 1)
        const debut = Math.max(0, m.index - CONTEXTE)
        const fin = Math.min(s.texte.length, m.index + m[0].length + CONTEXTE)
        entree.occurrences.push({
          rang: s.rang,
          contexte: (debut > 0 ? '…' : '') + s.texte.slice(debut, fin) + (fin < s.texte.length ? '…' : ''),
        })
        parCle.set(cle, entree)
      }
    }
  }
  return [...parCle]
    .map(([cle, e]) => ({
      cle,
      // Shown as its most frequent spelling (Ikeda rather than IKEDA)
      forme: [...e.formes].sort((a, b) => b[1] - a[1])[0][0],
      occurrences: e.occurrences,
    }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || a.cle.localeCompare(b.cle, 'fr'))
}

export type Motif = 'illisible' | 'vide' | 'courte' | 'suspects'

export type PageARevoir = { rang: number; motifs: Motif[]; nbSuspects: number }

export type PageTexte = { rang: number; brut: string; ignoree: boolean }

// A Page this much shorter than its neighbors may have lost lines: Apple's OCR drops them silently
const COURTE = 0.6
const VOISINAGE = 5

/** Only flagged Pages need a look; the others are taken as good (Q34). */
export function pagesARevoir(pages: PageTexte[], n: Nettoyage, connu: Connu): PageARevoir[] {
  const longueur = new Map<number, number>()
  const suspects = new Map<number, number>()
  for (const p of n.paragraphes) {
    for (const s of p) {
      longueur.set(s.rang, (longueur.get(s.rang) ?? 0) + s.texte.length)
      const nb = (s.texte.match(MOTS) ?? []).filter((t) => estSuspect(t, connu)).length
      suspects.set(s.rang, (suspects.get(s.rang) ?? 0) + nb)
    }
  }
  const actives = pages.filter((p) => !p.ignoree)
  const illisibles = new Set(actives.filter((p) => p.brut.trim() && pageIllisible(p.brut, connu)).map((p) => p.rang))
  const normales = actives.filter((p) => p.brut.trim() && !illisibles.has(p.rang))

  return actives.flatMap((p) => {
    const motifs: Motif[] = []
    if (!p.brut.trim()) motifs.push('vide')
    else if (illisibles.has(p.rang)) motifs.push('illisible')
    else {
      const i = normales.findIndex((x) => x.rang === p.rang)
      const voisines = normales
        .slice(Math.max(0, i - VOISINAGE), i + VOISINAGE + 1)
        .filter((x) => x.rang !== p.rang)
        .map((x) => longueur.get(x.rang) ?? 0)
        .sort((a, b) => a - b)
      if (voisines.length >= 3 && (longueur.get(p.rang) ?? 0) < COURTE * voisines[Math.floor(voisines.length / 2)]) {
        motifs.push('courte')
      }
    }
    const nbSuspects = suspects.get(p.rang) ?? 0
    if (nbSuspects > 0 && !motifs.includes('illisible')) motifs.push('suspects')
    return motifs.length > 0 ? [{ rang: p.rang, motifs, nbSuspects }] : []
  })
}
