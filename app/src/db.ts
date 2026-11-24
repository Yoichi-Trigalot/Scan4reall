import { openDB, type DBSchema, type IDBPTransaction } from 'idb'

export type Serie = {
  id: string
  titre: string
  creeeLe: number
  // Shared by every Tome of the Serie: goes into the EPUB metadata
  auteur?: string
}

export type Tome = { id: string; serieId: string; numero: number; titre: string }

export type Session = {
  tomeId: string
  etat: 'en_cours' | 'terminee'
  demarreeLe: number
  majLe: number
}

/** A photo of a double page as taken by the camera, kept untouched. */
export type Capture = {
  id: string
  tomeId: string
  // Shooting order within the Tome; Rang is assigned later, per Page, at split time
  ordre: number
  blob: Blob
  largeur: number
  hauteur: number
  priseLe: number
}

/** OCR text of one Page as returned by the shortcut, before any cleaning. */
export type TexteBrut = {
  tomeId: string
  rang: number
  // Capture and side the Rang pointed to at import: if Captures change afterwards, Rangs
  // shift and the text must not be shown under another Page's image
  captureId: string
  cote: 'gauche' | 'droite'
  texte: string
  importeLe: number
  // Set once the text is edited by hand: the OCR's original, for undo and re-import warnings
  texteOcr?: string
  // Page ignorée: kept out of the cleaned text and the EPUB (blank, illustration, show-through)
  ignoree?: boolean
}

/** Words validated by hand for a whole Serie (proper nouns, Japanese terms), lowercase. */
export type Lexique = { serieId: string; mots: string[] }

/** Word replacement applied to the cleaned text, on the whole Tome or on one Page. */
export type Correction = { id: string; tomeId: string; de: string; vers: string; rang?: number }

/**
 * A decision on a chapter: a suggested heading confirmed (possibly renamed) or rejected, or a
 * chapter added by hand at the start of a Page. Suggestions without a decision stay pending.
 */
export type Chapitre = {
  id: string
  tomeId: string
  // Suggestion it answers ("rang|heading text"), or undefined for a chapter added by hand
  suggestion?: string
  rang: number
  statut: 'confirme' | 'rejete'
  titre: string
  niveau: 1 | 2
}

interface Scan4reallDB extends DBSchema {
  series: { key: string; value: Serie }
  tomes: { key: string; value: Tome; indexes: { serieId: string } }
  // Keyed by tomeId: a Tome has at most one Session
  sessions: { key: string; value: Session }
  captures: { key: string; value: Capture; indexes: { tomeOrdre: [string, number] } }
  textes: { key: [string, number]; value: TexteBrut }
  lexiques: { key: string; value: Lexique }
  corrections: { key: string; value: Correction; indexes: { tomeId: string } }
  chapitres: { key: string; value: Chapitre; indexes: { tomeId: string } }
}

const ALL_STORES = [
  'series',
  'tomes',
  'sessions',
  'captures',
  'textes',
  'lexiques',
  'corrections',
  'chapitres',
] as const
type WriteTx = IDBPTransaction<Scan4reallDB, (typeof ALL_STORES)[number][], 'readwrite'>

const dbPromise = openDB<Scan4reallDB>('scan4reall', 5, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('series', { keyPath: 'id' })
      db.createObjectStore('tomes', { keyPath: 'id' }).createIndex('serieId', 'serieId')
      db.createObjectStore('sessions', { keyPath: 'tomeId' })
    }
    if (oldVersion < 2) {
      db.createObjectStore('captures', { keyPath: 'id' }).createIndex('tomeOrdre', ['tomeId', 'ordre'])
    }
    if (oldVersion < 3) {
      db.createObjectStore('textes', { keyPath: ['tomeId', 'rang'] })
    }
    if (oldVersion < 4) {
      db.createObjectStore('lexiques', { keyPath: 'serieId' })
      db.createObjectStore('corrections', { keyPath: 'id' }).createIndex('tomeId', 'tomeId')
    }
    if (oldVersion < 5) {
      db.createObjectStore('chapitres', { keyPath: 'id' }).createIndex('tomeId', 'tomeId')
    }
  },
})

// Both captures (tomeId, ordre) and textes (tomeId, rang) are keyed by Tome then a number
const capturesOf = (tomeId: string) => IDBKeyRange.bound([tomeId, -Infinity], [tomeId, Infinity])
const textesOf = capturesOf

export async function listSeries(): Promise<Serie[]> {
  const series = await (await dbPromise).getAll('series')
  return series.sort((a, b) => a.creeeLe - b.creeeLe)
}

export async function getSerie(id: string) {
  return (await dbPromise).get('series', id)
}

export async function createSerie(titre: string): Promise<Serie> {
  const serie = { id: crypto.randomUUID(), titre, creeeLe: Date.now() }
  await (await dbPromise).add('series', serie)
  return serie
}

