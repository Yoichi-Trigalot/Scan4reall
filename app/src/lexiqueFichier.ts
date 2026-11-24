// Backup of a Serie's Lexique: the hand validation work of a whole Serie, which only lives in the
// browser storage otherwise. A plain JSON file the user keeps in Files / iCloud Drive.

const FORMAT = 'scan4reall-lexique'

export function lexiqueVersJson(serie: string, mots: string[]): string {
  return JSON.stringify({ format: FORMAT, version: 1, serie, mots: [...mots].sort() }, null, 2)
}

/** Words of a backup file; throws on anything that isn't one. */
export function lexiqueDepuisJson(contenu: string): string[] {
  let data: unknown
  try {
    data = JSON.parse(contenu)
  } catch {
    throw new Error('Ce fichier n’est pas un Lexique Scan4reall (JSON illisible).')
  }
  const d = data as { format?: unknown; mots?: unknown }
  if (d.format !== FORMAT || !Array.isArray(d.mots) || !d.mots.every((m) => typeof m === 'string')) {
    throw new Error('Ce fichier n’est pas un Lexique Scan4reall.')
  }
  return d.mots.map((m: string) => m.trim()).filter(Boolean)
}
