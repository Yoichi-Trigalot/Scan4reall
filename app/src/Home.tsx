import { useEffect, useState, type FormEvent } from 'react'
import type { View } from './App'
import { createSerie, getTome, listSeries, listSessions, type Serie, type Tome } from './db'

type EnCours = { tome: Tome; serie: Serie }

export default function Home({ navigate }: { navigate: (v: View) => void }) {
  const [series, setSeries] = useState<Serie[]>([])
  const [enCours, setEnCours] = useState<EnCours[]>([])
  const [titre, setTitre] = useState('')

  async function load() {
    const all = await listSeries()
    setSeries(all)
    const sessions = (await listSessions())
      .filter((s) => s.etat === 'en_cours')
      .sort((a, b) => b.majLe - a.majLe)
    const items: EnCours[] = []
    for (const s of sessions) {
      const tome = await getTome(s.tomeId)
      const serie = tome && all.find((x) => x.id === tome.serieId)
      if (tome && serie) items.push({ tome, serie })
    }
    setEnCours(items)
  }

  useEffect(() => {
    load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!titre.trim()) return
    const serie = await createSerie(titre.trim())
    navigate({ kind: 'serie', serieId: serie.id })
  }

  return (
    <>
      <h1>Scan4reall</h1>

      {enCours.length > 0 && (
        <section>
          <h2>Reprendre</h2>
          <ul className="list">
            {enCours.map(({ tome, serie }) => (
              <li key={tome.id}>
                <button onClick={() => navigate({ kind: 'session', tomeId: tome.id })}>
                  {serie.titre} — Tome {tome.numero}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Séries</h2>
        {series.length === 0 ? (
          <p className="muted">Aucune série pour l'instant.</p>
        ) : (
          <ul className="list">
            {series.map((s) => (
              <li key={s.id}>
                <button onClick={() => navigate({ kind: 'serie', serieId: s.id })}>{s.titre}</button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={onCreate} className="row">
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre de la série" />
          <button type="submit" className="primary">Créer</button>
        </form>
      </section>
    </>
  )
}
