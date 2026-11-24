import { useState, type ChangeEvent } from 'react'
import { saveTextes, type Tome } from './db'
import { attach, parseOcr, type ImportReport } from './ocrImport'
import type { Page } from './pages'

type Props = { tome: Tome; pages: Page[]; onImported: () => void }

export default function ImportView({ tome, pages, onImported }: Props) {
  const [report, setReport] = useState<ImportReport>()
  const [error, setError] = useState('')

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (files.length === 0) return
    setError('')
    try {
      // One file per exported batch: markers make their order irrelevant
      const entries = (await Promise.all(files.map((f) => f.text()))).flatMap(parseOcr)
      if (entries.length === 0) {
        setError('Aucun marqueur === T..-R.... === trouvé : est-ce bien le fichier du raccourci ?')
        return
      }
      const { textes, report } = attach(entries, tome, pages)
      await saveTextes(textes)
      setReport(report)
      onImported()
    } catch (err) {
      setError(`Import échoué : ${(err as Error).message}`)
    }
  }

  return (
    <div className="import">
      <h2>Importer le texte OCR</h2>
      <label className="file-button">
        Choisir le ou les fichiers .txt
        <input type="file" accept=".txt,text/plain" multiple onChange={onFiles} />
      </label>
      {report && (
        <p className="muted small">
          {report.importes} Page{report.importes > 1 ? 's' : ''} importée{report.importes > 1 ? 's' : ''}
          {report.vides > 0 && `, dont ${report.vides} sans texte`}
          {report.autreTome > 0 && ` · ${report.autreTome} ignorée(s) : autre tome`}
          {report.rangInconnu > 0 && ` · ${report.rangInconnu} ignorée(s) : Rang absent de ce tome`}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
