import { useEffect, useMemo, useState } from 'react'
import type { View } from './App'
import {
  addCorrection,
  ajouterAuLexique,
  deleteCorrection,
  getSerie,
  getTome,
  retirerDuLexique,
  type Serie,
  type Tome,
} from './db'
import { motPourLexique } from './nettoyage'
import { fusionner, suggererChapitres } from './chapitres'
import ChapitresSection from './ChapitresSection'
import EpubView from './EpubView'
import PageDetail from './PageDetail'
import { pageName } from './pages'
import { texteValide, useTexteTome } from './useTexteTome'
import { listerSuspects, nomPropreProbable, pagesARevoir, type MotSuspect, type Occurrence } from './verification'

type Props = { tomeId: string; navigate: (v: View) => void }

export default function VerificationScreen({ tomeId, navigate }: Props) {
  const [tome, setTome] = useState<Tome>()
  const [serie, setSerie] = useState<Serie>()

  useEffect(() => {
    ;(async () => {
      const t = await getTome(tomeId)
      if (!t) return
      setTome(t)
      setSerie(await getSerie(t.serieId))
    })()
  }, [tomeId])

  if (!tome || !serie) return null
  return <Verification tome={tome} serie={serie} navigate={navigate} />
}

// Long Tomes have hundreds of distinct suspects: show the frequent ones first, then on demand
const PAR_TRANCHE = 40

