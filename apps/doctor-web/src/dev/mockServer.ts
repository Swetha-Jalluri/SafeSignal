// In-browser stand-in for the Sentinel service + patient device, used when VITE_SENTINEL_BASE_URL is unset.
// It seals synthetic doctor payloads to the registered public key, exactly as the patient egress gate will,
// so the decrypt → hash → validate path is exercised before integration. Synthetic data only.
import { payloadSha256 } from '@sentinel/contract'
import { seal } from '../lib/crypto'
import type { AlertEvent, DoctorEnvelope, DoctorPayload, Severity, SymptomEntry, Trend } from '../lib/types'

interface MockPatient {
  ref: string
  name: string
  drug: string
  version: string
  linked: boolean
}

const PATIENTS: MockPatient[] = [
  { ref: 'pt_4b82d0c6', name: 'Walter', drug: 'Tagrisso', version: 'v2', linked: true },
  { ref: 'pt_9c1d2e3f', name: 'Priya', drug: 'Tagrisso', version: 'v1', linked: true },
  { ref: 'pt_77aa0b1c', name: 'Not consented', drug: 'Tagrisso', version: 'v3', linked: false },
]
const CAREGIVER_OF: Record<string, string> = { pt_4b82d0c6: 'cg_7e21c9a4' } // schema/demo_fixtures.json

const day = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}
const sym = (term_code: string, severity: Severity, onset: SymptomEntry['onset'], known = true, link = false): SymptomEntry => ({
  term_code, severity, onset, known_side_effect: known, possible_link_flag: link,
})

// 21 days of history per patient: Walter's rash and nail changes worsen in week 3 after a new nail product.
function history(p: MockPatient): DoctorPayload[] {
  const out: DoctorPayload[] = []
  for (let off = 20; off >= 1; off--) {
    let symptoms: SymptomEntry[] = []
    let trend: Trend = 'same'
    let status: DoctorPayload['status'] = 'completed'
    if (p.ref === 'pt_4b82d0c6') {
      if (off === 9) status = 'missed'
      else if (off <= 7) {
        symptoms = [
          sym('SE_RASH', off <= 3 ? 'moderate' : 'mild', off <= 3 ? '4_7_days' : '1_3_days', true, true),
          sym('SE_PARONYCHIA', 'mild', '4_7_days', true, true),
        ]
        if (off <= 2) symptoms.push(sym('SE_FATIGUE', 'mild', 'today'))
        trend = off <= 3 ? 'worse' : 'same'
      } else if (off % 4 === 0) symptoms = [sym('SE_DRY_SKIN', 'mild', 'over_7_days')]
      else trend = 'better'
    } else if (p.ref === 'pt_9c1d2e3f') {
      if (off === 1) status = 'missed'
      else if (off % 3 === 0) {
        symptoms = [sym('SE_EDEMA', off < 8 ? 'moderate' : 'mild', '4_7_days', false)]
        trend = off < 8 ? 'worse' : 'same'
      } else if (off === 14) symptoms = [sym('SE_INFUSION_REACTION', 'moderate', 'today', false)]
    } else {
      symptoms = [sym('SE_DIARRHEA', 'mild', '1_3_days')]
    }
    out.push({
      schema_version: '1.0', patient_ref: p.ref, display_name: p.name, drug_name: p.drug, drug_version: p.version,
      checkin_date: day(off), status, trend: status === 'missed' ? 'unknown' : trend,
      symptoms: status === 'missed' ? [] : symptoms,
    })
  }
  return out
}

const hex8 = (s: string) => {
  let h = 2166136261
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0
  return h.toString(16).padStart(8, '0')
}

class MockServer {
  private publicKey: string | null = null
  private envelopes: (DoctorEnvelope & { fetched?: boolean })[] = []
  private alerts: AlertEvent[] = []
  private links = new Set(PATIENTS.filter((p) => p.linked).map((p) => p.ref))
  private seeded = false

  private async envelopeFor(payload: DoctorPayload, receivedAt: string): Promise<DoctorEnvelope> {
    if (!this.publicKey) throw new Error('mock: no doctor public key registered')
    const plaintext = JSON.stringify(payload)
    return {
      envelope_id: 'env_' + hex8(payload.patient_ref + payload.checkin_date + receivedAt),
      patient_ref: payload.patient_ref,
      ciphertext: await seal(plaintext, this.publicKey),
      payload_sha256: await payloadSha256(payload),
      received_at: receivedAt,
    }
  }

