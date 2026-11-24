import JSZip from 'jszip'
import type { ChapitreVue } from './chapitres'
import type { Serie, Tome } from './db'
import type { Nettoyage } from './nettoyage'

/**
 * Fills folios the OCR missed when both neighbors agree: 10 on Rang 9 and 12 on Rang 11 give 11
 * on Rang 10. Nothing is guessed when the gap doesn't match the printed numbering.
 */
export function completerFolios(folios: Map<number, string>, rangs: number[]): Map<number, string> {
  const connus = [...folios]
    .filter(([, f]) => /^\d+$/.test(f))
    .map(([r, f]) => [r, Number(f)] as const)
    .sort((a, b) => a[0] - b[0])
  const out = new Map(folios)
  for (let i = 0; i + 1 < connus.length; i++) {
    const [r1, f1] = connus[i]
    const [r2, f2] = connus[i + 1]
    if (f2 - f1 !== r2 - r1) continue
    for (const r of rangs) if (r > r1 && r < r2 && !out.has(r)) out.set(r, String(f1 + (r - r1)))
  }
  return out
}

export type ChapitreEpub = { titre: string; niveau: 1 | 2; html: string }
export type PageEpub = { folio: string; chapitre: number; ancre: string }
export type PlanEpub = { chapitres: ChapitreEpub[]; pages: PageEpub[] }

const echapper = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * The book's structure: one file per confirmed chapter, starting at the first one so the front
 * matter (title page, copyright) stays out (Q38). Without any confirmed chapter, a single file.
 */
export function planEpub(n: Nettoyage, chapitres: ChapitreVue[], folios: Map<number, string>): PlanEpub {
  const cleDe = (i: number) => `${n.paragraphes[i][0].rang}|${n.paragraphes[i].map((s) => s.texte).join(' ')}`
  const debuts = chapitres
    .filter((c) => c.statut === 'confirme')
    .flatMap((c) => {
      // A suggested chapter starts at its heading; one added by hand at its Page's first paragraph
      const i = c.decision?.suggestion
        ? [...n.titres].find((t) => cleDe(t) === c.cle)
        : n.paragraphes.findIndex((p) => p[0].rang >= c.rang)
      return i === undefined || i < 0 ? [] : [{ i, titre: c.titre, niveau: c.niveau, titreImprime: !!c.decision?.suggestion }]
    })
    .sort((a, b) => a.i - b.i)
  const sections = debuts.length > 0 ? debuts : [{ i: 0, titre: '', niveau: 1 as const, titreImprime: false }]

  const pages: PageEpub[] = []
  const vus = new Set<number>()
  const plan = sections.map((section, k) => {
    const fin = k + 1 < sections.length ? sections[k + 1].i : n.paragraphes.length
    const blocs: string[] = []
    for (let i = section.i; i < fin; i++) {
      let html = ''
      for (const s of n.paragraphes[i]) {
        if (html) html += ' '
        if (!vus.has(s.rang)) {
          vus.add(s.rang)
          const folio = folios.get(s.rang)
          if (folio) {
            // Printed page number kept to cite the paper book; also listed in the page-list nav
            const ancre = `page-r${s.rang}`
            pages.push({ folio, chapitre: k, ancre })
            html += `<span epub:type="pagebreak" role="doc-pagebreak" id="${ancre}" title="${folio}" class="folio">${folio}</span>`
          }
        }
        html += echapper(s.texte)
      }
      // The chapter's own heading is rendered from its (possibly renamed) title instead
      if (i === section.i && section.titreImprime) {
        const folio = html.match(/^<span[^>]*>[^<]*<\/span>/)?.[0] ?? ''
        if (folio) blocs.push(`<p class="saut">${folio}</p>`)
        continue
      }
      blocs.push(`<p>${html}</p>`)
    }
    return { titre: section.titre, niveau: section.niveau, html: blocs.join('\n') }
  })
  return { chapitres: plan, pages }
}

export function titreLivre(serie: Serie, tome: Tome): string {
  return `${serie.titre} ${String(tome.numero).padStart(2, '0')}${tome.titre ? ` — ${tome.titre}` : ''}`
}

