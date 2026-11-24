import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { fusionner, suggererChapitres } from './chapitres'
import type { Chapitre, Serie, Tome } from './db'
import { completerFolios, construireEpub, planEpub } from './epub'
import { nettoyer } from './nettoyage'

const n = nettoyer(
  [
    { rang: 3, texte: 'LE ROCHER\nÉditeur' },
    { rang: 20, texte: 'LIVRE I' },
    { rang: 21, texte: '1. L’AUBE\nRien n’est plus cruel que la\n12' },
    { rang: 22, texte: 'guerre. Fin du chapitre.\n13' },
    { rang: 23, texte: '2. RECONSTRUCTION\nLe 3 juillet 1945.' },
  ],
  () => true,
)

const decision = (cle: string, rang: number, titre: string, niveau: 1 | 2, statut: Chapitre['statut'] = 'confirme'): Chapitre => ({
  id: cle, tomeId: 't', suggestion: cle, rang, statut, titre, niveau,
})
const vues = fusionner(suggererChapitres(n), [
  decision('3|LE ROCHER', 3, 'LE ROCHER', 1, 'rejete'),
  decision('20|LIVRE I', 20, 'Livre I', 1),
  decision('21|1. L’AUBE', 21, '1. L’aube', 2),
  decision('23|2. RECONSTRUCTION', 23, '2. Reconstruction', 2),
])

describe('completerFolios', () => {
  it('fills a missed folio when both neighbors agree', () => {
    expect(completerFolios(new Map([[9, '10'], [11, '12']]), [9, 10, 11]).get(10)).toBe('11')
  })

  it('guesses nothing when the gap does not match', () => {
    expect(completerFolios(new Map([[9, '10'], [11, '20']]), [9, 10, 11]).has(10)).toBe(false)
  })
})

describe('planEpub', () => {
  const plan = planEpub(n, vues, n.folios)

  it('starts at the first confirmed chapter: front matter stays out', () => {
    expect(plan.chapitres.map((c) => [c.titre, c.niveau])).toEqual([
      ['Livre I', 1],
      ['1. L’aube', 2],
      ['2. Reconstruction', 2],
    ])
    expect(plan.chapitres.some((c) => c.html.includes('ROCHER'))).toBe(false)
  })

  it('keeps the paragraph across the page break, with a visible folio marker between words', () => {
    expect(plan.chapitres[1].html).toContain(
      'que la <span epub:type="pagebreak" role="doc-pagebreak" id="page-r22" title="13" class="folio">13</span>guerre.',
    )
    expect(plan.pages.map((p) => p.folio)).toEqual(['12', '13'])
  })

  it('does not repeat the printed heading inside its chapter', () => {
    expect(plan.chapitres[1].html).not.toContain('L’AUBE')
  })
})

describe('construireEpub', () => {
  it('writes an EPUB 3 package with mimetype first and series metadata', async () => {
    const serie: Serie = { id: 's', titre: 'La Révolution humaine', creeeLe: 0, auteur: 'Daisaku Ikeda' }
    const tome: Tome = { id: 'tome-1', serieId: 's', numero: 1, titre: '' }
    const zip = await JSZip.loadAsync(await construireEpub(serie, tome, planEpub(n, vues, n.folios), new Date(0)))
    expect(Object.keys(zip.files)[0]).toBe('mimetype')
    const opf = await zip.file('OEBPS/content.opf')!.async('string')
    expect(opf).toContain('<dc:title>La Révolution humaine 01</dc:title>')
    expect(opf).toContain('<meta refines="#serie" property="group-position">1</meta>')
    const nav = await zip.file('OEBPS/nav.xhtml')!.async('string')
    expect(nav).toMatch(/Livre I<\/a>\n<ol>\n<li><a href="chapitre-002.xhtml">1\. L’aube/)
  })
})
