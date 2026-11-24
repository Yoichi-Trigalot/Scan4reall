import { describe, expect, it } from 'vitest'
import { estSuspect, estTitre, motPourLexique, nettoyer, pageIllisible, typographie, type Connu } from './nettoyage'

// Cases come from the first real Tome's OCR output
const DICO = new Set([
  'occidentale', 'religieuses', 'bouddhisme', 'peut-être', 'demi-siècle', 'humanité', 'esprit',
  'de', 'la', 'le', 'les', 'foi', 'et', 'guerre', 'est', 'une', 'conviction', 'cette',
])
const connu: Connu = (m) => DICO.has(m)

const texte = (pages: { rang: number; texte: string }[]) =>
  nettoyer(pages, connu).paragraphes.map((p) => p.map((s) => s.texte).join(' '))

describe('folio', () => {
  it('sets a trailing page number aside instead of leaving it in the text', () => {
    const r = nettoyer([{ rang: 1, texte: 'que reli-\ngieuses.\n10' }], connu)
    expect(r.folios.get(1)).toBe('10')
    expect(r.paragraphes[0][0].texte).toBe('que religieuses.')
  })

  it('keeps a number that is part of the text', () => {
    const r = nettoyer([{ rang: 1, texte: 'en 1945, avec\nla fin.' }], connu)
    expect(r.folios.size).toBe(0)
  })
})

describe('mots coupés', () => {
  it('rejoins a word split at a line end when the joined word is known', () => {
    expect(texte([{ rang: 1, texte: 'religions d’Asie occiden-\ntale. La foi' }])).toEqual([
      'religions d’Asie occidentale. La foi',
    ])
  })

  it('rejoins a split the OCR already merged into one line', () => {
    expect(texte([{ rang: 1, texte: 'que reli-gieuses.' }])).toEqual(['que religieuses.'])
  })

  it('keeps the hyphen of a real compound', () => {
    expect(texte([{ rang: 1, texte: 'c’est peut-être un demi-siècle' }])).toEqual([
      'c’est peut-être un demi-siècle',
    ])
  })

  it('keeps the hyphen when the joined word is unknown (proper noun)', () => {
    expect(texte([{ rang: 1, texte: 'avec Zara-\nthoustra, Mahomet' }])).toEqual(['avec Zara-thoustra, Mahomet'])
  })

  it('moves the end of a word split across pages back to the page it started on', () => {
    const r = nettoyer(
      [
        { rang: 9, texte: 'entre le Boud-' },
        { rang: 10, texte: 'dhisme de Nichiren.' },
      ],
      connu,
    )
    expect(r.paragraphes[0]).toEqual([
      { rang: 9, texte: 'entre le Bouddhisme' },
      { rang: 10, texte: 'de Nichiren.' },
    ])
  })
})

describe('paragraphes', () => {
  it('joins lines of a sentence cut by the OCR', () => {
    expect(texte([{ rang: 1, texte: 'version anglaise de « La Révolution\nHumaine » couvre une période.' }])).toEqual([
      'version anglaise de « La Révolution Humaine » couvre une période.',
    ])
  })

  it('continues a paragraph across a page break', () => {
    const r = nettoyer(
      [
        { rang: 11, texte: 'la folie militariste qui s’était emparée du gouvernement le' },
        { rang: 12, texte: 'conduisit au désastre.' },
      ],
      connu,
    )
    expect(r.paragraphes).toHaveLength(1)
    expect(r.paragraphes[0].map((s) => s.rang)).toEqual([11, 12])
  })
})

describe('typographie', () => {
  it('uses the typographic apostrophe', () => {
    expect(typographie("l'esprit")).toBe('l’esprit')
  })

  it('puts a non-breaking space before high punctuation, with or without an OCR space', () => {
    expect(typographie('la guerre ?')).toBe('la guerre ?')
    expect(typographie('la guerre?')).toBe('la guerre ?')
  })

  it('leaves times and references alone', () => {
    expect(typographie('à 10:30')).toBe('à 10:30')
  })
})

describe('mots suspects', () => {
  it('flags show-through read as Cyrillic look-alikes', () => {
    expect(estSuspect('ВИТАМОН', connu)).toBe(true)
  })

  it('accepts a known word behind an elision', () => {
    expect(estSuspect('l’humanité', connu)).toBe(false)
  })

  it('flags an unknown word and an OCR-damaged small-caps numeral', () => {
    expect(estSuspect('Nichiren', connu)).toBe(true)
    expect(estSuspect('xm’', connu)).toBe(true)
  })

  it('ignores numbers and ISBN-like references', () => {
    expect(estSuspect('1945', connu)).toBe(false)
    expect(estSuspect('2-268-00608-5', connu)).toBe(false)
  })

  it('accepts a hyphenated word whose parts are all known', () => {
    expect(estSuspect('Est-ce', (m) => m === 'est' || m === 'ce')).toBe(false)
  })
})

describe('graphies du dictionnaire', () => {
  const dico: Connu = (m) => ['coeur', 'état', 'église', 'asie'].includes(m)

  it('matches œ against the dictionary’s oe spelling', () => {
    expect(estSuspect('cœur', dico)).toBe(false)
  })

  it('accepts a capital printed without its accent, also after an elision', () => {
    expect(estSuspect('Eglise', dico)).toBe(false)
    expect(estSuspect('d’Etat', dico)).toBe(false)
  })

  it('does not invent an accent on a lowercase word', () => {
    expect(estSuspect('etat', dico)).toBe(true)
  })

  it('validates the word without its elision', () => {
    expect(motPourLexique('d’Asie')).toBe('asie')
    expect(motPourLexique('Nichiren')).toBe('nichiren')
  })
})

describe('page illisible', () => {
  it('proposes a show-through page full of gibberish', () => {
    expect(pageIllisible('д регое плопоров тисого', connu)).toBe(true)
  })

  it('keeps a normal page with a few unknown names', () => {
    expect(pageIllisible('la foi de Nichiren et la conviction de Toda est une guerre', connu)).toBe(false)
  })
})

describe('titres', () => {
  it('recognizes the three heading shapes of the first Serie', () => {
    expect(estTitre('LIVRE I')).toBe(true)
    expect(estTitre('1. L’AUBE')).toBe(true)
    expect(estTitre('PRÉFACE A L’ÉDITION ANGLAISE')).toBe(true)
  })

  it('rejects body text, short capitals and sentences', () => {
    expect(estTitre('Le 3 juillet 1945, le jour même de la libération de')).toBe(false)
    expect(estTitre('ISBN')).toBe(false)
    expect(estTitre('VIVE LE JAPON !')).toBe(false)
    expect(estTitre('ТЯНЕЛА ОТМ')).toBe(false)
  })

  it('keeps a numbered heading out of the paragraph that follows it', () => {
    const r = nettoyer([{ rang: 40, texte: '1. L’AUBE\nRien n’est plus cruel que la\nguerre.' }], connu)
    expect(r.paragraphes.map((p) => p[0].texte)).toEqual(['1. L’AUBE', 'Rien n’est plus cruel que la guerre.'])
    expect([...r.titres]).toEqual([0])
  })

  it('joins a heading printed on two lines', () => {
    const r = nettoyer([{ rang: 8, texte: 'AVANT-PROPOS\nDE ARNOLD TOYNBEE\n« La Révolution Humaine » est' }], connu)
    expect(r.paragraphes[0][0].texte).toBe('AVANT-PROPOS DE ARNOLD TOYNBEE')
    expect([...r.titres]).toEqual([0])
  })
})
