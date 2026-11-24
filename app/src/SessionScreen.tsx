import { useEffect, useState } from 'react'
import type { View } from './App'
import { getSerie, getTome, openSession, type Serie, type Session, type Tome } from './db'

type Props = { tomeId: string; navigate: (v: View) => void }

export default function SessionScreen({ tomeId, navigate }: Props) {
  const [tome, setTome] = useState<Tome>()
  const [serie, setSerie] = useState<Serie>()
  const [session, setSession] = useState<Session>()

  useEffect(() => {
    ;(async () => {
      const t = await getTome(tomeId)
      if (!t) return
      setTome(t)
      setSerie(await getSerie(t.serieId))
      // Opening the screen counts as resuming: bumps majLe so it tops the "Reprendre" list
      setSession(await openSession(tomeId))
    })()
  }, [tomeId])

  if (!tome || !serie || !session) return null

  return (
    <>
      <button className="back" onClick={() => navigate({ kind: 'serie', serieId: serie.id })}>
        ‹ {serie.titre}
      </button>
      <h1>Tome {tome.numero}</h1>
      {tome.titre && <p>{tome.titre}</p>}
      <p className="muted">
        Session démarrée le {new Date(session.demarreeLe).toLocaleString('fr-FR')}
      </p>
      <p className="muted">La capture arrive à la tâche 3.</p>
    </>
  )
}
