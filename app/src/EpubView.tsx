import { useEffect, useState } from 'react'
import type { ChapitreVue } from './chapitres'
import type { Serie, Tome } from './db'
import { completerFolios, construireEpub, planEpub, titreLivre } from './epub'
import type { Nettoyage } from './nettoyage'

type Props = { serie: Serie; tome: Tome; nettoyage?: Nettoyage; chapitres: ChapitreVue[]; nbARevoir: number }

export default function EpubView({ serie, tome, nettoyage, chapitres, nbARevoir }: Props) {
  const [fichier, setFichier] = useState<File>()
  const [lien, setLien] = useState('')
  const [erreur, setErreur] = useState('')

  // A prepared file no longer matches once the text or chapters change
  useEffect(() => {
    setFichier(undefined)
    setLien('')
  }, [nettoyage, chapitres])

  useEffect(() => () => URL.revokeObjectURL(lien), [lien])

  const aConfirmer = chapitres.filter((c) => c.statut === 'suggere').length
  const confirmes = chapitres.filter((c) => c.statut === 'confirme').length

  async function preparer() {
    if (!nettoyage) return
    setErreur('')
    try {
      const rangs = [...new Set(nettoyage.paragraphes.flatMap((p) => p.map((s) => s.rang)))]
      const plan = planEpub(nettoyage, chapitres, completerFolios(nettoyage.folios, rangs))
      const octets = await construireEpub(serie, tome, plan)
      const nom = `${titreLivre(serie, tome).replace(/[\\/:*?"<>|]/g, '')}.epub`
      setFichier(new File([octets as BlobPart], nom, { type: 'application/epub+zip' }))
    } catch (err) {
      setErreur(`Génération échouée : ${(err as Error).message}`)
    }
  }

  // Must run straight from a tap: iOS only opens the share sheet on a fresh user gesture
  async function partager() {
    if (!fichier) return
    if (!navigator.canShare?.({ files: [fichier] })) {
      // Some systems refuse to share .epub: fall back to a plain download
      setLien(URL.createObjectURL(fichier))
      return
    }
    try {
      await navigator.share({ files: [fichier] })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setErreur(`Partage échoué : ${(err as Error).message}`)
    }
  }

  return (
    <section>
      <h2>EPUB</h2>
      {confirmes === 0 && (
        <p className="warning small">
          Aucun chapitre confirmé : le livre sera d’un seul tenant, sans table des matières, pages liminaires comprises.
        </p>
      )}
      {aConfirmer > 0 && (
        <p className="warning small">
          {aConfirmer} titre{aConfirmer > 1 ? 's' : ''} à confirmer : non confirmés, ils restent du texte et ne sont pas
          dans la table des matières.
        </p>
      )}
      {nbARevoir > 0 && (
        <p className="muted small">
          {nbARevoir} Page{nbARevoir > 1 ? 's' : ''} à revoir : tu peux générer quand même et régénérer plus tard.
        </p>
      )}
      <div className="actions">
        {!fichier ? (
          <button className="primary" onClick={preparer} disabled={!nettoyage}>
            Préparer l’EPUB
          </button>
        ) : (
          <button className="primary" onClick={partager}>
            Partager « {fichier.name} »
          </button>
        )}
      </div>
      {lien && fichier && (
        <p className="small">
          <a href={lien} download={fichier.name}>
            Télécharger {fichier.name}
          </a>
        </p>
      )}
      {erreur && <p className="error">{erreur}</p>}
    </section>
  )
}