export async function updateSerie(id: string, patch: Pick<Serie, 'titre' | 'auteur'>) {
  const db = await dbPromise
  const serie = await db.get('series', id)
  if (serie) await db.put('series', { ...serie, ...patch })
}

/** Everything a deletion removed, kept in memory so it can be undone. */
export type Snapshot = {
  series: Serie[]
  tomes: Tome[]
  sessions: Session[]
  captures: Capture[]
  textes: TexteBrut[]
  lexiques: Lexique[]
  corrections: Correction[]
  chapitres: Chapitre[]
}

const emptySnapshot = (): Snapshot => ({
  series: [],
  tomes: [],
  sessions: [],
  captures: [],
  textes: [],
  lexiques: [],
  corrections: [],
  chapitres: [],
})

// Removes a Tome and everything hanging off it, recording it all in the snapshot
async function removeTome(tx: WriteTx, tome: Tome, snapshot: Snapshot) {
  const session = await tx.objectStore('sessions').get(tome.id)
  if (session) snapshot.sessions.push(session)
  const captures = await tx.objectStore('captures').index('tomeOrdre').getAll(capturesOf(tome.id))
  snapshot.captures.push(...captures)
  for (const c of captures) await tx.objectStore('captures').delete(c.id)
  snapshot.textes.push(...(await tx.objectStore('textes').getAll(textesOf(tome.id))))
  await tx.objectStore('textes').delete(textesOf(tome.id))
  const corrections = await tx.objectStore('corrections').index('tomeId').getAll(tome.id)
  snapshot.corrections.push(...corrections)
  for (const c of corrections) await tx.objectStore('corrections').delete(c.id)
  const chapitres = await tx.objectStore('chapitres').index('tomeId').getAll(tome.id)
  snapshot.chapitres.push(...chapitres)
  for (const c of chapitres) await tx.objectStore('chapitres').delete(c.id)
  await tx.objectStore('sessions').delete(tome.id)
  await tx.objectStore('tomes').delete(tome.id)
  snapshot.tomes.push(tome)
}

/** Deletes the Serie with all its Tomes, their Sessions and Captures. */
export async function deleteSerie(id: string): Promise<Snapshot> {
  const db = await dbPromise
  const tx = db.transaction(ALL_STORES, 'readwrite')
  const snapshot = emptySnapshot()
  const serie = await tx.objectStore('series').get(id)
  if (serie) snapshot.series.push(serie)
  for (const tome of await tx.objectStore('tomes').index('serieId').getAll(id)) {
    await removeTome(tx, tome, snapshot)
  }
  const lexique = await tx.objectStore('lexiques').get(id)
  if (lexique) snapshot.lexiques.push(lexique)
  await tx.objectStore('lexiques').delete(id)
  await tx.objectStore('series').delete(id)
  await tx.done
  return snapshot
}

export async function restoreSnapshot(snapshot: Snapshot) {
  const db = await dbPromise
  const tx = db.transaction(ALL_STORES, 'readwrite')
  for (const s of snapshot.series) await tx.objectStore('series').put(s)
  for (const t of snapshot.tomes) await tx.objectStore('tomes').put(t)
  for (const s of snapshot.sessions) await tx.objectStore('sessions').put(s)
  for (const c of snapshot.captures) await tx.objectStore('captures').put(c)
  for (const t of snapshot.textes) await tx.objectStore('textes').put(t)
  for (const l of snapshot.lexiques) await tx.objectStore('lexiques').put(l)
  for (const c of snapshot.corrections) await tx.objectStore('corrections').put(c)
  for (const c of snapshot.chapitres) await tx.objectStore('chapitres').put(c)
  await tx.done
}

export async function listTomes(serieId: string): Promise<Tome[]> {
  const tomes = await (await dbPromise).getAllFromIndex('tomes', 'serieId', serieId)
  return tomes.sort((a, b) => a.numero - b.numero)
}

export async function getTome(id: string) {
  return (await dbPromise).get('tomes', id)
}

// The numero ends up in Page file names (T01-R0001): it must be unique within a Serie
async function assertNumeroFree(serieId: string, numero: number, exceptTomeId?: string) {
  const tomes = await listTomes(serieId)
  if (tomes.some((t) => t.numero === numero && t.id !== exceptTomeId)) {
    throw new Error(`Le tome ${numero} existe déjà dans cette série.`)
  }
}

export async function createTome(serieId: string, numero: number, titre: string): Promise<Tome> {
  await assertNumeroFree(serieId, numero)
  const tome = { id: crypto.randomUUID(), serieId, numero, titre }
  await (await dbPromise).add('tomes', tome)
  return tome
}

export async function updateTome(id: string, numero: number, titre: string) {
  const db = await dbPromise
  const tome = await db.get('tomes', id)
  if (!tome) return
  await assertNumeroFree(tome.serieId, numero, id)
  await db.put('tomes', { ...tome, numero, titre })
}

