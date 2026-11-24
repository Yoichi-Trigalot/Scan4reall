import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { View } from './App'
import {
  createTome,
  getSerie,
  listSessions,
  listTomes,
  type Serie,
  type Session,
  type Tome,
} from './db'

type Props = { serieId: string; navigate: (v: View) => void }

export default function SerieScreen({ serieId, navigate }: Props) {
  const [serie, setSerie] = useState<Serie>()
  const [tomes, setTomes] = useState<Tome[]>([])
  const [sessions, setSessions] = useState<Map<string, Session>>(new Map())
  const [numero, setNumero] = useState('')
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState('')

  const load = useCallback(async () => {
    setSerie(await getSerie(serieId))
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
    </>
  )
}
