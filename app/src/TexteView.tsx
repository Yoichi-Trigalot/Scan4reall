import { useState } from 'react'
import type { TexteBrut } from './db'
import { estSuspect, pageIllisible, type Connu, type Nettoyage } from './nettoyage'

type Props = { rang: number; texte: TexteBrut; nettoyage?: Nettoyage; connu?: Connu }

export default function TexteView({ rang, texte, nettoyage, connu }: Props) {
  const [brut, setBrut] = useState(false)

  if (texte.ignoree) return <p className="muted small">Page ignorée : exclue du texte et de l’EPUB.</p>
  if (!texte.texte) return <p className="muted small">OCR vide.</p>

  // Paragraphs touching this Page, reduced to the part printed on it
  const paragraphes = (nettoyage?.paragraphes ?? [])
    .filter((p) => p.some((s) => s.rang === rang))
    .map((p) => ({
      texte: p
        .filter((s) => s.rang === rang)
        .map((s) => s.texte)
        .join(' '),
      suite: p[0].rang !== rang,
      continue: p[p.length - 1].rang !== rang,
    }))
  const folio = nettoyage?.folios.get(rang)
  const nbSuspects = connu
    ? paragraphes.reduce((n, p) => n + (p.texte.match(/[\p{L}\p{N}’'-]+/gu) ?? []).filter((t) => estSuspect(t, connu)).length, 0)
    : 0

  return (
    <div className="ocr-text">
      <div className="row texte-entete">
        <span className="muted small">
          {folio ? `Folio ${folio}` : 'Pas de folio'}
          {connu && !brut && ` · ${nbSuspects} Mot${nbSuspects > 1 ? 's' : ''} suspect${nbSuspects > 1 ? 's' : ''}`}
        </span>
        <button className="link small" onClick={() => setBrut(!brut)}>
          {brut ? 'Voir le texte nettoyé' : 'Voir le texte brut'}
        </button>
      </div>
      {connu && pageIllisible(texte.texte, connu) && (
        <p className="warning small">
          Page probablement illisible (texte du verso vu par transparence ?) : à ignorer lors de la vérification.
        </p>
      )}
      {brut || !nettoyage ? (
        <pre>{texte.texte}</pre>
      ) : (
        <div className="nettoye">
          {paragraphes.map((p, i) => (
            <p key={i}>
              {p.suite && <span className="muted">… </span>}
              <Surligne texte={p.texte} connu={connu} />
              {p.continue && <span className="muted"> …</span>}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function Surligne({ texte, connu }: { texte: string; connu?: Connu }) {
  if (!connu) return <>{texte}</>
  // Odd indexes are words, even ones the spaces and punctuation between them
  return (
    <>
      {texte.split(/([\p{L}\p{N}’'-]+)/u).map((part, i) =>
        i % 2 === 1 && estSuspect(part, connu) ? <mark key={i}>{part}</mark> : part,
      )}
    </>
  )
}
