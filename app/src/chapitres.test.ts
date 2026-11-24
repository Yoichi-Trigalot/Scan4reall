import { describe, expect, it } from 'vitest'
import { fusionner, suggererChapitres } from './chapitres'
import type { Chapitre } from './db'
import { nettoyer } from './nettoyage'

const connu = () => true

describe('chapitres', () => {
  const n = nettoyer(
    [
      { rang: 20, texte: 'LIVRE I' },
      { rang: 21, texte: '1. L’AUBE\nRien n’est plus cruel.' },
      { rang: 40, texte: '2. RECONSTRUCTION\nLe 3 juillet 1945.' },
    ],
    connu,
  )

  it('suggests every heading with its level', () => {
    expect(suggererChapitres(n).map((s) => [s.rang, s.texte, s.niveau])).toEqual([
      [20, 'LIVRE I', 1],
      [21, '1. L’AUBE', 2],
      [40, '2. RECONSTRUCTION', 2],
    ])
  })

  it('applies decisions and keeps chapters added by hand in page order', () => {
    const decision = (d: Partial<Chapitre>): Chapitre => ({
      id: 'x', tomeId: 't', rang: 0, statut: 'confirme', titre: '', niveau: 2, ...d,
    })
    const vues = fusionner(suggererChapitres(n), [
      decision({ id: 'a', suggestion: '21|1. L’AUBE', rang: 21, titre: '1. L’Aube' }),
      decision({ id: 'b', suggestion: '40|2. RECONSTRUCTION', rang: 40, statut: 'rejete', titre: '2. RECONSTRUCTION' }),
      decision({ id: 'c', rang: 30, titre: 'Interlude' }),
    ])
    expect(vues.map((v) => [v.rang, v.titre, v.statut])).toEqual([
      [20, 'LIVRE I', 'suggere'],
      [21, '1. L’Aube', 'confirme'],
      [30, 'Interlude', 'confirme'],
      [40, '2. RECONSTRUCTION', 'rejete'],
    ])
  })
})
