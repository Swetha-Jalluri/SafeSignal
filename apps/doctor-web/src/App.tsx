import { useEffect, useState } from 'react'
import { config } from './lib/config'
import { db } from './lib/db'
import { resetKeyCache } from './lib/sync'
import { useDoctorData } from './lib/useDoctorData'
import { DoctorView } from './components/DoctorView'
import { CaregiverView } from './components/CaregiverView'
import { DevPanel } from './dev/DevPanel'

type Route = 'doctor' | 'caregiver'
const routeFromHash = (): Route => (location.hash === '#/caregiver' ? 'caregiver' : 'doctor')

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromHash)
  useEffect(() => {
    const on = () => setRoute(routeFromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
          <div className="text-base font-semibold">Sentinel</div>
          <nav className="flex gap-1 text-sm">
            <Tab href="#/" active={route === 'doctor'}>Doctor</Tab>
            <Tab href="#/caregiver" active={route === 'caregiver'}>Caregiver</Tab>
          </nav>
          {config.mock && <span className="rounded bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">Mock service</span>}
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {route === 'doctor' ? <DoctorScreen /> : <CaregiverView />}
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

function Tab(props: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a href={props.href} className={`rounded px-3 py-1 ${props.active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
      {props.children}
    </a>
  )
}
