// Doctor-layer client. Only the endpoints allowed by the doctor brief (Section 26.14) plus the caregiver alerts.
import { config } from './config'
import { mockServer } from '../dev/mockServer'
import type { AlertEvent, CaregiverAlert, CareLink, DoctorEnvelope } from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type Role = 'doctor' | 'caregiver'

async function call<T>(role: Role, actorId: string, method: string, path: string, body?: unknown): Promise<T> {
  if (config.mock) return mockServer.handle(role, actorId, method, path, body) as Promise<T>
  const res = await fetch(config.baseUrl + path, {
    method,
    headers: {
      'X-Role': role,
      'X-Actor-Id': actorId,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    // 401/403/409/422 are not retried (Section 26.13); callers surface them.
    const detail = await res.text().catch(() => '')
    throw new ApiError(res.status, `${method} ${path} → ${res.status} ${detail.slice(0, 200)}`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

// List endpoints return bare arrays (schema/openapi.json).
const list = <T,>(r: T[] | undefined): T[] => r ?? []

const PAGE = 100
const d = () => `/v1/doctors/${encodeURIComponent(config.doctorId)}`
const since = (s?: string) => (s ? `?since=${encodeURIComponent(s)}` : '')

export const api = {
  registerPublicKey: (publicKey: string) =>
    call<void>('doctor', config.doctorId, 'PUT', `${d()}/public-key`, { public_key: publicKey }),

  patients: async () => list(await call<CareLink[]>('doctor', config.doctorId, 'GET', `${d()}/patients`)),

  // Pages through ?since= (oldest first, max 100 per call).
  async envelopes(from?: string): Promise<DoctorEnvelope[]> {
    const out: DoctorEnvelope[] = []
    let cursor = from
    for (;;) {
      const page = list(await call<DoctorEnvelope[]>('doctor', config.doctorId, 'GET', `${d()}/envelopes${since(cursor)}`))
      out.push(...page)
      if (page.length < PAGE) return out
      cursor = page[page.length - 1].received_at
    }
  },

  ack: (envelopeId: string) =>
    call<void>('doctor', config.doctorId, 'POST', `${d()}/envelopes/${encodeURIComponent(envelopeId)}/ack`),

  async alerts(from?: string): Promise<AlertEvent[]> {
    const out: AlertEvent[] = []
    let cursor = from
    for (;;) {
      const page = list(await call<AlertEvent[]>('doctor', config.doctorId, 'GET', `${d()}/alerts${since(cursor)}`))
      out.push(...page)
      if (page.length < PAGE) return out
      cursor = page[page.length - 1].created_at
    }
  },

  caregiverAlerts: async () =>
    list(
      await call<CaregiverAlert[]>(
        'caregiver',
        config.caregiverId,
        'GET',
        `/v1/caregivers/${encodeURIComponent(config.caregiverId)}/alerts`,
      ),
    ),
}
