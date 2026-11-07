// DR-01: one-screen timeline — symptoms by date (grid), severity trend (chart), flags.
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { DrTimelineEntry } from '../lib/types'
import type { CheckinDay } from '../lib/sync'
import { ONSET_LABELS, SEVERITY_RANK, termLabel } from '../lib/terms'

const DAYS = 21
const SEV_CLASS = { mild: 'bg-amber-200', moderate: 'bg-orange-400', severe: 'bg-red-600' } as const

function dateRange(endIso: string, n: number): string[] {
  const end = new Date(endIso + 'T00:00:00Z')
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(end.getUTCDate() - (n - 1 - i))
    return d.toISOString().slice(0, 10)
  })
}

const short = (iso: string) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function Timeline({ entries, days }: { entries: DrTimelineEntry[]; days: CheckinDay[] }) {
  const today = new Date().toISOString().slice(0, 10)
  const dates = dateRange(today, DAYS)
  const dayByDate = new Map(days.map((d) => [d.date, d]))
  const byTermDate = new Map<string, DrTimelineEntry>()
  for (const e of entries) {
    const k = `${e.term_code}|${e.checkin_date}`
    const prev = byTermDate.get(k)
    if (!prev || SEVERITY_RANK[e.severity] > SEVERITY_RANK[prev.severity]) byTermDate.set(k, e)
  }
  const terms = [...new Set(entries.filter((e) => dates.includes(e.checkin_date)).map((e) => e.term_code))].sort(
    (a, b) => termLabel(a).localeCompare(termLabel(b)),
  )

  // Highest severity per day; null on missed / no check-in so the line shows a gap.
  const chart = dates.map((date) => {
    const day = dayByDate.get(date)
    const sev = entries.filter((e) => e.checkin_date === date).reduce((m, e) => Math.max(m, SEVERITY_RANK[e.severity]), 0)
    return { date: short(date), severity: !day || day.status === 'missed' ? null : sev }
  })

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-medium text-slate-500">Symptom</th>
              {dates.map((d) => (
                <th key={d} className="px-0.5 py-2 font-normal text-slate-400" title={d}>
                  <span className="block whitespace-nowrap [writing-mode:vertical-rl] rotate-180">{short(d)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="sticky left-0 z-10 bg-white px-3 py-1.5 text-slate-500">Symptom report</td>
              {dates.map((d) => {
                const day = dayByDate.get(d)
                const cls = !day ? 'bg-slate-50' : day.status === 'missed' ? 'bg-slate-300' : day.status === 'partial' ? 'bg-sky-200' : 'bg-sky-500'
                return (
                  <td key={d} className="px-0.5 py-1.5">
                    <div className={`mx-auto h-4 w-4 rounded-sm ${cls}`} title={day ? `${d}: ${day.status}` : `${d}: no symptom report`} />
                  </td>
                )
              })}
            </tr>
            {terms.map((t) => (
              <tr key={t} className="border-t border-slate-100">
                <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-slate-700">{termLabel(t)}</td>
                {dates.map((d) => {
                  const e = byTermDate.get(`${t}|${d}`)
                  return (
                    <td key={d} className="px-0.5 py-1.5">
                      {e ? (
                        <div
                          className={`relative mx-auto h-4 w-4 rounded-sm ${SEV_CLASS[e.severity]} ${e.known_side_effect ? '' : 'ring-2 ring-violet-600'}`}
                          title={`${termLabel(t)} · ${e.severity} · onset ${ONSET_LABELS[e.onset]}${e.known_side_effect ? '' : ' · not on label'}${e.possible_link_flag ? ' · possible link, for review' : ''}`}
                        >
                          {e.possible_link_flag ? <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-violet-600" /> : null}
                        </div>
                      ) : (
                        <div className="mx-auto h-4 w-4" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
            {terms.length === 0 && (
              <tr>
                <td colSpan={DAYS + 1} className="px-3 py-4 text-slate-500">No symptoms reported in the last {DAYS} days.</td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
          <Legend cls="bg-amber-200" label="Mild" />
          <Legend cls="bg-orange-400" label="Moderate" />
          <Legend cls="bg-red-600" label="Severe" />
          <Legend cls="bg-sky-500" label="Symptom report" />
          <Legend cls="bg-white ring-2 ring-violet-600" label="Not on drug label" />
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-600" /> Possible link, for review</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-1 text-xs font-medium text-slate-500">Highest severity per day (gaps = no symptom report that day)</div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={2} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} tickFormatter={(v) => ['None', 'Mild', 'Mod', 'Severe'][v]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={56} />
              <Tooltip formatter={(v) => ['None', 'Mild', 'Moderate', 'Severe'][Number(v)]} labelStyle={{ fontSize: 12 }} contentStyle={{ fontSize: 12 }} />
              <Line type="stepAfter" dataKey="severity" stroke="#ea580c" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`h-3 w-3 rounded-sm ${cls}`} /> {label}
    </span>
  )
}
