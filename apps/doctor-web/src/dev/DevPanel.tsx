// Mock-mode only: simulate patient-side events to rehearse the doctor and caregiver views.
import { useState } from 'react'
import { mockServer } from './mockServer'
import type { Rejection } from '../lib/sync'

export function DevPanel({ onChange, rejections }: { onChange: () => void; rejections: Rejection[] }) {
  const [, force] = useState(0)
  const run = async (fn: () => unknown) => {
    await fn()
    force((n) => n + 1)
    onChange()
  }
  const walter = 'pt_4b82d0c6'
  return (
    <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50 p-3 text-xs text-violet-900">
      <div className="mb-2 font-semibold">Mock service (synthetic data) — simulate patient events</div>
      <div className="flex flex-wrap gap-2">
        <Btn onClick={() => run(() => mockServer.dev.checkin(walter, 'moderate'))}>Walter check-in (moderate rash)</Btn>
        <Btn onClick={() => run(() => mockServer.dev.checkin(walter, 'severe'))}>Walter severe symptom</Btn>
        <Btn onClick={() => run(() => mockServer.dev.missed(walter))}>Walter missed check-in</Btn>
        <Btn onClick={() => run(() => mockServer.dev.tamper(walter))}>Tampered envelope (bad hash)</Btn>
        {mockServer.dev.patients.map((p) => (
          <Btn key={p.ref} onClick={() => run(() => mockServer.dev.toggleLink(p.ref))}>
            {mockServer.dev.isLinked(p.ref) ? 'Revoke' : 'Grant'} consent: {p.name}
          </Btn>
        ))}
      </div>
      {rejections.length > 0 && (
        <div className="mt-2">
          Rejected envelopes: {rejections.slice(-3).map((r) => `${r.envelope_id} (${r.reason})`).join('; ')}
        </div>
      )}
    </div>
  )
}

function Btn(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={props.onClick} className="rounded border border-violet-300 bg-white px-2 py-1 hover:bg-violet-100">
      {props.children}
    </button>
  )
}
