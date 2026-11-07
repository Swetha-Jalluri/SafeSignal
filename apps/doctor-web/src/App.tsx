import { config } from './lib/config'
import { db } from './lib/db'
import { resetKeyCache } from './lib/sync'
import { useDoctorData } from './lib/useDoctorData'
import { DoctorView } from './components/DoctorView'
import { DevPanel } from './dev/DevPanel'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="text-base font-semibold">Sentinel</div>
          {config.mock && <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">Mock service</span>}
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        <DoctorScreen />
      </main>
    </div>
  )
}

function DoctorScreen() {
  const data = useDoctorData()
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
        <span>
          {data.syncing ? 'Syncing…' : data.lastSync ? `Synced ${new Date(data.lastSync).toLocaleTimeString()}` : 'Not synced yet'}
        </span>
        <span>· Decrypted only in this browser</span>
        <button onClick={data.refresh} className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50">Sync now</button>
        <button
          onClick={async () => {
            if (!confirm('Wipe local doctor data AND the private key? Envelopes sealed to the old key can no longer be read.')) return
            await db.wipe()
            resetKeyCache()
            location.reload()
          }}
          className="rounded border border-slate-300 bg-white px-2 py-0.5 hover:bg-slate-50"
        >
          Reset local data
        </button>
        {data.error && <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">{data.error}</span>}
        {data.rejections.length > 0 && !config.mock && (
          <span className="rounded bg-red-50 px-2 py-0.5 text-red-700">{data.rejections.length} envelope(s) rejected</span>
        )}
      </div>
      {config.mock && <DevPanel onChange={data.refresh} rejections={data.rejections} />}
      <DoctorView data={data} />
    </>
  )
}
