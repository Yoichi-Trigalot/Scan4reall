import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { ajouterAuLexique, getLexique, type Serie } from './db'
import { lexiqueDepuisJson, lexiqueVersJson } from './lexiqueFichier'

export default function LexiqueSection({ serie }: { serie: Serie }) {
  const [mots, setMots] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [lien, setLien] = useState<{ url: string; nom: string }>()

  const charger = useCallback(async () => setMots((await getLexique(serie.id)).mots), [serie.id])

  useEffect(() => {
    charger()
  }, [charger])

  useEffect(() => () => (lien ? URL.revokeObjectURL(lien.url) : undefined), [lien])

  async function exporter() {
    setErreur('')
    const nom = `Lexique - ${serie.titre.replace(/[\\/:*?"<>|]/g, '')}.json`
    const fichier = new File([lexiqueVersJson(serie.titre, mots)], nom, { type: 'application/json' })
    if (!navigator.canShare?.({ files: [fichier] })) {
      setLien({ url: URL.createObjectURL(fichier), nom })
      return
    }
    try {
      await navigator.share({ files: [fichier] })
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setErreur(`Partage échoué : ${(err as Error).message}`)
    }
  }

  async function importer(e: ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    e.target.value = ''
    if (!fichier) return
    setErreur('')
    try {
      const importes = lexiqueDepuisJson(await fichier.text())
      const avant = new Set(mots)
      // Merge only: an import never removes a word validated since the backup
      await ajouterAuLexique(serie.id, importes)
      await charger()
      const nouveaux = importes.filter((m) => !avant.has(m)).length
      setMessage(`${nouveaux} mot${nouveaux > 1 ? 's' : ''} ajouté${nouveaux > 1 ? 's' : ''}, ${importes.length - nouveaux} déjà présent${importes.length - nouveaux > 1 ? 's' : ''}.`)
    } catch (err) {
      setErreur((err as Error).message)
    }
  }

  return (
    <section>
      <h2>Lexique · {mots.length} mots</h2>
      <p className="muted small">
        Les noms validés pour toute la série. Sauvegarde-le dans Fichiers ou iCloud Drive : il ne vit sinon que dans
        cet iPhone.
      </p>
      <div className="actions">
        <button onClick={exporter} disabled={mots.length === 0}>
          Sauvegarder le Lexique
        </button>
        <label className="file-button secondary">
          Restaurer depuis un fichier
          <input type="file" accept=".json,application/json" onChange={importer} />
        </label>
      </div>
      {lien && (
        <p className="small">
          <a href={lien.url} download={lien.nom}>
            Télécharger {lien.nom}
          </a>
        </p>
      )}
      {message && <p className="muted small">{message}</p>}
      {erreur && <p className="error">{erreur}</p>}
    </section>
  )
}
