// IndexedDB `sentinel_doctor_view`: one store per table in schema/doctor_view.sql, keyed by its primary key.
// Decrypted data lives only here and is never sent back.
import type { DrAlert, DrPatient, DrTimelineEntry } from './types'

const DB_NAME = 'sentinel_doctor_view'
const DB_VERSION = 1

export interface DrKey {
  doctor_id: string
  public_key: string // base64 ORIGINAL
  private_key: string // base64 ORIGINAL; never exported, logged or transmitted
  created_at: string
}
export type SyncStream = 'envelopes' | 'alerts'

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      db.createObjectStore('dr_patient', { keyPath: 'patient_ref' })
      db.createObjectStore('dr_timeline_entry', { keyPath: 'entry_id' }).createIndex('patient_ref', 'patient_ref')
      db.createObjectStore('dr_alert', { keyPath: 'alert_id' })
      db.createObjectStore('dr_key', { keyPath: 'doctor_id' })
      db.createObjectStore('dr_sync_state', { keyPath: 'stream' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function store(name: string, mode: IDBTransactionMode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name)
}

export const db = {
  async getKey(doctorId: string): Promise<DrKey | undefined> {
    return wrap((await store('dr_key')).get(doctorId))
  },
  async putKey(k: DrKey) {
    await wrap((await store('dr_key', 'readwrite')).put(k))
  },

  async getSince(stream: SyncStream): Promise<string | undefined> {
    const row = (await wrap((await store('dr_sync_state')).get(stream))) as { since: string } | undefined
    return row?.since
  },
  async setSince(stream: SyncStream, since: string) {
    await wrap((await store('dr_sync_state', 'readwrite')).put({ stream, since }))
  },

  async putPatient(p: DrPatient) {
    await wrap((await store('dr_patient', 'readwrite')).put(p))
  },
  async getPatient(ref: string): Promise<DrPatient | undefined> {
    return wrap((await store('dr_patient')).get(ref))
  },
  async allPatients(): Promise<DrPatient[]> {
    return wrap((await store('dr_patient')).getAll())
  },

  async putTimelineEntries(entries: DrTimelineEntry[]) {
    if (!entries.length) return
    const tx = (await open()).transaction('dr_timeline_entry', 'readwrite')
    for (const e of entries) tx.objectStore('dr_timeline_entry').put(e)
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },
  async timelineFor(ref: string): Promise<DrTimelineEntry[]> {
    const s = await store('dr_timeline_entry')
    return wrap(s.index('patient_ref').getAll(ref) as IDBRequest<DrTimelineEntry[]>)
  },

  // Keeps seen_at if the alert is already stored.
  async putAlert(a: DrAlert) {
    const existing = (await wrap((await store('dr_alert')).get(a.alert_id))) as DrAlert | undefined
    await wrap((await store('dr_alert', 'readwrite')).put({ ...a, seen_at: existing?.seen_at ?? a.seen_at }))
  },
  async allAlerts(): Promise<DrAlert[]> {
    return wrap((await store('dr_alert')).getAll())
  },
  async markAlertSeen(id: string) {
    const a = (await wrap((await store('dr_alert')).get(id))) as DrAlert | undefined
    if (a && !a.seen_at) await wrap((await store('dr_alert', 'readwrite')).put({ ...a, seen_at: new Date().toISOString() }))
  },

  // Demo reset: wipes everything including the key pair.
  async wipe() {
    const d = await open()
    d.close()
    dbPromise = null
    await wrap(indexedDB.deleteDatabase(DB_NAME) as unknown as IDBRequest<undefined>)
  },
}
