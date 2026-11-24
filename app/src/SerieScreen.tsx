import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { OnDeleted, View } from './App'
import {
  countCaptures,
  createTome,
  deleteSerie,
  getSerie,
  listSessions,
  listTomes,
  updateSerie,
  type Serie,
  type Session,
  type Tome,
} from './db'

type Props = { serieId: string; navigate: (v: View) => void; onDeleted: OnDeleted }

export default function SerieScreen({ serieId, navigate, onDeleted }: Props) {
  const [serie, setSerie] = useState<Serie>()
  const [tomes, setTomes] = useState<Tome[]>([])
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [numero, setNumero] = useState('')
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState('')

  const [nouveauTitre, setNouveauTitre] = useState('')
  const [auteur, setAuteur] = useState('')

  const load = useCallback(async () => {
    const s = await getSerie(serieId)
    setSerie(s)
    setNouveauTitre(s?.titre ?? '')
    setAuteur(s?.auteur ?? '')
    const all = await listTomes(serieId)
    setTomes(all)
    setNumero(String((all.at(-1)?.numero ?? 0) + 1))
    setSessions(new Map((await listSessions()).map((s) => [s.tomeId, s])))
  }, [serieId])

  useEffect(() => {
    load()
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    const n = Number(numero)
    if (!Number.isInteger(n) || n < 1) {
      setErreur('Le numéro doit être un entier positif.')
      return
    }
    try {
      await createTome(serieId, n, titre.trim())
      setTitre('')
      setErreur('')
      await load()
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  async function onRename(e: FormEvent) {
    e.preventDefault()
    await updateSerie(serieId, { titre: nouveauTitre.trim(), auteur: auteur.trim() || undefined })
    await load()
  }

  async function onDelete() {
    if (!serie) return
    const n = tomes.length
    let nbCaptures = 0
    for (const t of tomes) nbCaptures += await countCaptures(t.id)
    const detail =
      (n === 0 ? '' : ` et ses ${n} tome${n > 1 ? 's' : ''}`) +
      (nbCaptures === 0 ? '' : ` (${nbCaptures} Capture${nbCaptures > 1 ? 's' : ''})`)
    if (!confirm(`Supprimer la série « ${serie.titre} »${detail} ?`)) return
    const snapshot = await deleteSerie(serieId)
    onDeleted(`Série « ${serie.titre} » supprimée`, snapshot, { kind: 'serie', serieId })
    navigate({ kind: 'home' })
  }

  if (!serie) return null

  return (
    <>
      <button className="back" onClick={() => navigate({ kind: 'home' })}>‹ Séries</button>
      <h1>{serie.titre}</h1>

      <section>
        <h2>Tomes</h2>
        {tomes.length === 0 ? (
          <p className="muted">Aucun tome pour l'instant.</p>
        ) : (
          <ul className="list">
            {tomes.map((t) => {
              const session = sessions.get(t.id)
              return (
                <li key={t.id}>
                  <button onClick={() => navigate({ kind: 'session', tomeId: t.id })}>
                    Tome {t.numero}
                    {t.titre && ` — ${t.titre}`}
                    <span className="muted">
                      {!session ? 'Démarrer' : session.etat === 'en_cours' ? 'Reprendre' : 'Terminée'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <form onSubmit={onCreate} className="row">
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            inputMode="numeric"
            aria-label="Numéro du tome"
            className="narrow"
          />
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre (facultatif)" />
          <button type="submit" className="primary">Ajouter</button>
        </form>
        {erreur && <p className="error">{erreur}</p>}
      </section>

      <section>
        <h2>Modifier la série</h2>
        <form onSubmit={onRename} className="serie-form">
          <input value={nouveauTitre} onChange={(e) => setNouveauTitre(e.target.value)} aria-label="Titre de la série" />
          <input value={auteur} onChange={(e) => setAuteur(e.target.value)} placeholder="Auteur (pour l’EPUB)" />
          <button
            type="submit"
            className="primary"
            disabled={
              !nouveauTitre.trim() || (nouveauTitre.trim() === serie.titre && auteur.trim() === (serie.auteur ?? ''))
            }
          >
            Enregistrer
          </button>
        </form>
        <button className="danger" onClick={onDelete}>Supprimer la série</button>
      </section>
    </>
  )
}
