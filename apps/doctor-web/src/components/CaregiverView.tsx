// Caregiver alerts (AL-03): what happened and when, no symptom details. Reads only its own alert endpoint.
import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { config } from '../lib/config'
import type { CaregiverAlert } from '../lib/types'
import { AlertBadge, fmtTime } from './AlertsPanel'

// The caregiver already knows who they care for (Section 9.6); the name is local display config, not from the service.
const PATIENT_LABEL = config.caregiverPatientLabel

export function CaregiverView() {
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const a = await api.caregiverAlerts()
      setAlerts([...a].sort((x, y) => y.created_at.localeCompare(x.created_at)))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, config.pollMs)
    return () => clearInterval(t)
  }, [load])

  const latest = alerts[0]
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className={`rounded-xl p-6 ${latest?.alert_type === 'severe' ? 'bg-red-50 ring-1 ring-red-200' : 'bg-white ring-1 ring-slate-200'}`}>
        <div className="text-sm text-slate-500">Caring for</div>
        <div className="text-2xl font-semibold text-slate-900">{PATIENT_LABEL}</div>
        <div className="mt-3 text-lg text-slate-800">
          {!latest
            ? 'No alerts. Check-ins are on track.'
            : latest.alert_type === 'severe'
              ? `${PATIENT_LABEL} reported a severe symptom · ${fmtTime(latest.created_at)}`
              : `${PATIENT_LABEL} missed a check-in · ${fmtTime(latest.created_at)}`}
        </div>
        <p className="mt-2 text-xs text-slate-500">You see alerts only. Health details stay on {PATIENT_LABEL}'s device unless they choose to share more.</p>
      </div>
      {error && <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">{error}</div>}
      <ul className="divide-y divide-slate-100 rounded-lg bg-white ring-1 ring-slate-200">
        {alerts.map((a) => (
          <li key={a.alert_id} className="flex items-center gap-3 px-4 py-3">
            <AlertBadge type={a.alert_type} />
            <span className="flex-1 text-sm text-slate-700">{a.alert_type === 'severe' ? 'Severe symptom reported' : 'Check-in missed'}</span>
            <span className="text-xs text-slate-500">{fmtTime(a.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
