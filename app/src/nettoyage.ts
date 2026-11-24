// Deterministic cleaning of the raw OCR text. Requirement #1: never change a word's meaning.
// Allowed: rejoin words split by a line-end hyphen, rebuild paragraphs, set the folio aside,
// normalize French typography. Anything else that looks wrong is only flagged (Mot suspect).

/** Is this lowercase word a known form? French dictionary + the Serie's Lexique. */
export type Connu = (mot: string) => boolean

export type PageOcr = { rang: number; texte: string }

/** A piece of a paragraph lying on one Page: a paragraph can span a page break. */
export type Segment = { rang: number; texte: string }

export type Nettoyage = {
  paragraphes: Segment[][]
  // Printed page number, kept out of the reading flow but not lost
  folios: Map<number, string>
}

const FOLIO = /^\d{1,4}$/
// A line ending this way closes its paragraph (Q30)
const FIN_PARAGRAPHE = /[.!?…»:]$/
const COUPURE_FIN = /(\p{L}+)-$/u
const DEBUT_MOT = /^(\p{L}+)/u

/**
 * Hyphen between two word parts (Q11): rejoin only when the joined word is known. Otherwise the
 * hyphen stays: a real compound (peut-être) or an unknown word, which then shows as suspect.
 */
export function recoller(gauche: string, droite: string, connu: Connu): boolean {
  return connu((gauche + droite).toLowerCase())
}

export function nettoyer(pages: PageOcr[], connu: Connu): Nettoyage {
  const folios = new Map<number, string>()
  const lignes: Segment[] = []
  for (const page of pages) {
    const ls = page.texte
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (ls.length > 0 && FOLIO.test(ls[0])) folios.set(page.rang, ls.shift()!)
    else if (ls.length > 0 && FOLIO.test(ls[ls.length - 1])) folios.set(page.rang, ls.pop()!)
    for (const texte of ls) lignes.push({ rang: page.rang, texte })
  }

  const paragraphes: Segment[][] = []
  let courant: Segment[] = []
  for (const ligne of lignes) {
    let reste = ligne.texte
    const dernier = courant[courant.length - 1]
    if (!dernier) {
      courant.push({ rang: ligne.rang, texte: reste })
    } else {
      const coupure = COUPURE_FIN.exec(dernier.texte)
      const debut = DEBUT_MOT.exec(reste)
      if (coupure && debut) {
        // Word split at the end of a line or page: the whole word stays where it started
        const joint = recoller(coupure[1], debut[1], connu)
        dernier.texte = (joint ? dernier.texte.slice(0, -1) : dernier.texte) + debut[1]
        reste = reste.slice(debut[1].length).trimStart()
        if (reste) {
          if (ligne.rang === dernier.rang) dernier.texte += (/^[,.;:!?)»]/.test(reste) ? '' : ' ') + reste
          else courant.push({ rang: ligne.rang, texte: reste })
        }
      } else if (ligne.rang === dernier.rang) {
        dernier.texte += ' ' + reste
      } else {
        courant.push({ rang: ligne.rang, texte: reste })
      }
    }
    if (FIN_PARAGRAPHE.test(ligne.texte)) {
      paragraphes.push(courant)
      courant = []
    }
  }
  if (courant.length > 0) paragraphes.push(courant)

  for (const p of paragraphes) for (const s of p) s.texte = typographie(recollerEnLigne(s.texte, connu))
  return { paragraphes, folios }
}

// The OCR often merges a paragraph's lines itself, leaving the line-end hyphen inside the line
// (Zara-thoustra, reli-gieuses): same rule as at a line end
function recollerEnLigne(texte: string, connu: Connu): string {
  return texte.replace(/(\p{L}+)-(\p{L}+)/gu, (tout, g: string, d: string) => (recoller(g, d, connu) ? g + d : tout))
}

/** French typography only, never a letter (Q31). */
export function typographie(texte: string): string {
  return texte
    .replace(/'/g, '’')
    .replace(/[ \t]+([;:!?»])/g, ' $1')
    .replace(/(\p{L})([;!?])/gu, '$1 $2')
    .replace(/«[ \t]*/g, '« ')
}

const ELISION = /^(l|d|j|m|n|s|t|c|qu|jusqu|lorsqu|puisqu|quoiqu)'(.+)$/

/** A word neither in the dictionary nor in the Lexique, or written in a non-Latin script. */
export function estSuspect(token: string, connu: Connu): boolean {
  const mot = token.replace(/^[’'-]+|[’'-]+$/g, '')
  if (!/\p{L}/u.test(mot)) return false
  // Show-through read backwards comes out as Cyrillic or Arabic look-alikes
  if (/[^\p{Script=Latin}\p{N}’'-]/u.test(mot)) return true
  const m = mot.toLowerCase().replace(/’/g, "'")
  if (connu(m)) return false
  const elision = ELISION.exec(m)
  if (elision && connu(elision[2])) return false
  const parties = (elision ? elision[2] : m).split('-')
  return !(parties.length > 1 && parties.every((p) => p && connu(p)))
}

export const MOTS = /[\p{L}\p{N}’'-]+/gu

/** Mostly gibberish: very likely show-through on a blank page, to propose as Page ignorée. */
export function pageIllisible(texte: string, connu: Connu): boolean {
  const mots = (texte.match(MOTS) ?? []).filter((t) => /\p{L}/u.test(t))
  if (mots.length < 3) return false
  return mots.filter((t) => estSuspect(t, connu)).length / mots.length > 0.5
}
