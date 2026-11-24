import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getLexique,
  listCaptures,
  listChapitres,
  listCorrections,
  listTextes,
  type Chapitre,
  type Correction,
  type TexteBrut,
  type Tome,
} from './db'
import { chargerDictionnaire } from './dictionnaire'
import { nettoyer, type Connu } from './nettoyage'
import { pagesOf, type Page } from './pages'
import { appliquerCorrections } from './verification'

/** A text still attached to the Capture its Rang pointed to at import (Rangs shift otherwise). */
export function texteValide(t: TexteBrut | undefined, p: Page): t is TexteBrut {
  return !!t && t.captureId === p.capture.id && t.cote === p.cote
}

/**
 * Everything derived from a Tome's OCR, computed in one place so the Page viewer and the
 * verification screen always show the same cleaned text. `version` reloads on Capture changes.
 */
export function useTexteTome(tome: Tome, version = 0) {
  const [pages, setPages] = useState<Page[]>([])
  const [textes, setTextes] = useState<Map<number, TexteBrut>>(new Map())
  const [lexique, setLexique] = useState<Set<string>>(new Set())
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [chapitres, setChapitres] = useState<Chapitre[]>([])
  const [dico, setDico] = useState<Set<string>>()
  const [erreurDico, setErreurDico] = useState('')

  const recharger = useCallback(async () => {
    setPages(pagesOf(await listCaptures(tome.id)))
    setTextes(new Map((await listTextes(tome.id)).map((t) => [t.rang, t])))
    setLexique(new Set((await getLexique(tome.serieId)).mots))
    setCorrections(await listCorrections(tome.id))
    setChapitres(await listChapitres(tome.id))
  }, [tome.id, tome.serieId])

  useEffect(() => {
    recharger()
  }, [recharger, version])

  useEffect(() => {
    chargerDictionnaire()
      .then(setDico)
      .catch((err: Error) => setErreurDico(err.message))
  }, [])

  const connu = useMemo<Connu | undefined>(
    () => (dico ? (mot: string) => dico.has(mot) || lexique.has(mot) : undefined),
    [dico, lexique],
  )

  // Over the whole Tome: paragraphs and split words cross page breaks
  const nettoyage = useMemo(() => {
    if (!connu) return undefined
    const actives = pages.flatMap((p) => {
      const t = textes.get(p.rang)
      return texteValide(t, p) && !t.ignoree ? [{ rang: p.rang, texte: t.texte }] : []
    })
    return appliquerCorrections(nettoyer(actives, connu), corrections)
  }, [connu, pages, textes, corrections])

  return { pages, textes, lexique, corrections, chapitres, connu, nettoyage, erreurDico, recharger }
}
