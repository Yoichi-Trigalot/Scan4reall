import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Asks the browser not to evict IndexedDB under storage pressure: Captures and the Lexique live
// only there. Best effort, the browser may refuse; the Lexique backup covers that case.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
