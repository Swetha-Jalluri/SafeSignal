// Shapes from schema/doctor_payload.json, schema/doctor_view.sql and schema/openapi.json (source of truth).

export type Severity = 'mild' | 'moderate' | 'severe'
export type Onset = 'today' | '1_3_days' | '4_7_days' | 'over_7_days' | 'unknown'
export type Trend = 'better' | 'same' | 'worse' | 'unknown'
export type CheckinStatus = 'completed' | 'partial' | 'missed'
export type AlertType = 'missed' | 'severe'

export interface SymptomEntry {
  term_code: string
  severity: Severity
  onset: Onset
  known_side_effect: boolean
  possible_link_flag: boolean
}

// Plaintext inside a doctor envelope (schema/doctor_payload.json)
export interface DoctorPayload {
  schema_version: string
  patient_ref: string
  display_name: string
  drug_name: string
  drug_version: string
  checkin_date: string
  status: CheckinStatus
  trend: Trend
  symptoms: SymptomEntry[]
}

import type { components } from '@sentinel/contract/api'

// GET /v1/doctors/{id}/envelopes · /alerts · /patients · /caregivers/{id}/alerts
export type DoctorEnvelope = components['schemas']['Envelope']
export type AlertEvent = components['schemas']['DoctorAlert']
export type CaregiverAlert = components['schemas']['CaregiverAlert']
export type CareLink = components['schemas']['LinkedPatient']

// IndexedDB stores matching schema/doctor_view.sql
export interface DrPatient {
  patient_ref: string
  display_name: string
  drug_name: string
  drug_version: string
  last_checkin: string | null
}

export interface DrTimelineEntry {
  entry_id: string // '<envelope_id>:<term_code>' (D-038)
  patient_ref: string
  envelope_id: string
  checkin_date: string
  status: CheckinStatus
  term_code: string
  severity: Severity
  onset: Onset
  known_side_effect: 0 | 1
  possible_link_flag: 0 | 1
  trend: Trend
}

export interface DrAlert {
  alert_id: string
  patient_ref: string
  alert_type: AlertType
  created_at: string
  seen_at: string | null
}
