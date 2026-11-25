import { useState } from 'react'
import { putTexte, type Tome } from './db'
import ExportView from './ExportView'
import ImportView from './ImportView'
import PageImage from './PageImage'
import { pageName } from './pages'
import TexteView from './TexteView'
import { texteValide, useTexteTome } from './useTexteTome'

// `nbCaptures` only serves to reload when Captures are added or removed
type Props = { tome: Tome; nbCaptures: number }

export default function PagesView({ tome, nbCaptures }: Props) {
  const { pages, textes, connu, nettoyage, erreurDico, recharger } = useTexteTome(tome, nbCaptures)
  const [index, setIndex] = useState(0)

  if (pages.length === 0) return null

  const i = Math.min(index, pages.length - 1)
  const page = pages[i]
  const texte = textes.get(page.rang)
  const nbAvecTexte = pages.filter((p) => texteValide(textes.get(p.rang), p)).length

  return (
    <section>
      <h2>
        {pages.length} Pages · {pageName(tome.numero, 1)} → {pageName(tome.numero, pages.length)}
      </h2>
      <PageImage page={page} />
      <div className="row page-nav">
        <button onClick={() => setIndex(i - 1)} disabled={i === 0} aria-label="Page précédente">
          ‹
        </button>
        <span>
          <strong>{pageName(tome.numero, page.rang)}</strong>
          <span className="muted small">
            {' '}
            · {page.cote} de la Capture n° {page.capture.ordre}
          </span>
        </span>
        <button onClick={() => setIndex(i + 1)} disabled={i === pages.length - 1} aria-label="Page suivante">
          ›
        </button>
      </div>

      <div className="ocr-text">
        {!texte && <p className="muted small">Pas encore de texte OCR pour cette Page.</p>}
        {texte && !texteValide(texte, page) && (
          <p className="error small">
            Les Captures ont changé depuis l’import : ce texte appartenait à une autre Page. Réexporte et
            réimporte ce lot.
          </p>
        )}
        {texteValide(texte, page) && (
          <>
            <TexteView rang={page.rang} texte={texte} nettoyage={nettoyage} connu={connu} />
            {/* Ignored Pages drop out of the verification lists: this viewer is the only way back to them */}
            <button
              onClick={async () => {
                await putTexte({ ...texte, ignoree: !texte.ignoree })
                await recharger()
              }}
            >
              {texte.ignoree ? 'Réintégrer la Page' : 'Ignorer cette Page'}
            </button>
          </>
        )}
        {erreurDico && <p className="error small">{erreurDico} : Mots suspects non calculés.</p>}
      </div>
      {textes.size > 0 && (
        <p className="muted small">
          {nbAvecTexte} / {pages.length} Pages ont leur texte OCR.
        </p>
      )}

      {/* Keyed on the count: adding or removing a Capture discards a stale prepared batch */}
      <ExportView key={pages.length} tome={tome} pages={pages} />
      <ImportView tome={tome} pages={pages} textes={textes} onImported={recharger} />
    </section>
  )
}
