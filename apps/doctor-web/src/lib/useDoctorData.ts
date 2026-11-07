import { useCallback, useEffect, useRef, useState } from 'react'
import { config } from './config'
import { db } from './db'
import { checkinDays, syncOnce, type CheckinDay, type Rejection } from './sync'
import type { DrAlert, DrPatient, DrTimelineEntry } from './types'

export interface PatientRow {
  patient_ref: string
  patient: DrPatient | null // null until the first envelope arrives
  entries: DrTimelineEntry[]
  days: CheckinDay[]
  unseenAlerts: number
}

export interface DoctorData {
  patients: PatientRow[] // active care links only (DR-02)
  noLongerShared: PatientRow[] // revoked: data kept in this browser, read-only (D-038)
  alerts: DrAlert[] // active links only
  rejections: Rejection[]
  lastSync: string | null
  error: string | null
  syncing: boolean
  refresh: () => Promise<void>
  markSeen: (alertId: string) => Promise<void>
}

const latestTrend = (r: PatientRow) => [...r.days].reverse().find((d) => d.status !== 'missed')?.trend

export function useDoctorData(): DoctorData {
  const [patients, setPatients] = useState<PatientRow[]>([])
  const [noLongerShared, setNoLongerShared] = useState<PatientRow[]>([])
  const [alerts, setAlerts] = useState<DrAlert[]>([])
  const [rejections, setRejections] = useState<Rejection[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const busy = useRef(false)
  // Active links from the last successful sync; null before the first one (then show what is stored).
  const linked = useRef<Set<string> | null>(null)

  const load = useCallback(async () => {
    const stored = new Map((await db.allPatients()).map((p) => [p.patient_ref, p]))
    const active = linked.current ?? new Set(stored.keys())
    const allAlerts = (await db.allAlerts()).sort((a, b) => b.created_at.localeCompare(a.created_at))

    const row = async (ref: string): Promise<PatientRow> => {
      const entries = await db.timelineFor(ref)
      return {
        patient_ref: ref,
        patient: stored.get(ref) ?? null,
        entries,
        days: checkinDays(entries),
        unseenAlerts: allAlerts.filter((a) => a.patient_ref === ref && !a.seen_at).length,
      }
    }
    const rows = await Promise.all([...active].map(row))
    const gone = await Promise.all([...stored.keys()].filter((r) => !active.has(r)).map(row))

    // Most urgent first: unseen severe alert, worsening trend, unseen alerts, then name.
    const severe = (r: PatientRow) => (allAlerts.some((a) => a.patient_ref === r.patient_ref && !a.seen_at && a.alert_type === 'severe') ? 1 : 0)
    const worse = (r: PatientRow) => (latestTrend(r) === 'worse' ? 1 : 0)
    const name = (r: PatientRow) => r.patient?.display_name ?? r.patient_ref
    rows.sort((a, b) => severe(b) - severe(a) || worse(b) - worse(a) || b.unseenAlerts - a.unseenAlerts || name(a).localeCompare(name(b)))

    setPatients(rows)
    setNoLongerShared(gone)
    setAlerts(allAlerts.filter((a) => active.has(a.patient_ref)))
  }, [])

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setSyncing(true)
    try {
      const r = await syncOnce()
      linked.current = new Set(r.linkedRefs)
      if (r.rejected.length) setRejections((prev) => [...prev, ...r.rejected].slice(-50))
      setLastSync(new Date().toISOString())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      await load()
      busy.current = false
      setSyncing(false)
    }
  }, [load])

  useEffect(() => {
    load().then(refresh)
    const t = setInterval(refresh, config.pollMs)
    return () => clearInterval(t)
  }, [load, refresh])

  return {
    patients,
    noLongerShared,
    alerts,
    rejections,
    lastSync,
    error,
    syncing,
    refresh,
    markSeen: async (id) => {
      await db.markAlertSeen(id)
      await load()
    },
  }
}
