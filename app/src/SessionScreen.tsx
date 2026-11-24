import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { OnDeleted, View } from './App'
import CaptureView from './CaptureView'
import {
  countCaptures,
  deleteCapture,
  deleteTome,
  getSerie,
  getTome,
  lastCapture,
  openSession,
  updateTome,
  type Capture,
  type Serie,
  type Session,
  type Tome,
} from './db'

type Props = { tomeId: string; navigate: (v: View) => void; onDeleted: OnDeleted }

export default function SessionScreen({ tomeId, navigate, onDeleted }: Props) {
  const [tome, setTome] = useState<Tome>()
  const [serie, setSerie] = useState<Serie>()
  const [session, setSession] = useState<Session>()
  const [numero, setNumero] = useState('')
  const [titre, setTitre] = useState('')
  const [erreur, setErreur] = useState('')
  const [nbCaptures, setNbCaptures] = useState(0)
  const [derniere, setDerniere] = useState<Capture>()
  const [apercu, setApercu] = useState('')

  const refreshCaptures = useCallback(async () => {
    setNbCaptures(await countCaptures(tomeId))
    setDerniere(await lastCapture(tomeId))
  }, [tomeId])

  useEffect(() => {
    refreshCaptures()
  }, [refreshCaptures])

  useEffect(() => {
    if (!derniere) return
    const url = URL.createObjectURL(derniere.blob)
    setApercu(url)
    return () => URL.revokeObjectURL(url)
  }, [derniere])

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
    const detail = nbCaptures > 0 ? ` et ses ${nbCaptures} Capture${nbCaptures > 1 ? 's' : ''}` : ''
    if (!confirm(`Supprimer le tome ${tome.numero}, sa Session${detail} ?`)) return
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

      <CaptureView tomeId={tomeId} onCaptured={refreshCaptures} />

      <section>
        <h2>
          {nbCaptures} Capture{nbCaptures > 1 ? 's' : ''}
        </h2>
        {derniere && (
          <figure className="last-capture">
            <img src={apercu} alt={`Dernière Capture, n° ${derniere.ordre}`} />
            <figcaption className="row">
              <span className="muted small">
                n° {derniere.ordre} · {derniere.largeur}×{derniere.hauteur} · {Math.round(derniere.blob.size / 1024)} Ko
              </span>
              <button
                className="danger-inline"
                onClick={async () => {
                  await deleteCapture(derniere.id)
                  await refreshCaptures()
                }}
              >
                Supprimer la dernière
              </button>
            </figcaption>
          </figure>
        )}
      </section>

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
