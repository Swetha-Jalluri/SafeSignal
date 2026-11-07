// Pulls envelopes and alerts, decrypts in the browser, verifies hash + schema, stores in IndexedDB, acks.
// Nothing decrypted is ever sent back: the only writes to the service are the public key and acks.
import { payloadSha256 } from '@sentinel/contract'
import { api } from './api'
import { config } from './config'
import { generateKeyPair, openSealed, type KeyPair } from './crypto'
import { validateDoctorPayload } from './validate'
import { db } from './db'
import type { CheckinStatus, DoctorEnvelope, DrTimelineEntry, Trend } from './types'

export interface Rejection {
  envelope_id: string
  patient_ref: string
  reason: string // never contains decrypted content
  at: string
}

export interface SyncResult {
  accepted: number
  rejected: Rejection[]
  newAlerts: number
  linkedRefs: string[] // active care links right now (the service returns only active ones)
}

export interface CheckinDay {
  date: string
  status: CheckinStatus
  trend: Trend
}

let keyPair: KeyPair | null = null

// Load or create the key pair, then (re)register the public key on every start: patients get 404
// until it is registered (D-025), and re-registering keeps the service on the key this browser holds.
export async function ensureKey(): Promise<KeyPair> {
  if (keyPair) return keyPair
  const stored = await db.getKey(config.doctorId)
  let kp: KeyPair
  if (stored) {
    kp = { publicKey: stored.public_key, privateKey: stored.private_key }
  } else {
    kp = await generateKeyPair()
    await db.putKey({ doctor_id: config.doctorId, public_key: kp.publicKey, private_key: kp.privateKey, created_at: new Date().toISOString() })
  }
  await api.registerPublicKey(kp.publicKey)
  keyPair = kp
  return kp
}

export function resetKeyCache() {
  keyPair = null
}

async function processEnvelope(env: DoctorEnvelope, kp: KeyPair): Promise<void> {
  let raw: unknown
  try {
    raw = JSON.parse(await openSealed(env.ciphertext, kp))
  } catch {
    throw new Error('decryption failed (sealed to a different key?)')
  }
  if ((await payloadSha256(raw)) !== env.payload_sha256) throw new Error('payload_sha256 mismatch')
  const p = validateDoctorPayload(raw)
  if (p.patient_ref !== env.patient_ref) throw new Error('patient_ref does not match envelope')

  // last_checkin = newest day the patient actually checked in; a missed day is not a check-in.
  const prev = (await db.getPatient(p.patient_ref))?.last_checkin ?? null
  const last = p.status === 'missed' ? prev : prev && prev > p.checkin_date ? prev : p.checkin_date
  await db.putPatient({
    patient_ref: p.patient_ref,
    display_name: p.display_name,
    drug_name: p.drug_name,
    drug_version: p.drug_version,
    last_checkin: last,
  })

  await db.putTimelineEntries(
    p.symptoms.map((s) => ({
      entry_id: `${env.envelope_id}:${s.term_code}`,
      patient_ref: p.patient_ref,
      envelope_id: env.envelope_id,
      checkin_date: p.checkin_date,
      status: p.status,
      term_code: s.term_code,
      severity: s.severity,
      onset: s.onset,
      known_side_effect: s.known_side_effect ? 1 : 0,
      possible_link_flag: s.possible_link_flag ? 1 : 0,
      trend: p.trend,
    })),
  )
}

export async function syncOnce(): Promise<SyncResult> {
  const kp = await ensureKey()
  const result: SyncResult = { accepted: 0, rejected: [], newAlerts: 0, linkedRefs: [] }

  result.linkedRefs = (await api.patients()).map((l) => l.patient_ref)

  for (const env of await api.envelopes(await db.getSince('envelopes'))) {
    try {
      await processEnvelope(env, kp)
      await api.ack(env.envelope_id)
      result.accepted++
    } catch (e) {
      // Not acked; the cursor still advances so one bad envelope can't block the stream.
      result.rejected.push({ envelope_id: env.envelope_id, patient_ref: env.patient_ref, reason: (e as Error).message, at: new Date().toISOString() })
    }
    await db.setSince('envelopes', env.received_at)
  }

  for (const a of await api.alerts(await db.getSince('alerts'))) {
    await db.putAlert({ ...a, seen_at: null })
    await db.setSince('alerts', a.created_at)
    result.newAlerts++
  }
  return result
}

// One row per check-in that reported symptoms. Envelopes with no symptoms or status 'missed' leave no
// timeline entry in schema/doctor_view.sql, so those days can't be shown yet (requested from the owner).
export function checkinDays(entries: DrTimelineEntry[]): CheckinDay[] {
  const byEnvelope = new Map<string, CheckinDay>()
  for (const e of entries) byEnvelope.set(e.envelope_id, { date: e.checkin_date, status: e.status, trend: e.trend })
  return [...byEnvelope.values()].sort((a, b) => a.date.localeCompare(b.date))
}