function Verification({ tome, serie, navigate }: { tome: Tome; serie: Serie; navigate: (v: View) => void }) {
  const { pages, textes, lexique, corrections, chapitres, connu, nettoyage, recharger } = useTexteTome(tome)
  const [detail, setDetail] = useState<number>()
  const [visibles, setVisibles] = useState(PAR_TRANCHE)
  // Suspects checked for bulk validation into the Lexique, by key
  const [selection, setSelection] = useState<Set<string>>(new Set())

  const vuesChapitres = useMemo(
    () => (nettoyage ? fusionner(suggererChapitres(nettoyage), chapitres) : []),
    [nettoyage, chapitres],
  )
  const suspects = useMemo(() => (nettoyage && connu ? listerSuspects(nettoyage, connu) : []), [nettoyage, connu])
  const aRevoir = useMemo(() => {
    if (!nettoyage || !connu) return []
    const pagesTexte = pages.flatMap((p) => {
      const t = textes.get(p.rang)
      return texteValide(t, p) ? [{ rang: p.rang, brut: t.texte, ignoree: !!t.ignoree }] : []
    })
    return pagesARevoir(pagesTexte, nettoyage, connu)
  }, [pages, textes, nettoyage, connu])

  const pageDetail = detail !== undefined ? pages.find((p) => p.rang === detail) : undefined
  const texteDetail = pageDetail && textes.get(pageDetail.rang)
  if (pageDetail && texteValide(texteDetail, pageDetail)) {
    const suivante = aRevoir.find((p) => p.rang > pageDetail.rang)
    return (
      <PageDetail
        tome={tome}
        page={pageDetail}
        texte={texteDetail}
        motifs={aRevoir.find((p) => p.rang === pageDetail.rang)?.motifs ?? []}
        nettoyage={nettoyage}
        connu={connu}
        onChange={recharger}
        onBack={() => setDetail(undefined)}
        onNext={suivante && (() => setDetail(suivante.rang))}
      />
    )
  }

  const nbOccurrences = suspects.reduce((n, s) => n + s.occurrences.length, 0)
  const nomsProbables = suspects.filter(nomPropreProbable)
  const selectionnes = suspects.filter((s) => selection.has(s.cle))

  async function validerSelection() {
    await ajouterAuLexique(serie.id, selectionnes.map((s) => motPourLexique(s.forme)))
    setSelection(new Set())
    await recharger()
  }

  return (
    <>
      <button className="back" onClick={() => navigate({ kind: 'session', tomeId: tome.id })}>
        ‹ Tome {tome.numero}
      </button>
      <h1>Vérification</h1>
      {!connu && <p className="muted">Chargement du dictionnaire…</p>}

      <section>
        <h2>
          {suspects.length} Mots suspects · {nbOccurrences} occurrences
        </h2>
        {suspects.length === 0 && connu && <p className="muted">Aucun Mot suspect.</p>}
        {suspects.length > 0 && (
          <div className="row selection">
            {nomsProbables.length > 0 && (
              <button
                className="link small"
                onClick={() => setSelection(new Set([...selection, ...nomsProbables.map((s) => s.cle)]))}
              >
                Cocher les noms propres probables ({nomsProbables.length})
              </button>
            )}
            {selectionnes.length > 0 && (
              <>
                <button className="primary" onClick={validerSelection}>
                  Valider la sélection ({selectionnes.length})
                </button>
                <button className="link small" onClick={() => setSelection(new Set())}>
                  Tout décocher
                </button>
              </>
            )}
          </div>
        )}
        <ul className="list suspects">
          {suspects.slice(0, visibles).map((s) => (
            <SuspectItem
              key={s.cle}
              suspect={s}
              tomeNumero={tome.numero}
              coche={selection.has(s.cle)}
              onCocher={() => {
                const suivante = new Set(selection)
                if (!suivante.delete(s.cle)) suivante.add(s.cle)
                setSelection(suivante)
              }}
              onValider={async () => {
                await ajouterAuLexique(serie.id, [motPourLexique(s.forme)])
                await recharger()
              }}
              onCorriger={async (vers, o) => {
                // Suspects are grouped case-insensitively: everywhere means every spelling (Ikeda, IKEDA)
                for (const de of o ? [o.forme] : s.formes) await addCorrection({ tomeId: tome.id, de, vers, rang: o?.rang })
                await recharger()
              }}
              onPage={setDetail}
            />
          ))}
        </ul>
        {suspects.length > visibles && (
          <button className="link" onClick={() => setVisibles(visibles + PAR_TRANCHE)}>
            Voir les {Math.min(PAR_TRANCHE, suspects.length - visibles)} suivants
          </button>
        )}
      </section>

      <ChapitresSection tome={tome} vues={vuesChapitres} onPage={setDetail} onChange={recharger} />

      <section>
        <h2>{aRevoir.length} Pages à revoir</h2>
        {aRevoir.length === 0 && connu && <p className="muted">Rien à revoir.</p>}
        <ul className="list">
          {aRevoir.map((p) => (
            <li key={p.rang}>
              <button onClick={() => setDetail(p.rang)}>
                {pageName(tome.numero, p.rang)}
                <span className="muted small">
                  {p.motifs
                    .map((m) => (m === 'suspects' ? `${p.nbSuspects} suspect${p.nbSuspects > 1 ? 's' : ''}` : m))
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <EpubView serie={serie} tome={tome} nettoyage={nettoyage} chapitres={vuesChapitres} nbARevoir={aRevoir.length} />

      <details className="settings">
        <summary>Lexique de la série · {lexique.size} mots</summary>
        <ul className="mots">
          {[...lexique].sort().map((m) => (
            <li key={m}>
              {m}
              <button
                aria-label={`Retirer ${m} du Lexique`}
                onClick={async () => {
                  await retirerDuLexique(serie.id, m)
                  await recharger()
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </details>

      <details className="settings">
        <summary>Corrections du tome · {corrections.length}</summary>
        <ul className="mots">
          {corrections.map((c) => (
            <li key={c.id}>
              {c.de} → {c.vers}
              {c.rang !== undefined && <span className="muted small"> ({pageName(tome.numero, c.rang)})</span>}
              <button
                aria-label="Supprimer la correction"
                onClick={async () => {
                  await deleteCorrection(c.id)
                  await recharger()
                }}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </details>
    </>
  )
}

type ItemProps = {
  suspect: MotSuspect
  tomeNumero: number
  coche: boolean
  onCocher: () => void
  onValider: () => void
  onCorriger: (vers: string, occurrence?: Occurrence) => void
  onPage: (rang: number) => void
}

function SuspectItem({ suspect, tomeNumero, coche, onCocher, onValider, onCorriger, onPage }: ItemProps) {
  const [ouvert, setOuvert] = useState(false)
  // Correction being typed: for the whole Tome (rang undefined) or for one occurrence's Page
  const [correction, setCorrection] = useState<{ vers: string; rang?: number }>()

  const formulaire = (o?: Occurrence) =>
    correction && correction.rang === o?.rang ? (
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault()
          if (correction.vers.trim() && correction.vers !== (o?.forme ?? suspect.forme)) onCorriger(correction.vers.trim(), o)
          setCorrection(undefined)
        }}
      >
        <input autoFocus value={correction.vers} onChange={(e) => setCorrection({ vers: e.target.value, rang: o?.rang })} />
        <button type="submit" className="primary">
          {o === undefined ? 'Partout' : 'Ici'}
        </button>
      </form>
    ) : null

  return (
    <li className="suspect">
      <div className="row suspect-ligne">
        <input type="checkbox" checked={coche} onChange={onCocher} aria-label={`Cocher ${suspect.forme}`} />
        <button className="suspect-mot" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}>
          <mark>{suspect.forme}</mark>
          <span className="muted small"> ×{suspect.occurrences.length}</span>
        </button>
        <button className="link" onClick={onValider}>Valider</button>
        <button className="link" onClick={() => setCorrection({ vers: suspect.forme })}>Corriger</button>
      </div>
      {formulaire(undefined)}
      {ouvert && (
        <ul className="occurrences">
          {suspect.occurrences.map((o, i) => (
            <li key={i}>
              <p className="small">{o.contexte}</p>
              <div className="row">
                <button className="link small" onClick={() => onPage(o.rang)}>
                  {pageName(tomeNumero, o.rang)}
                </button>
                <button className="link small" onClick={() => setCorrection({ vers: o.forme, rang: o.rang })}>
                  Corriger ici
                </button>
              </div>
              {formulaire(o)}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
