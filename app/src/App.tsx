import { useState } from 'react'
import Home from './Home'
import SerieScreen from './SerieScreen'
import SessionScreen from './SessionScreen'

export type View =
  | { kind: 'home' }
  | { kind: 'serie'; serieId: string }
  | { kind: 'session'; tomeId: string }

function App() {
  const [view, setView] = useState<View>({ kind: 'home' })

  return (
    <main>
      {view.kind === 'home' && <Home navigate={setView} />}
      {view.kind === 'serie' && <SerieScreen serieId={view.serieId} navigate={setView} />}
      {view.kind === 'session' && <SessionScreen tomeId={view.tomeId} navigate={setView} />}
    </main>
  )
}

export default App
