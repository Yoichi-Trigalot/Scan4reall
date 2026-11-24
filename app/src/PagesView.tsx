import { useEffect, useRef, useState } from 'react'
import { listCaptures, type Tome } from './db'
import { pageName, pagesOf, renderPage, type Page } from './pages'

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
    renderPage(page).then((bitmap) => {
      const canvas = canvasRef.current
      if (cancelled || !canvas) return bitmap.close()
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d')!.drawImage(bitmap, 0, 0)
      bitmap.close()
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
    </section>
  )
}
