import { useEffect, useRef, useState } from 'react'
import { addCapture, type Capture } from './db'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type CaptureSettings } from './captureSettings'

type Props = { tomeId: string; onCaptured: (c: Capture) => void }

const SAMPLE_W = 64
const SAMPLE_H = 48
const TICK_MS = 100
const JPEG_QUALITY = 0.9

export default function CaptureView({ tomeId, onCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [diff, setDiff] = useState(0)
  const [armed, setArmed] = useState(false)
  const [auto, setAuto] = useState(true)
  const [settings, setSettings] = useState<CaptureSettings>(loadSettings)

  // The motion loop reads these on every frame without restarting
  const autoRef = useRef(auto)
  const settingsRef = useRef(settings)
  const onCapturedRef = useRef(onCaptured)
  useEffect(() => {
    autoRef.current = auto
    settingsRef.current = settings
    onCapturedRef.current = onCaptured
  })

  const audioRef = useRef<AudioContext | null>(null)
  const busyRef = useRef(false)
  const captureRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    captureRef.current = async () => {
      const video = videoRef.current
      if (!video || busyRef.current) return
      busyRef.current = true
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d')!.drawImage(video, 0, 0)
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', JPEG_QUALITY))
        if (!blob) throw new Error('Encodage JPEG impossible')
        const capture = await addCapture(tomeId, blob, canvas.width, canvas.height)
        beep(audioRef.current)
        onCapturedRef.current(capture)
      } catch (err) {
        setError(`Capture échouée : ${(err as Error).message}`)
      } finally {
        busyRef.current = false
      }
    }
  })

  useEffect(() => {
    if (!running) return
    const video = videoRef.current!
    let stream: MediaStream | undefined
    let wakeLock: WakeLockSentinel | undefined
    let raf = 0
    let cancelled = false

    const sample = document.createElement('canvas')
    sample.width = SAMPLE_W
    sample.height = SAMPLE_H
    const ctx = sample.getContext('2d', { willReadFrequently: true })!
    let prev: Float32Array | null = null
    let lastTick = 0
    let stillSince = 0
    let isArmed = false

    function tick(t: number) {
      raf = requestAnimationFrame(tick)
      if (t - lastTick < TICK_MS || video.readyState < 2) return
      lastTick = t
      ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H)
      const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
      const gray = new Float32Array(SAMPLE_W * SAMPLE_H)
      for (let i = 0; i < gray.length; i++) gray[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3
      if (!prev) {
        prev = gray
        return
      }
      let sum = 0
      for (let i = 0; i < gray.length; i++) sum += Math.abs(gray[i] - prev[i])
      prev = gray
      const d = sum / gray.length
      setDiff(d)

      // Capture only after a real movement followed by a still pause, then lock until the next
      // movement: a long pause on the same double page never yields a duplicate
      const s = settingsRef.current
      if (d > s.seuilMouvement) {
        isArmed = true
        stillSince = 0
      } else if (d >= s.seuilStable) {
        stillSince = 0
      } else {
        if (!stillSince) stillSince = t
        if (autoRef.current && isArmed && t - stillSince >= s.stableMs) {
          isArmed = false
          captureRef.current()
        }
      }
      setArmed(isArmed)
    }

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 3072 } },
        })
        if (cancelled) return stream.getTracks().forEach((tr) => tr.stop())
        video.srcObject = stream
        await video.play()
        // Screen sleep would cut the camera mid-book; best effort, not supported everywhere
        wakeLock = await navigator.wakeLock?.request('screen').catch(() => undefined)
        raf = requestAnimationFrame(tick)
      } catch (err) {
        setError(`Caméra indisponible : ${(err as Error).message}`)
        setRunning(false)
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((tr) => tr.stop())
      wakeLock?.release().catch(() => {})
    }
  }, [running])

  function start() {
    // iOS only allows audio once a user gesture has created the context
    audioRef.current ??= new AudioContext()
    setError('')
    setRunning(true)
  }

  function updateSettings(patch: Partial<CaptureSettings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  return (
    <section className="capture">
      <div className="viewer">
        <video ref={videoRef} playsInline muted />
        {running && <div className="crease" />}
        {!running && (
          <button className="primary viewer-start" onClick={start}>
            Démarrer la caméra
          </button>
        )}
      </div>

      {running && (
        <>
          <div className="row capture-controls">
            <button className="primary" onClick={() => captureRef.current()}>Capturer</button>
            <label className="toggle">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              Capture auto
            </label>
            <button onClick={() => setRunning(false)}>Arrêter</button>
          </div>
          <div className={`meter ${diff < settings.seuilStable ? 'still' : ''}`}>
            <div style={{ transform: `scaleX(${Math.min(1, diff / 25)})` }} />
          </div>
          <p className="muted small">
            Mouvement {diff.toFixed(1)} · {armed ? 'prêt à capturer' : 'en attente de mouvement'}
          </p>
        </>
      )}
      {error && <p className="error">{error}</p>}

      <details className="settings">
        <summary>Réglages capture</summary>
        <label>
          Seuil mouvement
          <input
            type="number"
            step="1"
            value={settings.seuilMouvement}
            onChange={(e) => updateSettings({ seuilMouvement: Number(e.target.value) })}
          />
        </label>
        <label>
          Seuil stable
          <input
            type="number"
            step="0.5"
            value={settings.seuilStable}
            onChange={(e) => updateSettings({ seuilStable: Number(e.target.value) })}
          />
        </label>
        <label>
          Stable (ms)
          <input
            type="number"
            step="100"
            value={settings.stableMs}
            onChange={(e) => updateSettings({ stableMs: Number(e.target.value) })}
          />
        </label>
        <p className="muted small">
          Mouvement actuel : {running ? diff.toFixed(1) : '—'}. Au repos il doit rester sous le seuil stable, en
          tournant une page il doit dépasser le seuil mouvement.
        </p>
        <button
          onClick={() => {
            setSettings(DEFAULT_SETTINGS)
            saveSettings(DEFAULT_SETTINGS)
          }}
        >
          Valeurs par défaut
        </button>
      </details>
    </section>
  )
}

function beep(audio: AudioContext | null) {
  if (!audio) return
  const osc = audio.createOscillator()
  osc.connect(audio.destination)
  osc.frequency.value = 880
  osc.start()
  osc.stop(audio.currentTime + 0.08)
}
