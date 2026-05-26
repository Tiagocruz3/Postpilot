const encoder = new TextEncoder()

async function getKey(): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(Deno.env.get('INTEGRATION_ENCRYPTION_KEY')!), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encrypt(text: string): Promise<{ ciphertext: string; iv: string }> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text))
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  }
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const key = await getKey()
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0))
  const data = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, data)
  return new TextDecoder().decode(decrypted)
}
