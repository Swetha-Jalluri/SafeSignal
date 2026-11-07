// DR-02: only actively consented patients are listed; revoked ones sit in a collapsed "no longer shared" list
// with their already-decrypted data kept read-only (D-038). Detail = summary + timeline; alerts on the right.
import { useEffect, useState } from 'react'
import type { DoctorData, PatientRow } from '../lib/useDoctorData'
import type { Trend } from '../lib/types'
import { Timeline } from './Timeline'
import { PreVisitSummary } from './PreVisitSummary'
import { AlertsPanel } from './AlertsPanel'

const TREND_STYLE: Record<Trend, string> = {
  worse: 'text-red-700 bg-red-50',
  same: 'text-slate-600 bg-slate-100',
  better: 'text-emerald-700 bg-emerald-50',
  unknown: 'text-slate-500 bg-slate-100',
}

const latestTrend = (r: PatientRow): Trend => [...r.days].reverse().find((d) => d.status !== 'missed')?.trend ?? 'unknown'

export function DoctorView({ data }: { data: DoctorData }) {
  const [picked, setPicked] = useState<string | null>(null) // set only by the doctor's click
  const [showGone, setShowGone] = useState(false)
  // Until the doctor picks someone, follow the most urgent patient (the list is sorted by urgency).
  const selected = picked ?? data.patients[0]?.patient_ref ?? null
  const setSelected = setPicked
  const active = data.patients.find((p) => p.patient_ref === selected)
  const revoked = data.noLongerShared.find((p) => p.patient_ref === selected)
  const row = active ?? revoked ?? null
  const nameOf = (ref: string) => data.patients.find((p) => p.patient_ref === ref)?.patient?.display_name ?? ref

  // A picked patient who disappears entirely (no data, no link) falls back to following.
  useEffect(() => {
    if (picked && !row) setPicked(null)
  }, [picked, row])

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr_300px]">
      <section className="self-start rounded-lg border border-slate-200 bg-white">
        <header className="border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-800">Patients sharing with you</h2>
        </header>
        <ul className="divide-y divide-slate-100">
          {data.patients.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No patients are sharing with you.</li>}
          {data.patients.map((r) => (
            <PatientItem key={r.patient_ref} r={r} selected={selected === r.patient_ref} onClick={() => setSelected(r.patient_ref)} />
          ))}
        </ul>
        {data.noLongerShared.length > 0 && (
          <div className="border-t border-slate-200">
            <button onClick={() => setShowGone((v) => !v)} className="w-full px-4 py-2 text-left text-xs text-slate-500 hover:bg-slate-50">
              {showGone ? '▾' : '▸'} No longer shared ({data.noLongerShared.length})
            </button>
            {showGone && (
              <ul className="divide-y divide-slate-100 opacity-70">
                {data.noLongerShared.map((r) => (
                  <PatientItem key={r.patient_ref} r={r} selected={selected === r.patient_ref} onClick={() => setSelected(r.patient_ref)} />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="min-w-0 space-y-4">
        {revoked && (
          <div className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700">
            This patient stopped sharing with you. You are seeing data received before that; no new check-ins will arrive.
          </div>
        )}
        {row?.patient ? (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-semibold text-slate-900">{row.patient.display_name}</h1>
              <span className="text-sm text-slate-600">{row.patient.drug_name} · version {row.patient.drug_version}</span>
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${TREND_STYLE[latestTrend(row)]}`}>Trend: {latestTrend(row)}</span>
              <span className="text-xs text-slate-400">Last check-in {row.patient.last_checkin ?? '—'}</span>
            </div>
            <PreVisitSummary patient={row.patient} days={row.days} entries={row.entries} alerts={data.alerts.filter((a) => a.patient_ref === row.patient_ref)} />
            <Timeline entries={row.entries} days={row.days} />
          </>
        ) : row ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            Consent is active for {row.patient_ref}, but no check-in has been received yet.
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-500">Select a patient.</div>
        )}
      </section>

      <AlertsPanel alerts={data.alerts} nameOf={nameOf} onSeen={data.markSeen} onOpen={setSelected} />
    </div>
  )
}

function PatientItem({ r, selected, onClick }: { r: PatientRow; selected: boolean; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className={`flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-50 ${selected ? 'bg-sky-50' : ''}`}>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-800">{r.patient?.display_name ?? 'Awaiting first check-in'}</div>
          <div className="truncate text-xs text-slate-500">
            {r.patient ? `${r.patient.drug_name} ${r.patient.drug_version} · last ${r.patient.last_checkin ?? '—'}` : r.patient_ref}
          </div>
        </div>
        {r.patient && <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TREND_STYLE[latestTrend(r)]}`}>{latestTrend(r)}</span>}
        {r.unseenAlerts > 0 && <span className="rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">{r.unseenAlerts}</span>}
      </button>
    </li>
  )
}