  // Alerts need no key, so they exist even for a caregiver-only tab.
  private alertsSeeded = false
  private seedAlerts() {
    if (this.alertsSeeded) return
    this.alertsSeeded = true
    for (const p of PATIENTS) {
      for (const payload of history(p)) {
        if (payload.status === 'missed') {
          this.alerts.push({ alert_id: 'alt_' + hex8(p.ref + payload.checkin_date), patient_ref: p.ref, alert_type: 'missed', created_at: `${payload.checkin_date}T12:01:00Z` })
        }
      }
    }
    this.alerts.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }

  // Envelopes are sealed to the doctor's key, so they are created once it is registered.
  private async seed() {
    if (this.seeded) return
    this.seeded = true
    for (const p of PATIENTS) {
      for (const payload of history(p)) {
        this.envelopes.push(await this.envelopeFor(payload, `${payload.checkin_date}T14:00:00Z`))
      }
    }
    this.envelopes.sort((a, b) => a.received_at.localeCompare(b.received_at))
  }

  async handle(role: string, actor: string, method: string, path: string, body?: unknown): Promise<unknown> {
    await new Promise((r) => setTimeout(r, 80))
    this.seedAlerts()
    const url = new URL(path, 'http://mock')
    const since = url.searchParams.get('since')
    const after = <T,>(items: T[], key: (t: T) => string) => (since ? items.filter((i) => key(i) > since) : items).slice(0, 100)

    const m = url.pathname.match(/^\/v1\/doctors\/([^/]+)\/(public-key|patients|envelopes|alerts)(?:\/([^/]+)\/ack)?$/)
    if (m) {
      if (role !== 'doctor' || actor !== m[1]) throw Object.assign(new Error('403'), { status: 403 })
      const [, , what, envId] = m
      if (what === 'public-key' && method === 'PUT') {
        this.publicKey = (body as { public_key: string }).public_key
        await this.seed()
        return
      }
      if (what === 'patients') return [...this.links].map((patient_ref) => ({ patient_ref, status: 'active' }))
      if (what === 'envelopes' && envId) {
        const e = this.envelopes.find((x) => x.envelope_id === envId)
        if (e) e.fetched = true
        return
      }
      if (what === 'envelopes') return after(this.envelopes.filter((e) => this.links.has(e.patient_ref)), (e) => e.received_at)
      if (what === 'alerts') return after(this.alerts.filter((a) => this.links.has(a.patient_ref)), (a) => a.created_at)
    }
    const c = url.pathname.match(/^\/v1\/caregivers\/([^/]+)\/alerts$/)
    if (c) {
      if (role !== 'caregiver' || actor !== c[1]) throw Object.assign(new Error('403'), { status: 403 })
      return this.alerts.filter((a) => CAREGIVER_OF[a.patient_ref] === c[1])
    }
    throw Object.assign(new Error(`mock: no route ${method} ${path}`), { status: 404 })
  }

  // Demo controls (dev panel only).
  dev = {
    patients: PATIENTS,
    checkin: async (ref: string, severity: Severity) => {
      const p = PATIENTS.find((x) => x.ref === ref)!
      const payload: DoctorPayload = {
        schema_version: '1.0', patient_ref: ref, display_name: p.name, drug_name: p.drug, drug_version: p.version,
        checkin_date: day(0), status: 'completed', trend: severity === 'mild' ? 'same' : 'worse',
        symptoms: [sym('SE_RASH', severity, '1_3_days', true, true)],
      }
      const now = new Date().toISOString()
      this.envelopes.push(await this.envelopeFor(payload, now))
      if (severity === 'severe') this.alert(ref, 'severe')
    },
    missed: (ref: string) => this.alert(ref, 'missed'),
    tamper: async (ref: string) => {
      const p = PATIENTS.find((x) => x.ref === ref)!
      const payload = history(p)[0]
      const e = await this.envelopeFor(payload, new Date().toISOString())
      e.payload_sha256 = '0'.repeat(64) // hash mismatch → must be rejected
      this.envelopes.push(e)
    },
    toggleLink: (ref: string) => (this.links.has(ref) ? this.links.delete(ref) : this.links.add(ref)),
    isLinked: (ref: string) => this.links.has(ref),
  }

  private alert(ref: string, type: AlertEvent['alert_type']) {
    const now = new Date().toISOString()
    this.alerts.push({ alert_id: 'alt_' + hex8(ref + now + type), patient_ref: ref, alert_type: type, created_at: now })
  }
}

export const mockServer = new MockServer()
