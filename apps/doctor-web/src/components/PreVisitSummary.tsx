// DR-04: pre-visit summary built by templates from structured records only (no model, no cloud).
// Every sentence is traceable to stored fields; links are worded "for review", never as a cause.
import type { DrAlert, DrPatient, DrTimelineEntry } from '../lib/types'
import type { CheckinDay } from '../lib/sync'
import { ONSET_LABELS, termLabel } from '../lib/terms'

const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]

export function buildSummary(p: DrPatient, days: CheckinDay[], entries: DrTimelineEntry[], alerts: DrAlert[]): string[] {
  // `days` holds only check-ins that reported symptoms (doctor_view.sql has no row for symptom-free or missed days).
  const out: string[] = []
  const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10)
  const recent = days.filter((d) => d.date >= since)
  out.push(
    `${p.display_name} is on ${p.drug_name} (${p.drug_version}). Last check-in ${p.last_checkin ?? 'not yet received'}; ` +
      `${recent.length} check-in${recent.length === 1 ? '' : 's'} with symptoms in the last 21 days.`,
  )

  const lastDay = days[days.length - 1]
  if (p.last_checkin && (!lastDay || p.last_checkin > lastDay.date)) {
    out.push(`No symptoms reported at the last check-in (${p.last_checkin}).`)
  } else if (lastDay) {
    const latest = entries.filter((e) => e.checkin_date === lastDay.date)
    out.push(`At the last check-in (${lastDay.date}) reported: ${list(latest.map((e) => `${termLabel(e.term_code).toLowerCase()} (${e.severity}, onset ${ONSET_LABELS[e.onset]})`))}.`)
  }
  const last3 = days.slice(-3).map((d) => d.trend)
  if (last3.length > 1) out.push(`Patient-reported trend over the last ${last3.length} symptom reports: ${last3.join(' → ')}.`)

  const linked = [...new Set(entries.filter((e) => e.possible_link_flag).map((e) => termLabel(e.term_code).toLowerCase()))]
  if (linked.length) out.push(`For review: ${list(linked)} flagged as a possible link to a new exposure. This is a flag, not a cause.`)

  const unlisted = [...new Set(entries.filter((e) => !e.known_side_effect).map((e) => termLabel(e.term_code).toLowerCase()))]
  if (unlisted.length) out.push(`Not on the drug label: ${list(unlisted)}.`)

  const severe = alerts.filter((a) => a.alert_type === 'severe').length
  const missedAlerts = alerts.filter((a) => a.alert_type === 'missed').length
  if (severe || missedAlerts) out.push(`Alerts on record: ${severe} severe-symptom, ${missedAlerts} missed check-in.`)
  return out
}

export function PreVisitSummary(props: { patient: DrPatient; days: CheckinDay[]; entries: DrTimelineEntry[]; alerts: DrAlert[] }) {
  const lines = buildSummary(props.patient, props.days, props.entries, props.alerts)
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Pre-visit summary</h3>
        <span className="text-[11px] text-slate-400">Generated from structured check-ins · not medical advice</span>
      </div>
      <ul className="space-y-1.5 text-sm text-slate-700">
        {lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
    </div>
  )
}
