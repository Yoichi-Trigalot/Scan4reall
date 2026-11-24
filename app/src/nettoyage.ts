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
  // Indexes of paragraphs that look like a heading: chapter suggestions
  titres: Set<number>
}

// Heading shapes of the first Serie: "LIVRE I", "1. L'AUBE", "PRÉFACE A L'ÉDITION ANGLAISE"
const TITRE_MAX = 60
const PARTIE = /^(livre|partie|chapitre)\s+([ivxlcdm]+|\d+|premier|première)\b/i
const NUMERO = /^\d{1,3}\.\s/

/** A line printed as a heading: short, no closing punctuation, numbered or in capitals. */
export function estTitre(ligne: string): boolean {
  if (ligne.length > TITRE_MAX || /[.!?…:;,]$/.test(ligne)) return false
  // Show-through gibberish comes out in capitals too (ВИТАМИН): never a heading
  if (/[^\p{Script=Latin}\p{N}\p{P}\p{S}\s]/u.test(ligne)) return false
  if (PARTIE.test(ligne)) return true
  const lettres = ligne.match(/\p{L}/gu) ?? []
  if (lettres.length < 5) return false
  const capitales = lettres.filter((l) => l !== l.toLowerCase()).length / lettres.length
  return capitales >= 0.9 || (NUMERO.test(ligne) && capitales >= 0.8)
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
  return connu(formeDico(gauche + droite))
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
  const titres = new Set<number>()
  let courant: Segment[] = []
  for (const ligne of lignes) {
    // A heading never joins the text around it: "1. L'AUBE" has no final period
    if (estTitre(ligne.texte)) {
      if (courant.length > 0) paragraphes.push(courant)
      courant = []
      const precedent = paragraphes.length - 1
      if (titres.has(precedent) && paragraphes[precedent].at(-1)!.rang === ligne.rang) {
        // Heading printed on two lines: AVANT-PROPOS / DE ARNOLD TOYNBEE
        paragraphes[precedent].at(-1)!.texte += ' ' + ligne.texte
      } else {
        titres.add(paragraphes.length)
        paragraphes.push([{ rang: ligne.rang, texte: ligne.texte }])
      }
      continue
    }
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
  return { paragraphes, folios, titres }
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

/** Spelling used by the dictionary and the Lexique: lowercase, straight apostrophe, oe/ae. */
export function formeDico(mot: string): string {
  return mot.toLowerCase().replace(/’/g, "'").replace(/œ/g, 'oe').replace(/æ/g, 'ae')
}

/** The word a validation adds to the Lexique: without its elision, so l’Asie and d’Asie both benefit. */
export function motPourLexique(token: string): string {
  const m = formeDico(token.replace(/^[’'-]+|[’'-]+$/g, ''))
  return ELISION.exec(m)?.[2] ?? m
}

// French print often drops accents on capitals (Etat, Eglise): try the accented first letter
const ACCENTS: Record<string, string[]> = { e: ['é', 'è', 'ê'], a: ['à', 'â'], i: ['î'], o: ['ô'], u: ['ù', 'û'], c: ['ç'] }

function connuSouple(m: string, majuscule: boolean, connu: Connu): boolean {
  if (connu(m)) return true
  return majuscule && (ACCENTS[m[0]] ?? []).some((a) => connu(a + m.slice(1)))
}

/** A word neither in the dictionary nor in the Lexique, or written in a non-Latin script. */
export function estSuspect(token: string, connu: Connu): boolean {
  const mot = token.replace(/^[’'-]+|[’'-]+$/g, '')
  if (!/\p{L}/u.test(mot)) return false
  // Show-through read backwards comes out as Cyrillic or Arabic look-alikes
  if (/[^\p{Script=Latin}\p{N}’'-]/u.test(mot)) return true
  const m = formeDico(mot)
  if (connuSouple(m, /^\p{Lu}/u.test(mot), connu)) return false
  const elision = ELISION.exec(m)
  // After an elision the capital is the second word's first letter: d’Etat
  const apres = elision && mot.slice(elision[1].length + 1)
  if (elision && connuSouple(elision[2], /^\p{Lu}/u.test(apres ?? ''), connu)) return false
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
