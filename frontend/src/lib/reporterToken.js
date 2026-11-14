// Zero-login identity + HTTP-LAN-safe UUID generator.
//
// Important mobile gotcha:
// `crypto.randomUUID()` ONLY exists in "Secure Contexts" (HTTPS or localhost).
// When you open the dev server on your phone via Wi-Fi/hotspot (e.g.
// http://172.20.10.4:5173), `window.isSecureContext` is false, so calling
// `crypto.randomUUID()` throws a TypeError and crashes React to a blank screen!
// `crypto.getRandomValues()` works on ALL contexts, so we fall back to it.

const STORAGE_KEY = 'naijapulse_device_token'
let memoryFallbackToken = null

export function safeUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function getReporterToken() {
  try {
    let token = localStorage.getItem(STORAGE_KEY)
    if (!token) {
      token = safeUUID()
      localStorage.setItem(STORAGE_KEY, token)
    }
    return token
  } catch {
    // Safari Private Browsing or strict WebViews may block localStorage
    if (!memoryFallbackToken) memoryFallbackToken = safeUUID()
    return memoryFallbackToken
  }
}
