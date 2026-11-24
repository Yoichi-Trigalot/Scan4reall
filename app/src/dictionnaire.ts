// French word forms from Lexique 4.10 (public/dict, CC BY-SA 4.0), loaded once per app session
let dico: Promise<Set<string>> | undefined

export function chargerDictionnaire(): Promise<Set<string>> {
  dico ??= fetch('/dict/fr-lexique410.txt')
    .then((r) => {
      if (!r.ok) throw new Error(`Dictionnaire indisponible (${r.status})`)
      return r.text()
    })
    .then((t) => new Set(t.split('\n')))
  return dico
}
