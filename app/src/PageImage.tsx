import { useEffect, useRef } from 'react'
import { renderRawPage, type Page } from './pages'

/** The Page's photo. Only the displayed Page is decoded: a whole Tome would not fit in memory. */
export default function PageImage({ page }: { page: Page }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    renderRawPage(page).then((source) => {
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

  return (
    <div className="page-viewer">
      <canvas ref={canvasRef} />
    </div>
  )
}
