// Doctor key pair and sealed-box decryption (Section 26.13).
// Base64 is the STANDARD alphabet with padding to match Python's base64 / PyNaCl;
// libsodium-wrappers defaults to URL-safe without padding, so the variant is always explicit.
import sodium from 'libsodium-wrappers'

export interface KeyPair {
  publicKey: string // base64 ORIGINAL
  privateKey: string // base64 ORIGINAL, never leaves IndexedDB
}

const B64 = () => sodium.base64_variants.ORIGINAL

export async function ready(): Promise<void> {
  await sodium.ready
}

export async function generateKeyPair(): Promise<KeyPair> {
  await sodium.ready
  const kp = sodium.crypto_box_keypair()
  return {
    publicKey: sodium.to_base64(kp.publicKey, B64()),
    privateKey: sodium.to_base64(kp.privateKey, B64()),
  }
}

export async function openSealed(ciphertextB64: string, kp: KeyPair): Promise<string> {
  await sodium.ready
  const plain = sodium.crypto_box_seal_open(
    sodium.from_base64(ciphertextB64, B64()),
    sodium.from_base64(kp.publicKey, B64()),
    sodium.from_base64(kp.privateKey, B64()),
  )
  return sodium.to_string(plain)
}

// Used only by the mock server / test-envelope generator to stand in for the patient device.
export async function seal(plaintext: string, publicKeyB64: string): Promise<string> {
  await sodium.ready
  const ct = sodium.crypto_box_seal(sodium.from_string(plaintext), sodium.from_base64(publicKeyB64, B64()))
  return sodium.to_base64(ct, B64())
}