/** Deletes the Tome with its Session and Captures. */
export async function deleteTome(id: string): Promise<Snapshot> {
  const db = await dbPromise
  const tx = db.transaction(ALL_STORES, 'readwrite')
  const snapshot = emptySnapshot()
  const tome = await tx.objectStore('tomes').get(id)
  if (tome) await removeTome(tx, tome, snapshot)
  await tx.done
  return snapshot
}

export async function getSession(tomeId: string) {
  return (await dbPromise).get('sessions', tomeId)
}

export async function listSessions(): Promise<Session[]> {
  return (await dbPromise).getAll('sessions')
}

/** Starts the Tome's Session, or resumes it if it already exists. */
export async function openSession(tomeId: string): Promise<Session> {
  const db = await dbPromise
  const existing = await db.get('sessions', tomeId)
  const now = Date.now()
  const session: Session = existing
    ? { ...existing, majLe: now }
    : { tomeId, etat: 'en_cours', demarreeLe: now, majLe: now }
  await db.put('sessions', session)
  return session
}

export async function countCaptures(tomeId: string): Promise<number> {
  return (await dbPromise).countFromIndex('captures', 'tomeOrdre', capturesOf(tomeId))
}

export async function lastCapture(tomeId: string): Promise<Capture | undefined> {
  const db = await dbPromise
  const cursor = await db.transaction('captures').store.index('tomeOrdre').openCursor(capturesOf(tomeId), 'prev')
  return cursor?.value
}

export async function addCapture(tomeId: string, blob: Blob, largeur: number, hauteur: number): Promise<Capture> {
  const last = await lastCapture(tomeId)
  const capture: Capture = {
    id: crypto.randomUUID(),
    tomeId,
    ordre: (last?.ordre ?? 0) + 1,
    blob,
    largeur,
    hauteur,
    priseLe: Date.now(),
  }
  await (await dbPromise).add('captures', capture)
  return capture
}

export async function deleteCapture(id: string) {
  await (await dbPromise).delete('captures', id)
}

/** Captures of a Tome in shooting order. Blobs stay on disk until read. */
export async function listCaptures(tomeId: string): Promise<Capture[]> {
  return (await dbPromise).getAllFromIndex('captures', 'tomeOrdre', capturesOf(tomeId))
}

export async function listTextes(tomeId: string): Promise<TexteBrut[]> {
  return (await dbPromise).getAll('textes', textesOf(tomeId))
}

/** Saves imported OCR texts; a later import of the same Rang replaces it. */
export async function saveTextes(textes: TexteBrut[]) {
  const tx = (await dbPromise).transaction('textes', 'readwrite')
  for (const t of textes) await tx.store.put(t)
  await tx.done
}

export async function getTexte(tomeId: string, rang: number) {
  return (await dbPromise).get('textes', [tomeId, rang])
}

export async function putTexte(texte: TexteBrut) {
  await (await dbPromise).put('textes', texte)
}

export async function getLexique(serieId: string): Promise<Lexique> {
  return (await (await dbPromise).get('lexiques', serieId)) ?? { serieId, mots: [] }
}

/** Adds words (already in dictionary spelling, see motPourLexique) to the Serie's Lexique. */
export async function ajouterAuLexique(serieId: string, mots: string[]) {
  const db = await dbPromise
  const tx = db.transaction('lexiques', 'readwrite')
  const lexique = (await tx.store.get(serieId)) ?? { serieId, mots: [] }
  lexique.mots = [...new Set([...lexique.mots, ...mots])].sort()
  await tx.store.put(lexique)
  await tx.done
}

export async function retirerDuLexique(serieId: string, mot: string) {
  const db = await dbPromise
  const lexique = await db.get('lexiques', serieId)
  if (!lexique) return
  await db.put('lexiques', { ...lexique, mots: lexique.mots.filter((m) => m !== mot) })
}

export async function listCorrections(tomeId: string): Promise<Correction[]> {
  return (await dbPromise).getAllFromIndex('corrections', 'tomeId', tomeId)
}

export async function addCorrection(correction: Omit<Correction, 'id'>) {
  await (await dbPromise).add('corrections', { ...correction, id: crypto.randomUUID() })
}

export async function deleteCorrection(id: string) {
  await (await dbPromise).delete('corrections', id)
}

export async function listChapitres(tomeId: string): Promise<Chapitre[]> {
  return (await dbPromise).getAllFromIndex('chapitres', 'tomeId', tomeId)
}

export async function putChapitres(chapitres: Omit<Chapitre, 'id'>[] | Chapitre[]) {
  const tx = (await dbPromise).transaction('chapitres', 'readwrite')
  for (const c of chapitres) await tx.store.put({ id: crypto.randomUUID(), ...c })
  await tx.done
}

export async function deleteChapitre(id: string) {
  await (await dbPromise).delete('chapitres', id)
}
