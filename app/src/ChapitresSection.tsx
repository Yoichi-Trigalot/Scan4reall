import { useState } from 'react'
import type { ChapitreVue } from './chapitres'
import { deleteChapitre, putChapitres, type Chapitre, type Tome } from './db'
import { pageName } from './pages'

type Props = { tome: Tome; vues: ChapitreVue[]; onPage: (rang: number) => void; onChange: () => void }

const STATUTS: Record<ChapitreVue['statut'], string> = { suggere: 'à confirmer', confirme: 'confirmé', rejete: 'rejeté' }

export default function ChapitresSection({ tome, vues, onPage, onChange }: Props) {
  const [renommage, setRenommage] = useState<{ cle: string; titre: string }>()

  // Records or updates the decision on a chapter
  async function decider(v: ChapitreVue, patch: Partial<Chapitre>) {
    const base = v.decision ?? {
      tomeId: tome.id,
      suggestion: v.cle,
      rang: v.rang,
      titre: v.titre,
      niveau: v.niveau,
      statut: 'confirme' as const,
    }
    await putChapitres([{ ...base, ...patch }])
    onChange()
  }

  const aConfirmer = vues.filter((v) => v.statut === 'suggere')
  const confirmes = vues.filter((v) => v.statut === 'confirme').length

  return (
    <section>
      <h2>
        Chapitres · {confirmes} confirmé{confirmes > 1 ? 's' : ''}, {aConfirmer.length} à confirmer
      </h2>
      {vues.length === 0 && <p className="muted">Aucun titre détecté pour l’instant.</p>}
      {aConfirmer.length > 1 && (
        <button
          className="link"
          onClick={async () => {
            await putChapitres(
              aConfirmer.map((v) => ({
                tomeId: tome.id,
                suggestion: v.cle,
                rang: v.rang,
                titre: v.titre,
                niveau: v.niveau,
                statut: 'confirme' as const,
              })),
            )
            onChange()
          }}
        >
          Tout confirmer
        </button>
      )}
      <ul className="list chapitres">
        {vues.map((v) => (
          <li key={v.cle} className={`chapitre ${v.statut}`}>
            <div className="row chapitre-ligne">
              <span className={v.niveau === 2 ? 'niveau-2' : undefined}>
                {renommage?.cle === v.cle ? null : v.titre}
              </span>
              <span className="muted small">{STATUTS[v.statut]}</span>
            </div>
            {renommage?.cle === v.cle && (
              <form
                className="row"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (renommage.titre.trim()) await decider(v, { titre: renommage.titre.trim(), statut: 'confirme' })
                  setRenommage(undefined)
                }}
              >
                <input autoFocus value={renommage.titre} onChange={(e) => setRenommage({ cle: v.cle, titre: e.target.value })} />
                <button type="submit" className="primary">OK</button>
              </form>
            )}
            <div className="row chapitre-actions">
              <button className="link small" onClick={() => onPage(v.rang)}>
                {pageName(tome.numero, v.rang)}
              </button>
              {v.statut !== 'confirme' && (
                <button className="link small" onClick={() => decider(v, { statut: 'confirme' })}>
                  Confirmer
                </button>
              )}
              {v.statut !== 'rejete' && !(v.decision && !v.decision.suggestion) && (
                <button className="link small" onClick={() => decider(v, { statut: 'rejete' })}>
                  Rejeter
                </button>
              )}
              <button className="link small" onClick={() => setRenommage({ cle: v.cle, titre: v.titre })}>
                Renommer
              </button>
              {v.decision && !v.decision.suggestion && (
                <button
                  className="link small"
                  onClick={async () => {
                    await deleteChapitre(v.decision!.id)
                    onChange()
                  }}
                >
                  Supprimer
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