const CSS = `body { margin: 0 5%; font-family: serif; line-height: 1.5; }
h1, h2 { text-align: center; margin: 2em 0 1em; font-weight: normal; letter-spacing: 0.05em; }
h1 { font-size: 1.4em; }
h2 { font-size: 1.15em; }
p { margin: 0; text-indent: 1.5em; text-align: justify; }
p.saut { text-indent: 0; }
.folio { font-size: 0.6em; color: #888; vertical-align: super; margin: 0 0.3em; text-indent: 0; }
`

function xhtml(titre: string, corps: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head>
<meta charset="utf-8"/>
<title>${echapper(titre)}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
${corps}
</body>
</html>
`
}

const fichier = (k: number) => `chapitre-${String(k + 1).padStart(3, '0')}.xhtml`

function nav(plan: PlanEpub, titre: string): string {
  // Numbered chapters nest under the top-level part before them
  let toc = '<ol>\n'
  let ouvert = false
  plan.chapitres.forEach((c, k) => {
    if (!c.titre) return
    const li = `<li><a href="${fichier(k)}">${echapper(c.titre)}</a>`
    if (c.niveau === 2 && ouvert) toc += `${li}</li>\n`
    else {
      if (ouvert) toc += '</ol></li>\n'
      ouvert = false
      if (c.niveau === 1) {
        toc += `${li}\n<ol>\n`
        ouvert = true
      } else toc += `${li}</li>\n`
    }
  })
  if (ouvert) toc += '</ol></li>\n'
  toc += '</ol>'
  // An empty nested list is invalid EPUB: drop it
  toc = toc.replace(/\n<ol>\n<\/ol><\/li>/g, '</li>')
  const pages = plan.pages.map((p) => `<li><a href="${fichier(p.chapitre)}#${p.ancre}">${echapper(p.folio)}</a></li>`)
  return xhtml(
    titre,
    `<nav epub:type="toc" id="toc"><h1>Table des matières</h1>
${plan.chapitres.some((c) => c.titre) ? toc : `<ol><li><a href="${fichier(0)}">${echapper(titre)}</a></li></ol>`}
</nav>${pages.length > 0 ? `\n<nav epub:type="page-list" hidden=""><ol>\n${pages.join('\n')}\n</ol></nav>` : ''}`,
  )
}

function opf(serie: Serie, tome: Tome, plan: PlanEpub, modifie: Date): string {
  const titre = titreLivre(serie, tome)
  const items = plan.chapitres.map(
    (_, k) => `<item id="c${k + 1}" href="${fichier(k)}" media-type="application/xhtml+xml"/>`,
  )
  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="fr">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="uid">urn:uuid:${tome.id}</dc:identifier>
<dc:title>${echapper(titre)}</dc:title>
<dc:language>fr</dc:language>
${serie.auteur ? `<dc:creator>${echapper(serie.auteur)}</dc:creator>\n` : ''}<meta property="dcterms:modified">${modifie.toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
<meta property="belongs-to-collection" id="serie">${echapper(serie.titre)}</meta>
<meta refines="#serie" property="collection-type">series</meta>
<meta refines="#serie" property="group-position">${tome.numero}</meta>
<meta name="calibre:series" content="${echapper(serie.titre)}"/>
<meta name="calibre:series_index" content="${tome.numero}"/>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="css" href="style.css" media-type="text/css"/>
${items.join('\n')}
</manifest>
<spine>
${plan.chapitres.map((_, k) => `<itemref idref="c${k + 1}"/>`).join('\n')}
</spine>
</package>
`
}

const CONTAINER = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>
`

/** The EPUB 3 file, ready to share or send to the Kindle. */
export async function construireEpub(serie: Serie, tome: Tome, plan: PlanEpub, modifie = new Date()): Promise<Uint8Array> {
  const titre = titreLivre(serie, tome)
  const zip = new JSZip()
  // The EPUB spec wants mimetype first and uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', CONTAINER)
  zip.file('OEBPS/content.opf', opf(serie, tome, plan, modifie))
  zip.file('OEBPS/nav.xhtml', nav(plan, titre))
  zip.file('OEBPS/style.css', CSS)
  plan.chapitres.forEach((c, k) => {
    const entete = c.titre ? `<h${c.niveau}>${echapper(c.titre)}</h${c.niveau}>\n` : ''
    zip.file(`OEBPS/${fichier(k)}`, xhtml(c.titre || titre, `<section epub:type="chapter">\n${entete}${c.html}\n</section>`))
  })
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: 'application/epub+zip' })
}
