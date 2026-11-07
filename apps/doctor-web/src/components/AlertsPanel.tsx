// DR-03: missed check-in and severe-symptom alerts.
import type { DrAlert } from '../lib/types'

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

export function AlertBadge({ type }: { type: DrAlert['alert_type'] }) {
  return type === 'severe' ? (
    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">Severe</span>
  ) : (
    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700">Missed</span>
  )
}

export function AlertsPanel(props: {
  alerts: DrAlert[]
  nameOf: (ref: string) => string
  onSeen: (id: string) => void
  onOpen?: (ref: string) => void
}) {
  const unseen = props.alerts.filter((a) => !a.seen_at).length
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <h2 className="text-sm font-semibold text-slate-800">Alerts</h2>
        <span className="text-xs text-slate-500">{unseen} new</span>
      </header>
      <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
        {props.alerts.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No alerts.</li>}
        {props.alerts.map((a) => (
          <li key={a.alert_id} className={`flex items-center gap-3 px-4 py-2.5 ${a.seen_at ? 'opacity-60' : ''}`}>
            <AlertBadge type={a.alert_type} />
            <button className="min-w-0 flex-1 text-left" onClick={() => props.onOpen?.(a.patient_ref)}>
              <div className="truncate text-sm font-medium text-slate-800">{props.nameOf(a.patient_ref)}</div>
              <div className="text-xs text-slate-500">
                {a.alert_type === 'severe' ? 'Severe symptom reported' : 'Check-in missed'} · {fmtTime(a.created_at)}
              </div>
            </button>
            {!a.seen_at && (
              <button onClick={() => props.onSeen(a.alert_id)} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50">
                Mark seen
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
