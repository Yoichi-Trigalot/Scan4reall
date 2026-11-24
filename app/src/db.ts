import { openDB, type DBSchema, type IDBPTransaction } from 'idb'

export type Serie = { id: string; titre: string; creeeLe: number }

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

interface Scan4reallDB extends DBSchema {
  series: { key: string; value: Serie }
  tomes: { key: string; value: Tome; indexes: { serieId: string } }
  // Keyed by tomeId: a Tome has at most one Session
  sessions: { key: string; value: Session }
  captures: { key: string; value: Capture; indexes: { tomeOrdre: [string, number] } }
}

const ALL_STORES = ['series', 'tomes', 'sessions', 'captures'] as const
type WriteTx = IDBPTransaction<Scan4reallDB, (typeof ALL_STORES)[number][], 'readwrite'>

const dbPromise = openDB<Scan4reallDB>('scan4reall', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('series', { keyPath: 'id' })
      db.createObjectStore('tomes', { keyPath: 'id' }).createIndex('serieId', 'serieId')
      db.createObjectStore('sessions', { keyPath: 'tomeId' })
    }
    if (oldVersion < 2) {
      db.createObjectStore('captures', { keyPath: 'id' }).createIndex('tomeOrdre', ['tomeId', 'ordre'])
    }
  },
})

const capturesOf = (tomeId: string) => IDBKeyRange.bound([tomeId, -Infinity], [tomeId, Infinity])

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

export async function renameSerie(id: string, titre: string) {
  const db = await dbPromise
  const serie = await db.get('series', id)
  if (serie) await db.put('series', { ...serie, titre })
}

/** Everything a deletion removed, kept in memory so it can be undone. */
export type Snapshot = { series: Serie[]; tomes: Tome[]; sessions: Session[]; captures: Capture[] }

const emptySnapshot = (): Snapshot => ({ series: [], tomes: [], sessions: [], captures: [] })

// Removes a Tome and everything hanging off it, recording it all in the snapshot
async function removeTome(tx: WriteTx, tome: Tome, snapshot: Snapshot) {
  const session = await tx.objectStore('sessions').get(tome.id)
  if (session) snapshot.sessions.push(session)
  const captures = await tx.objectStore('captures').index('tomeOrdre').getAll(capturesOf(tome.id))
  snapshot.captures.push(...captures)
  for (const c of captures) await tx.objectStore('captures').delete(c.id)
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
