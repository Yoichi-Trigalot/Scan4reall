export type CaptureSettings = {
  // Mean pixel difference between frames that counts as a page being turned
  seuilMouvement: number
  // Below this difference the image is considered still
  seuilStable: number
  // How long the image must stay still before capturing
  stableMs: number
}

// Measured during the spike: still ~2.5, page turn ~24
export const DEFAULT_SETTINGS: CaptureSettings = { seuilMouvement: 12, seuilStable: 3.5, stableMs: 200 }

const KEY = 'scan4reall.captureSettings'

// Per-device convenience: if storage is unavailable or purged, defaults apply
export function loadSettings(): CaptureSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: CaptureSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // Not persisted: settings still apply for this session
  }
}
