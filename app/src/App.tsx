import { useEffect, useState } from 'react'
import { restoreSnapshot, type Snapshot } from './db'
import Home from './Home'
import SerieScreen from './SerieScreen'
import SessionScreen from './SessionScreen'
import VerificationScreen from './VerificationScreen'

export type View =
  | { kind: 'home' }
  | { kind: 'serie'; serieId: string }
  | { kind: 'session'; tomeId: string }
  | { kind: 'verification'; tomeId: string }

/** Called after a deletion: shows the undo banner, `back` is where undo returns to. */
export type OnDeleted = (message: string, snapshot: Snapshot, back: View) => void

type Undo = { message: string; snapshot: Snapshot; back: View }

const UNDO_MS = 10_000

function App() {
  const [view, setView] = useState<View>({ kind: 'home' })
  const [undo, setUndo] = useState<Undo>()
  // Bumped after a restore so screens remount and reload from IndexedDB
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    if (!undo) return
    const timer = setTimeout(() => setUndo(undefined), UNDO_MS)
    return () => clearTimeout(timer)
  }, [undo])

  const onDeleted: OnDeleted = (message, snapshot, back) => setUndo({ message, snapshot, back })

  async function onUndo() {
    if (!undo) return
    await restoreSnapshot(undo.snapshot)
    setUndo(undefined)
    setView(undo.back)
    setEpoch((e) => e + 1)
  }

  return (
    <main key={epoch}>
      {view.kind === 'home' && <Home navigate={setView} />}
      {view.kind === 'serie' && <SerieScreen serieId={view.serieId} navigate={setView} onDeleted={onDeleted} />}
      {view.kind === 'session' && <SessionScreen tomeId={view.tomeId} navigate={setView} onDeleted={onDeleted} />}
      {view.kind === 'verification' && <VerificationScreen tomeId={view.tomeId} navigate={setView} />}

      {undo && (
        <div className="toast" role="status">
          <span>{undo.message}</span>
          <button onClick={onUndo}>Annuler</button>
        </div>
      )}
    </main>
  )
}

export default App
