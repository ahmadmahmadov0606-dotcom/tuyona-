import { useCallback, useEffect, useRef, useState } from 'react'

// MediaPipe аз сервери худи сайт (public/mediapipe): аз Google/jsDelivr дар Тоҷикистон ~30 с бор мешуд.
// Танҳо вақте ки корбар камераро фаъол кард, як бор (чанки алоҳида).
const MP_FILES = { wasmLoaderPath: '/mediapipe/vision_wasm_internal.js', wasmBinaryPath: '/mediapipe/vision_wasm_internal.wasm' }
const MODEL_URL = '/mediapipe/hand_landmarker.task'
const GPU_WAIT_MS = 6000 // GPU баъзан овезон мешавад — баъд CPU

// Ду роҳи ишора (ҳар кадомаш кор мекунад):
//  1) ҷой: даст ба минтақаи рост ё чапи кадр рафт → як слайд; барои навбатӣ дастро ба марказ баргардонед;
//  2) ҷунбиш: ҳаракати тез ба тараф (swipe), ҳатто агар ба минтақаи канор нарасад.
export const ZONE_RIGHT = 0.64 // x (аз нигоҳи корбар) > ин — тарафи рост
export const ZONE_LEFT = 0.36
const CENTER = [0.42, 0.58] // даст ба ин ҷо баргашт — ишораи навбатӣ мумкин
const WINDOW_MS = 400 // суръат дар ҳамин фосила ҳисоб мешавад
const MIN_DIST = 0.16 // ҳадди ақали ҳаракат барои swipe (ҳиссаи паҳнои кадр)
const MIN_DT = 60 // ҳаракати хеле кӯтоҳ (як-ду кадр) — садо
const COOLDOWN_MS = 650 // як жест = як слайд
const REARM_LOST_MS = 600 // даст ин қадар нест буд — ишораи нав мумкин (гум шудани кӯтоҳ ҳисоб намешавад)
const FRAME_GAP_MS = 40 // ~25 кадр/с барои модел — UI озод мемонад
const PALM = [0, 5, 9, 13, 17] // мич ва асоси ангуштон — маркази каф

let landmarkerPromise = null
function loadLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision')
      const fileset = MP_FILES
      const options = (delegate) => ({
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.6, minHandPresenceConfidence: 0.6, minTrackingConfidence: 0.5,
      })
      const gpu = vision.HandLandmarker.createFromOptions(fileset, options('GPU'))
      const late = new Promise((_, reject) => setTimeout(() => reject(new Error('GPU timeout')), GPU_WAIT_MS))
      try { return await Promise.race([gpu, late]) }
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
/** Гардиши каф дар ҳамвории тасвир (мисли руль), дараҷа: 0 — ангуштон боло, + — ба рости корбар. */
function palmRoll(pts) {
  const dx = -(pts[9].x - pts[0].x) // тасвир оинавӣ
  const dy = pts[0].y - pts[9].y
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

/** onTilt(deg | null) — гардиши каф (ҳамвор карда), null — даст нест. */
export default function useHandSwipe({ onSwipe, onTilt, paused = false }) {
  const [status, setStatus] = useState('off') // off | loading | on | error
  const [error, setError] = useState('')
  const [hand, setHand] = useState(false)
  const [swipe, setSwipe] = useState(null) // { dir, id } — барои тирчаи ишоратӣ
  const [handX, setHandX] = useState(null) // ҷойи даст 0…1 (аз нигоҳи корбар) — нуқта дар пешнамоиши камера
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const onSwipeRef = useRef(onSwipe)
  const runId = useRef(0)
  onSwipeRef.current = onSwipe
  const onTiltRef = useRef(onTilt)
  onTiltRef.current = onTilt

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
    let armed = true // даст аз марказ омад — ишораи ҷой мумкин
    let lastX = 0
    let lostSince = 0
    let roll = null // гардиши ҳамворшуда (EMA)
    const fire = (dir, now) => {
      cooldownUntil = now + COOLDOWN_MS
      armed = false
      history.length = 0
      onSwipeRef.current?.(dir)
      setSwipe({ dir, id: ++swipeId })
    }
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
      if (!pts) {
        history.length = 0
        lostSince ||= now
        if (now - lostSince > REARM_LOST_MS) armed = true
        setHandX(null)
        if (roll !== null) { roll = null; onTiltRef.current?.(null) }
        return
      }
      lostSince = 0
      const r = palmRoll(pts)
      roll = roll === null ? r : roll + (r - roll) * 0.35
      onTiltRef.current?.(roll)
      // Тасвир оинавӣ: x = 1 − x, то «рост» барои корбар рост бошад
      const x = 1 - PALM.reduce((s, i) => s + pts[i].x, 0) / PALM.length
      if (Math.abs(x - lastX) > 0.01) { lastX = x; setHandX(x) }
      if (x > CENTER[0] && x < CENTER[1]) armed = true
      history.push({ t: now, x })
      while (history.length && now - history[0].t > WINDOW_MS) history.shift()
      if (now < cooldownUntil) return
      // 1) ҷой: даст ба канори рост/чап расид
      if (armed && x >= ZONE_RIGHT) return fire('right', now)
      if (armed && x <= ZONE_LEFT) return fire('left', now)
      // 2) ҷунбиши тез (низ танҳо пас аз марказ — як ҳаракат = як мошин)
      if (!armed || history.length < 2) return
      const dx = x - history[0].x
      const dt = now - history[0].t
      if (dt >= MIN_DT && Math.abs(dx) >= MIN_DIST) fire(dx < 0 ? 'left' : 'right', now)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [status, paused])

  // Ҳангоми баромадан аз саҳифа камераро озод мекунем
  useEffect(() => () => { runId.current++; streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  return { status, error, hand, handX, swipe, videoRef, toggle, dismissError: () => { setError(''); setStatus('off') } }
}
