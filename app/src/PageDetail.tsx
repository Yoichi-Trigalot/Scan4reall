import { useState } from 'react'
import { putTexte, type TexteBrut, type Tome } from './db'
import type { Connu, Nettoyage } from './nettoyage'
import PageImage from './PageImage'
import { pageName, type Page } from './pages'
import TexteView from './TexteView'
import type { Motif } from './verification'

const MOTIFS: Record<Motif, string> = {
  vide: 'OCR vide : page blanche, ou page entière manquée par l’OCR ?',
  illisible: 'Probablement du texte du verso vu par transparence.',
  courte: 'Bien plus courte que ses voisines : l’OCR a peut-être sauté des lignes, compare avec la photo.',
  suspects: 'Contient encore des Mots suspects.',
}

type Props = {
  tome: Tome
  page: Page
  texte: TexteBrut
  motifs: Motif[]
  nettoyage?: Nettoyage
  connu?: Connu
  onChange: () => void
  onBack: () => void
  onNext?: () => void
}

export default function PageDetail({ tome, page, texte, motifs, nettoyage, connu, onChange, onBack, onNext }: Props) {
  const [edition, setEdition] = useState<string>()

  async function enregistrer(t: TexteBrut) {
    await putTexte(t)
    onChange()
  }

  return (
    <>
      <button className="back" onClick={onBack}>‹ Vérification</button>
      <h1>{pageName(tome.numero, page.rang)}</h1>
      {motifs.map((m) => (
        <p key={m} className="warning small">{MOTIFS[m]}</p>
      ))}
      <PageImage page={page} />

      {edition === undefined ? (
        <TexteView rang={page.rang} texte={texte} nettoyage={nettoyage} connu={connu} />
      ) : (
        <div className="ocr-text">
          <p className="muted small">
            Texte brut de l’OCR, avant nettoyage : corrige ce qui diffère de la photo, sans rien reformuler.
          </p>
          <textarea className="edition" value={edition} onChange={(e) => setEdition(e.target.value)} />
          <div className="row">
            <button
              className="primary"
              onClick={async () => {
                // The OCR's original is kept once, at the first hand edit
                await enregistrer({ ...texte, texte: edition, texteOcr: texte.texteOcr ?? texte.texte })
                setEdition(undefined)
              }}
            >
              Enregistrer
            </button>
            <button onClick={() => setEdition(undefined)}>Annuler</button>
          </div>
        </div>
      )}

      <div className="actions">
        {edition === undefined && !texte.ignoree && (
          <button onClick={() => setEdition(texte.texte)}>Modifier le texte brut</button>
        )}
        {texte.texteOcr !== undefined && edition === undefined && (
          <button onClick={() => enregistrer({ ...texte, texte: texte.texteOcr!, texteOcr: undefined })}>
            Rétablir le texte de l’OCR
          </button>
        )}
        <button onClick={() => enregistrer({ ...texte, ignoree: !texte.ignoree })}>
          {texte.ignoree ? 'Réintégrer la Page' : 'Ignorer cette Page'}
        </button>
        {onNext && (
          <button className="primary" onClick={onNext}>
            Page à revoir suivante ›
          </button>
        )}
      </div>
    </>
  )
}
