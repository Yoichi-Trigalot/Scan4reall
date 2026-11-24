import { openDB, type DBSchema } from 'idb'

export type Serie = { id: string; titre: string; creeeLe: number }

export type Tome = { id: string; serieId: string; numero: number; titre: string }

export type Session = {
  tomeId: string
  etat: 'en_cours' | 'terminee'
  demarreeLe: number
  majLe: number
}

interface Scan4reallDB extends DBSchema {
  series: { key: string; value: Serie }
  tomes: { key: string; value: Tome; indexes: { serieId: string } }
  // Keyed by tomeId: a Tome has at most one Session
  sessions: { key: string; value: Session }
}

const dbPromise = openDB<Scan4reallDB>('scan4reall', 1, {
  upgrade(db) {
    db.createObjectStore('series', { keyPath: 'id' })
    db.createObjectStore('tomes', { keyPath: 'id' }).createIndex('serieId', 'serieId')
    db.createObjectStore('sessions', { keyPath: 'tomeId' })
  },
})

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

/** Deletes the Serie with all its Tomes and their Sessions. */
export async function deleteSerie(id: string) {
  const db = await dbPromise
  const tx = db.transaction(['series', 'tomes', 'sessions'], 'readwrite')
  const tomes = await tx.objectStore('tomes').index('serieId').getAll(id)
  for (const tome of tomes) {
    await tx.objectStore('sessions').delete(tome.id)
    await tx.objectStore('tomes').delete(tome.id)
  }
  await tx.objectStore('series').delete(id)
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

/** Deletes the Tome with its Session. */
export async function deleteTome(id: string) {
  const db = await dbPromise
  const tx = db.transaction(['tomes', 'sessions'], 'readwrite')
  await tx.objectStore('sessions').delete(id)
  await tx.objectStore('tomes').delete(id)
  await tx.done
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
