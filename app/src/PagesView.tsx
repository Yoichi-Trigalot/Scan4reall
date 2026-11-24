import { useEffect, useRef, useState } from 'react'
import { listCaptures, type Tome } from './db'
import ExportView from './ExportView'
import { pageName, pagesOf, renderCleanPage, type Page } from './pages'

// `nbCaptures` only serves to reload when Captures are added or removed
type Props = { tome: Tome; nbCaptures: number }

export default function PagesView({ tome, nbCaptures }: Props) {
  const [pages, setPages] = useState<Page[]>([])
  const [index, setIndex] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    listCaptures(tome.id).then((captures) => {
      const all = pagesOf(captures)
      setPages(all)
      setIndex((i) => Math.min(i, Math.max(0, all.length - 1)))
    })
  }, [tome.id, nbCaptures])

  const page = pages[index]

  // Only the displayed Page is decoded: a whole Tome would not fit in memory
  useEffect(() => {
    if (!page) return
    let cancelled = false
    // Shows what the OCR will receive, show-through already removed
    renderCleanPage(page).then((source) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return
      canvas.width = source.width
      canvas.height = source.height
      canvas.getContext('2d')!.drawImage(source, 0, 0)
    })
    return () => {
      cancelled = true
    }
  }, [page])

  if (pages.length === 0) return null

  return (
    <section>
      <h2>
        {pages.length} Pages · {pageName(tome.numero, 1)} → {pageName(tome.numero, pages.length)}
      </h2>
      <div className="page-viewer">
        <canvas ref={canvasRef} />
      </div>
      <div className="row page-nav">
        <button onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label="Page précédente">
          ‹
        </button>
        <span>
          <strong>{pageName(tome.numero, page.rang)}</strong>
          <span className="muted small">
            {' '}
            · {page.cote} de la Capture n° {page.capture.ordre}
          </span>
        </span>
        <button
          onClick={() => setIndex(index + 1)}
          disabled={index === pages.length - 1}
          aria-label="Page suivante"
        >
          ›
        </button>
      </div>

      {/* Keyed on the count: adding or removing a Capture discards a stale prepared batch */}
      <ExportView key={pages.length} tome={tome} pages={pages} />
    </section>
  )
}
