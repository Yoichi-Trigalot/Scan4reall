import type { Chapitre } from './db'
import type { Nettoyage } from './nettoyage'

/** A heading found by the cleaning: "rang|text" identifies it across reloads. */
export type Suggestion = { cle: string; rang: number; texte: string; niveau: 1 | 2 }

// "1. L'AUBE" is a chapter inside a part; "LIVRE I", "PRÉFACE…" sit at the top level
const CHAPITRE_NUMEROTE = /^\d{1,3}\.\s/

export function suggererChapitres(n: Nettoyage): Suggestion[] {
  return [...n.titres]
    .sort((a, b) => a - b)
    .map((i) => {
      const p = n.paragraphes[i]
      const texte = p.map((s) => s.texte).join(' ')
      return { cle: `${p[0].rang}|${texte}`, rang: p[0].rang, texte, niveau: CHAPITRE_NUMEROTE.test(texte) ? 2 : 1 }
    })
}

export type ChapitreVue = {
  cle: string
  rang: number
  titre: string
  niveau: 1 | 2
  statut: 'suggere' | 'confirme' | 'rejete'
  decision?: Chapitre
}

/** Suggestions with their decision, plus chapters added by hand, in page order. */
export function fusionner(suggestions: Suggestion[], decisions: Chapitre[]): ChapitreVue[] {
  const parSuggestion = new Map(decisions.filter((d) => d.suggestion).map((d) => [d.suggestion!, d]))
  const vues: ChapitreVue[] = suggestions.map((s) => {
    const d = parSuggestion.get(s.cle)
    return d
      ? { cle: s.cle, rang: s.rang, titre: d.titre, niveau: d.niveau, statut: d.statut, decision: d }
      : { cle: s.cle, rang: s.rang, titre: s.texte, niveau: s.niveau, statut: 'suggere' }
  })
  for (const d of decisions.filter((x) => !x.suggestion)) {
    vues.push({ cle: `manuel|${d.id}`, rang: d.rang, titre: d.titre, niveau: d.niveau, statut: d.statut, decision: d })
  }
  return vues.sort((a, b) => a.rang - b.rang)
}
