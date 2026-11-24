import { useState } from 'react'
import type { Tome } from './db'
import { pageFile, pageName, type Page } from './pages'

// ~75 MB of JPEG per batch: a whole Tome (~450 MB) at once risks Safari running out of memory.
// Batches are safe because the PWA matches OCR text to Pages by marker, not by file.
const LOT_SIZE = 50

type Props = { tome: Tome; pages: Page[] }

type Prepared = { lot: number; files: File[] }

export default function ExportView({ tome, pages }: Props) {
  const [prepared, setPrepared] = useState<Prepared>()
  const [progress, setProgress] = useState('')
  const [shared, setShared] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  // Off by default: on real Captures the filter made Apple's OCR silently drop lines, whereas
  // raw show-through only yields visible gibberish that the cleaning rules flag (OCR bench)
  const [nettoyer, setNettoyer] = useState(false)

  const lots = Array.from({ length: Math.ceil(pages.length / LOT_SIZE) }, (_, i) =>
    pages.slice(i * LOT_SIZE, (i + 1) * LOT_SIZE),
  )

  async function prepare(lot: number) {
    setError('')
    setPrepared(undefined)
    const files: File[] = []
    try {
      for (const [i, page] of lots[lot].entries()) {
        setProgress(`Préparation ${i + 1} / ${lots[lot].length}`)
        files.push(await pageFile(page, tome.numero, nettoyer))
      }
      setPrepared({ lot, files })
    } catch (err) {
      setError(`Préparation échouée : ${(err as Error).message}`)
    } finally {
      setProgress('')
    }
  }

  // Must run straight from a tap: iOS only opens the share sheet on a fresh user gesture
  async function share() {
    if (!prepared) return
    const { lot, files } = prepared
    if (!navigator.canShare?.({ files })) {
      setError('Le partage de fichiers n’est pas disponible sur cet appareil.')
      return
    }
    try {
      await navigator.share({ files })
      setShared((s) => new Set(s).add(lot))
      // Frees the JPEGs: the next batch needs the memory
      setPrepared(undefined)
    } catch (err) {
      // AbortError: share sheet dismissed, the batch stays ready
      if ((err as Error).name !== 'AbortError') setError(`Partage échoué : ${(err as Error).message}`)
    }
  }

  return (
    <div className="export">
      <h2>Envoyer au raccourci OCR</h2>
      <label className="toggle export-option">
        <input
          type="checkbox"
          checked={nettoyer}
          onChange={(e) => {
            setNettoyer(e.target.checked)
            setPrepared(undefined)
          }}
        />
        Nettoyer la transparence
      </label>
      <ul className="list">
        {lots.map((lot, i) => {
          const first = pageName(tome.numero, lot[0].rang)
          const last = pageName(tome.numero, lot.at(-1)!.rang)
          const isPrepared = prepared?.lot === i
          return (
            <li key={i} className="lot">
              <span>
                {lots.length > 1 && <strong>Lot {i + 1} · </strong>}
                {first} → {last}
                {shared.has(i) && <span className="muted small"> · envoyé</span>}
              </span>
              {isPrepared ? (
                <button className="primary" onClick={share}>Partager</button>
              ) : (
                <button onClick={() => prepare(i)} disabled={!!progress}>
                  {shared.has(i) ? 'Refaire' : 'Préparer'}
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {progress && <p className="muted small">{progress}</p>}
      {prepared && (
        <p className="muted small">
          {prepared.files.length} Pages prêtes : touche Partager, puis choisis le raccourci.
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
