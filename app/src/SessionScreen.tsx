import { useEffect, useState, type FormEvent } from 'react'
import type { OnDeleted, View } from './App'
import { deleteTome, getSerie, getTome, openSession, updateTome, type Serie, type Session, type Tome } from './db'

type Props = { tomeId: string; navigate: (v: View) => void; onDeleted: OnDeleted }

export default function SessionScreen({ tomeId, navigate, onDeleted }: Props) {
  const [tome, setTome] = useState<Tome>()
  const [serie, setSerie] = useState<Serie>()
  const [session, setSession] = useState<Session>()
  const [numero, setNumero] = useState('')
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    ;(async () => {
      const t = await getTome(tomeId)
      if (!t) return
      setTome(t)
      setNumero(String(t.numero))
      setTitre(t.titre)
      setSerie(await getSerie(t.serieId))
      // Opening the screen counts as resuming: bumps majLe so it tops the "Reprendre" list
      setSession(await openSession(tomeId))
    })()
  }, [tomeId])

  if (!tome || !serie || !session) return null

  async function onUpdate(e: FormEvent) {
    e.preventDefault()
    const n = Number(numero)
    if (!Number.isInteger(n) || n < 1) {
      setErreur('Le numéro doit être un entier positif.')
      return
    }
    try {
      await updateTome(tomeId, n, titre.trim())
      setTome(await getTome(tomeId))
      setErreur('')
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  async function onDelete() {
    if (!tome || !serie) return
    if (!confirm(`Supprimer le tome ${tome.numero} et sa Session ?`)) return
    const snapshot = await deleteTome(tomeId)
    onDeleted(`Tome ${tome.numero} supprimé`, snapshot, { kind: 'session', tomeId })
    navigate({ kind: 'serie', serieId: serie.id })
  }

  const unchanged = numero === String(tome.numero) && titre.trim() === tome.titre

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

      <section>
        <h2>Modifier le tome</h2>
        <form onSubmit={onUpdate} className="row">
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            inputMode="numeric"
            aria-label="Numéro du tome"
            className="narrow"
          />
          <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre (facultatif)" />
          <button type="submit" className="primary" disabled={unchanged}>Enregistrer</button>
        </form>
        {erreur && <p className="error">{erreur}</p>}
        <button className="danger" onClick={onDelete}>Supprimer le tome</button>
      </section>
    </>
  )
}
