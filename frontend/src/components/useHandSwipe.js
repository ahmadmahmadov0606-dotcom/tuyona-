import { useCallback, useEffect, useRef, useState } from 'react'

// MediaPipe аз CDN бор мешавад (бе вобастагии npm) — танҳо вақте ки корбар камераро фаъол кард, як бор.
const MP_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14'
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

const WINDOW_MS = 220 // суръат дар ҳамин фосила ҳисоб мешавад
const MIN_DIST = 0.25 // ҳадди ақал ¼ паҳнои кадр
const MIN_DT = 60 // ҳаракати хеле кӯтоҳ (як-ду кадр) — садо
const COOLDOWN_MS = 600 // як жест = як слайд
const FRAME_GAP_MS = 40 // ~25 кадр/с барои модел — UI озод мемонад
const PALM = [0, 5, 9, 13, 17] // мич ва асоси ангуштон — маркази каф

let landmarkerPromise = null
function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import(/* @vite-ignore */ `${MP_BASE}/vision_bundle.mjs`)
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`)
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
      })
      try { return await vision.HandLandmarker.createFromOptions(fileset, options('GPU')) }
      catch { return vision.HandLandmarker.createFromOptions(fileset, options('CPU')) }
    })().catch((e) => { landmarkerPromise = null; throw Object.assign(e, { model: true }) })
  }
  return landmarkerPromise
}

function errorText(e) {
  if (e?.model) return 'Модели шинохтани даст бор нашуд. Интернетро санҷед.'
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return 'Иҷозати камера дода нашуд. Слайдер бо тугмаҳо кор мекунад.'
  if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') return 'Камера ёфт нашуд.'
  if (e?.name === 'NotReadableError') return 'Камера дар барномаи дигар банд аст.'
  if (e?.name === 'NotSupported') return 'Ин браузер камераро дастгирӣ намекунад.'
  return 'Камераро фаъол кардан нашуд.'
}

/**
 * Идоракунии слайдер бо ҳаракати даст (swipe) аз рӯи веб-камера.
 * onSwipe('left' | 'right') — ҷиҳат аз нигоҳи корбар (тасвир оинавӣ).
 * paused — коркарди кадрҳоро муваққатан қатъ мекунад (масалан, бахш берун аз экран).
 */
export default function useHandSwipe({ onSwipe, paused = false }) {
  const [status, setStatus] = useState('off') // off | loading | on | error
  const [error, setError] = useState('')
  const [hand, setHand] = useState(false)
  const [swipe, setSwipe] = useState(null) // { dir, id } — барои тирчаи ишоратӣ
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const onSwipeRef = useRef(onSwipe)
  const runId = useRef(0)
  onSwipeRef.current = onSwipe

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setHand(false)
  }, [])

  const stop = useCallback(() => {
    runId.current++
    release()
    setStatus('off')
  }, [release])

  const start = useCallback(async () => {
    const id = ++runId.current
    setStatus('loading'); setError('')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('no camera api'), { name: 'NotSupported' })
      // Потокро фавран нигоҳ медорем, то агар модел бор нашавад, камера бештар фаъол намонад
      const camera = navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' }, audio: false })
        .then((s) => { if (id === runId.current) streamRef.current = s; else s.getTracks().forEach((t) => t.stop()); return s })
      const [stream, landmarker] = await Promise.all([camera, loadLandmarker()])
      if (id !== runId.current) return
      landmarkerRef.current = landmarker
      const v = videoRef.current
      v.srcObject = stream
      await v.play()
      if (id === runId.current) setStatus('on')
    } catch (e) {
      if (id !== runId.current) return
      release()
      setError(errorText(e))
      setStatus('error')
    }
  }, [release])

  const toggle = useCallback(() => (status === 'on' || status === 'loading' ? stop() : start()), [status, start, stop])

  // Ҳалқаи коркард: rAF, вале модел на зиёда аз ~25 кадр/с ва танҳо барои кадри нав
  useEffect(() => {
    if (status !== 'on' || paused) return undefined
    const history = []
    let raf = 0
    let lastRun = 0
    let lastVideoTime = -1
    let cooldownUntil = 0
    let handSeen = false
    let swipeId = 0
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const v = videoRef.current
      const lm = landmarkerRef.current
      if (!v || !lm || v.readyState < 2 || now - lastRun < FRAME_GAP_MS || v.currentTime === lastVideoTime) return
      lastRun = now
      lastVideoTime = v.currentTime
      let res
      try { res = lm.detectForVideo(v, now) } catch { return }
      const pts = res?.landmarks?.[0]
      if (!!pts !== handSeen) { handSeen = !!pts; setHand(handSeen) }
      if (!pts) { history.length = 0; return }
      // Тасвир оинавӣ: x = 1 − x, то «чап» барои корбар чап бошад
      const x = 1 - PALM.reduce((s, i) => s + pts[i].x, 0) / PALM.length
      history.push({ t: now, x })
      while (history.length && now - history[0].t > WINDOW_MS) history.shift()
      if (now < cooldownUntil || history.length < 2) return
      const dx = x - history[0].x
      const dt = now - history[0].t
      if (dt >= MIN_DT && Math.abs(dx) >= MIN_DIST) {
        const dir = dx < 0 ? 'left' : 'right'
        cooldownUntil = now + COOLDOWN_MS
        history.length = 0
        onSwipeRef.current?.(dir)
        setSwipe({ dir, id: ++swipeId })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, paused])

  // Ҳангоми баромадан аз саҳифа камераро озод мекунем
  useEffect(() => () => { runId.current++; streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  return { status, error, hand, swipe, videoRef, toggle, dismissError: () => { setError(''); setStatus('off') } }
}
