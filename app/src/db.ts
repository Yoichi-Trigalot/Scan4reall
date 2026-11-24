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

export async function listTomes(serieId: string): Promise<Tome[]> {
  const tomes = await (await dbPromise).getAllFromIndex('tomes', 'serieId', serieId)
  return tomes.sort((a, b) => a.numero - b.numero)
}

export async function getTome(id: string) {
  return (await dbPromise).get('tomes', id)
}

export async function createTome(serieId: string, numero: number, titre: string): Promise<Tome> {
  const tomes = await listTomes(serieId)
  // The numero ends up in Page file names (T01-R0001): it must be unique within a Serie
  if (tomes.some((t) => t.numero === numero)) {
    throw new Error(`Le tome ${numero} existe déjà dans cette série.`)
  }
  const tome = { id: crypto.randomUUID(), serieId, numero, titre }
  await (await dbPromise).add('tomes', tome)
  return tome
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
