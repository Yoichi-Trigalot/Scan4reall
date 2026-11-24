import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { listCaptures, listTextes, type TexteBrut, type Tome } from './db'
import { chargerDictionnaire } from './dictionnaire'
import ExportView from './ExportView'
import ImportView from './ImportView'
import { nettoyer, type Connu } from './nettoyage'
import TexteView from './TexteView'
import { pageName, pagesOf, renderRawPage, type Page } from './pages'

// `nbCaptures` only serves to reload when Captures are added or removed
type Props = { tome: Tome; nbCaptures: number }

export default function PagesView({ tome, nbCaptures }: Props) {
  const [pages, setPages] = useState<Page[]>([])
  const [index, setIndex] = useState(0)
  const [textes, setTextes] = useState<Map<number, TexteBrut>>(new Map())
  const [connu, setConnu] = useState<Connu>()
  const [erreurDico, setErreurDico] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    chargerDictionnaire()
      // Wrapped: a function passed to setState would be called as an updater
      .then((dico) => setConnu(() => (mot: string) => dico.has(mot)))
      .catch((err: Error) => setErreurDico(err.message))
  }, [])

  // Cleaning runs over the whole Tome: paragraphs and split words cross page breaks
  const nettoyage = useMemo(() => {
    if (!connu) return undefined
    const valides = pages.flatMap((p) => {
      const t = textes.get(p.rang)
      return t && t.captureId === p.capture.id && t.cote === p.cote ? [{ rang: p.rang, texte: t.texte }] : []
    })
    return nettoyer(valides, connu)
  }, [connu, pages, textes])

  const loadTextes = useCallback(async () => {
    setTextes(new Map((await listTextes(tome.id)).map((t) => [t.rang, t])))
  }, [tome.id])

  useEffect(() => {
    loadTextes()
  }, [loadTextes])

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

  if (pages.length === 0) return null

  const texte = textes.get(page.rang)
  // The Rang was attached to another Capture at import: Captures changed since, Rangs shifted
  const decale = texte && (texte.captureId !== page.capture.id || texte.cote !== page.cote)
  const nbAvecTexte = pages.filter((p) => {
    const t = textes.get(p.rang)
    return t && t.captureId === p.capture.id && t.cote === p.cote
  }).length

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

      <div className="ocr-text">
        {!texte && <p className="muted small">Pas encore de texte OCR pour cette Page.</p>}
        {texte && decale && (
          <p className="error small">
            Les Captures ont changé depuis l’import : ce texte appartenait à une autre Page. Réexporte et
            réimporte ce lot.
          </p>
        )}
        {texte && !decale && <TexteView rang={page.rang} texte={texte} nettoyage={nettoyage} connu={connu} />}
        {erreurDico && <p className="error small">{erreurDico} : Mots suspects non calculés.</p>}
      </div>
      {textes.size > 0 && (
        <p className="muted small">
          {nbAvecTexte} / {pages.length} Pages ont leur texte OCR.
        </p>
      )}

      {/* Keyed on the count: adding or removing a Capture discards a stale prepared batch */}
      <ExportView key={pages.length} tome={tome} pages={pages} />
      <ImportView tome={tome} pages={pages} onImported={loadTextes} />
    </section>
  )
}
