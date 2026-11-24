import { describe, expect, it } from 'vitest'
import type { Correction } from './db'
import type { Connu, Nettoyage } from './nettoyage'
import { appliquerCorrections, listerSuspects, pagesARevoir, remplacerMot } from './verification'

const DICO = new Set(['la', 'soka', 'est', 'une', 'association', 'de', 'foi', 'le', 'japon', 'et', 'des', 'gens'])
const connu: Connu = (m) => DICO.has(m)
const n = (...segments: [number, string][]): Nettoyage => ({
  folios: new Map(),
  paragraphes: segments.map(([rang, texte]) => [{ rang, texte }]),
})

describe('remplacerMot', () => {
  it('replaces whole words only', () => {
    expect(remplacerMot('la Gakkai et la Gakkaiste', 'Gakkai', 'Gakkaï')).toBe('la Gakkaï et la Gakkaiste')
  })

  it('treats regex characters literally', () => {
    expect(remplacerMot('au xm° siècle', 'xm°', 'XIIIe')).toBe('au XIIIe siècle')
  })
})

describe('appliquerCorrections', () => {
  const c = (de: string, vers: string, rang?: number): Correction => ({ id: de, tomeId: 't', de, vers, rang })

  it('applies a Tome-wide correction everywhere and a Page correction on its Page only', () => {
    const r = appliquerCorrections(n([1, 'la Gakkai, la Soka'], [2, 'la Gakkai et Soka']), [
      c('Gakkai', 'Gakkaï'),
      c('Soka', 'SOKA', 2),
    ])
    expect(r.paragraphes.map((p) => p[0].texte)).toEqual(['la Gakkaï, la Soka', 'la Gakkaï et SOKA'])
  })
})

describe('listerSuspects', () => {
  it('groups a word regardless of case, most frequent first, with its context', () => {
    const r = listerSuspects(n([1, 'Ikeda et IKEDA'], [2, 'la foi de Ikeda et de Toda']), connu)
    expect(r.map((m) => [m.forme, m.occurrences.length])).toEqual([
      ['Ikeda', 3],
      ['Toda', 1],
    ])
    expect(r[1].occurrences[0]).toEqual({ rang: 2, contexte: 'la foi de Ikeda et de Toda' })
  })
})

describe('pagesARevoir', () => {
  const longue = 'la foi est une association de la foi et des gens du Japon '.repeat(5)
  const pages = (brut: string[]) => brut.map((b, i) => ({ rang: i + 1, brut: b, ignoree: false }))

  it('flags an empty Page, a gibberish Page and a Page much shorter than its neighbors', () => {
    const bruts = [longue, longue, '', 'д регое плопоров тисого', longue, 'la foi', longue, longue]
    const nett = n(...bruts.map((b, i): [number, string] => [i + 1, b]).filter(([, b]) => b))
    const r = pagesARevoir(pages(bruts), nett, (m) => DICO.has(m) || m === 'du')
    expect(r).toEqual([
      { rang: 3, motifs: ['vide'], nbSuspects: 0 },
      { rang: 4, motifs: ['illisible'], nbSuspects: 4 },
      { rang: 6, motifs: ['courte'], nbSuspects: 0 },
    ])
  })

  it('skips ignored Pages', () => {
    const r = pagesARevoir([{ rang: 1, brut: '', ignoree: true }], n(), connu)
    expect(r).toEqual([])
  })
})
