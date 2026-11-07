// Doctor-side contract check (Node >= 23 strips TS types).
//   node scripts/parity.ts                                  → schema/examples/hash_vectors.json through @sentinel/contract
//   node scripts/parity.ts keygen <kp.json>                 → doctor key pair, for sealing tests from Python
//   node scripts/parity.ts verify <vectors.json> <kp.json>  → decrypt Python-sealed envelopes [{payload, sha256, ciphertext}]
import { readFileSync, writeFileSync } from 'node:fs'
import { canonical, payloadSha256 } from '@sentinel/contract'
import { generateKeyPair, openSealed } from '../src/lib/crypto.ts'

const [cmd, a, b] = process.argv.slice(2)

async function hashVectors() {
  const file = new URL('../../../schema/examples/hash_vectors.json', import.meta.url)
  const { vectors } = JSON.parse(readFileSync(file, 'utf8')) as { vectors: { name: string; input: unknown; canonical: string; sha256: string }[] }
  let failed = 0
  for (const v of vectors) {
    const ok = canonical(v.input) === v.canonical && (await payloadSha256(v.input)) === v.sha256
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${v.name}`)
    failed += ok ? 0 : 1
  }
  return [vectors.length - failed, vectors.length]
}

async function sealed(vectorsPath: string, kpPath: string) {
  const vectors = JSON.parse(readFileSync(vectorsPath, 'utf8')) as { payload: unknown; sha256: string; ciphertext: string }[]
  const kp = JSON.parse(readFileSync(kpPath, 'utf8'))
  let failed = 0
  for (const [i, v] of vectors.entries()) {
    const plain = JSON.parse(await openSealed(v.ciphertext, kp))
    const ok = (await payloadSha256(plain)) === v.sha256 && (await payloadSha256(v.payload)) === v.sha256
    console.log(`${ok ? 'ok  ' : 'FAIL'} sealed vector ${i}`)
    failed += ok ? 0 : 1
  }
  return [vectors.length - failed, vectors.length]
}

if (cmd === 'keygen') {
  writeFileSync(a, JSON.stringify(await generateKeyPair(), null, 2))
  console.log(`wrote ${a}`)
} else {
  const [pass, total] = cmd === 'verify' ? await sealed(a, b) : await hashVectors()
  console.log(`${pass}/${total} passed`)
  process.exit(pass === total ? 0 : 1)
}
