import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { CARS, carSrc as src } from '../cars'
import { Lightbox, OPEN_KEY, OrderModal, pad, Plate, SelectButton, SelectionBar, store, useCarSelection } from './CarsGallery'
import { usePageHidden } from './PageBackground'
import { GLOW_DELAY, runSwitch } from './showroomTransition'
import './CarsShowroom.css'

const N = CARS.length
const AUTOPLAY_MS = 5000
const ALL_CARS_HREF = '/search?group=transport'

// Масофаи даврии корт аз корти фаъол: −5…5
const offsetOf = (i, active) => ((i - active + N + Math.floor(N / 2)) % N) - Math.floor(N / 2)
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Заминаи хираи бахш: ҳамагӣ ду қабат (ҳозира + навбатӣ), гузариш танҳо бо opacity */
function ShowroomBackdrop({ id }) {
  const [layers, setLayers] = useState({ a: id, b: null, front: 'a' })
  useEffect(() => {
    let alive = true
    const img = new Image()
    img.src = src(id, 600)
    const swap = () => alive && setLayers((l) => {
      if (l[l.front] === id) return l
      const back = l.front === 'a' ? 'b' : 'a'
      return { ...l, [back]: id, front: back }
    })
    img.decode ? img.decode().then(swap, swap) : (img.onload = swap)
    return () => { alive = false }
  }, [id])
  return (
    <div className="cs-bg" aria-hidden="true">
      {['a', 'b'].map((k) => layers[k] && (
        <img key={k} className={`cs-bg-img ${layers.front === k ? 'on' : ''}`} src={src(layers[k], 600)} alt="" decoding="async" />
      ))}
      <span className="cs-bg-tint" />
      <span className="cs-bg-pattern" />
      <span className="cs-bg-vignette" />
      <span className="cs-floor" />
    </div>
  )
}

// Марка аз модел ҷудо — «BMW» болои «7 Series»
const BRANDS = ['Mercedes-Maybach', 'Mercedes-Benz', 'Rolls-Royce', 'Range Rover', 'BMW', 'Toyota', 'Lexus', 'Cadillac']
function splitName(name) {
  const brand = !name.includes(' ва ') && BRANDS.find((b) => name.startsWith(`${b} `))
  return brand ? { brand, model: name.slice(brand.length + 1) } : { brand: '', model: name }
}

function ShowroomCard({ c, offset, cardRef, onOpen, onPick, picked, onSelect }) {
  const isCur = offset === 0
  const { brand, model } = splitName(c.name)
  return (
    <article ref={cardRef} className={`cs-card ${isCur ? 'is-cur' : ''} ${picked ? 'is-picked' : ''}`}
      data-pos={Math.max(-2, Math.min(2, offset))} aria-hidden={!isCur} onClick={isCur ? undefined : onSelect}>
      {/* focus — нуқтаи марказии мошин дар акс (cars.js); акс ҳамеша тамоми кортро пур мекунад */}
      <img className="cs-card-img" src={src(c.id, 1200)} alt={c.name} decoding="async" style={{ objectPosition: c.focus || c.pos }} />
      <span className="cs-card-shade" aria-hidden="true" />
      <span className="cs-corners" aria-hidden="true"><i /><i /><i /><i /></span>
      {isCur && <button type="button" className="cs-card-open" onClick={onOpen} tabIndex={-1} aria-hidden="true" />}
      <div className="cs-panel">
        <div className="cs-info">
          {brand && <span className="cs-brand">{brand}</span>}
          <span className="cs-name">{model}</span>
          {(c.note || c.plates.length > 0) && (
            <span className="cs-meta">
              {c.note && <span className="cs-note">{c.note}</span>}
              {c.plates.length > 0 && <span className="cg-plates cs-plates">{c.plates.map((p) => <Plate key={p} value={p} />)}</span>}
            </span>
          )}
        </div>
        {isCur && (
          <div className="cs-actions">
            <button type="button" className="cs-view" onClick={onOpen}
              aria-label={`${c.name}${c.plates.length ? `, ${c.plates.join(', ')}` : ''} — калон дидан`}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
              <span>Калон дидан</span>
            </button>
            <SelectButton big on={picked} name={c.name} onClick={onPick} />
          </div>
        )}
      </div>
    </article>
  )
}

/** «Мошинҳои бартар» дар саҳифаи асосӣ — шоурум бо coverflow ва заминаи акси мошини фаъол */
export default function CarsShowroom({ allLink = true }) {
  const { user } = useAuth()
  const sel = useCarSelection()
  const [ordering, setOrdering] = useState(false)
  const [open, setOpen] = useState(-1)
  // seq — рақами гузариш, dir — 1: ба чап (навбатӣ), −1: ба рост
  const [nav, setNav] = useState({ active: 0, prev: -1, dir: 1, seq: 0 })
  const { active } = nav
  const [playing, setPlaying] = useState(() => !reducedMotion())
  const [hover, setHover] = useState(false)
  const [onScreen, setOnScreen] = useState(false)
  const hidden = usePageHidden()
  const rootRef = useRef(null)
  const touch = useRef(null)
  const cards = useRef(new Map()) // id → элементи корт
  const shown = useRef(new Set()) // кортҳое, ки дар рендери пештара намоён буданд

  // Гузариш ҳамеша фавран: анимацияи нав аз ҳолати ҳозираи кортҳо идома меёбад (бе навбат ва бе қулф)
  const go = useCallback((d) => setNav((n) => ({ active: (n.active + d + N) % N, prev: n.active, dir: d, seq: n.seq + 1 })), [])
  const jump = useCallback((i) => setNav((n) => (i === n.active ? n
    : { active: i, prev: n.active, dir: Math.sign(offsetOf(i, n.active)) || 1, seq: n.seq + 1 })), [])

  // Пас аз вуруд формаи фармоишро худкор мекушоем (мисли галереяи пурра)
  useEffect(() => {
    if (user && store.get(OPEN_KEY) && sel.ids.length) setOrdering(true)
    store.set(OPEN_KEY, null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    const el = rootRef.current
    if (!el || !('IntersectionObserver' in window)) { setOnScreen(true); return undefined }
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { threshold: 0.25 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Худкор ҳар 5 с; ҳангоми hover, фокус дар дохил, берун аз экран, ҷадвали пинҳон ё lightbox — қатъ
  const [focusIn, setFocusIn] = useState(false)
  const running = playing && !hover && !focusIn && onScreen && !hidden && open < 0 && !ordering
  useEffect(() => {
    if (!running) return undefined
    const t = setTimeout(() => go(1), AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [running, active, go])

  // Анимацияи гузариш — пеш аз кашидани кадр, то ҷаҳиш набошад
  useLayoutEffect(() => {
    const ids = new Set(CARS.filter((_, i) => Math.abs(offsetOf(i, nav.active)) <= 2).map((c) => c.id))
    if (nav.seq) {
      const inId = CARS[nav.active].id
      runSwitch({
        outEl: cards.current.get(CARS[nav.prev]?.id),
        inEl: cards.current.get(inId),
        dir: nav.dir,
        fresh: !shown.current.has(inId),
        reduced: reducedMotion(),
      })
    }
    shown.current = ids
  }, [nav])

  // Аксҳои ҳамсоя (пештара ва навбатӣ) пешакӣ бор мешаванд
  useEffect(() => {
    for (const d of [1, -1]) {
      const id = CARS[(active + d + N) % N].id
      new Image().src = src(id, 1200)
      new Image().src = src(id, 600)
    }
  }, [active])

  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea, select')) return
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  }
  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  const cur = CARS[active]

  return (
    <section ref={rootRef} className="cs" aria-labelledby="cs-title" aria-roledescription="carousel" onKeyDown={onKeyDown}
      onFocus={() => setFocusIn(true)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setFocusIn(false)}>
      <ShowroomBackdrop id={cur.id} />

      <div className="container cs-in">
        <header className="cs-head">
          <p className="cs-kicker"><span aria-hidden="true" />Tuyona · Showroom<span aria-hidden="true" /></p>
          <h2 id="cs-title">Мошинҳои бартар</h2>
          <p className="cs-sub">Рақамҳои зебо барои мошинҳои зебо</p>
        </header>

        <div className="cs-stage" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="cs-track" aria-live={running ? 'off' : 'polite'}>
            {CARS.map((c, i) => {
              const o = offsetOf(i, active)
              if (Math.abs(o) > 2) return null
              return (
                <ShowroomCard key={c.id} c={c} offset={o} picked={sel.has(c.id)}
                  cardRef={(el) => (el ? cards.current.set(c.id, el) : cards.current.delete(c.id))}
                  onOpen={() => setOpen(i)} onPick={() => sel.toggle(c.id)} onSelect={() => jump(i)} />
              )
            })}
            <span className="cs-spot" aria-hidden="true" />
            {/* Дурахши нарми ҳошия дар лаҳзаи «истодан» — айнан бо радиуси корт */}
            {nav.seq > 0 && <span key={nav.seq} className="cs-glow" style={{ animationDelay: `${GLOW_DELAY}ms` }} aria-hidden="true" />}
          </div>
          <button type="button" className="cs-arrow cs-prev" onClick={() => go(-1)} aria-label="Мошини пештара">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button type="button" className="cs-arrow cs-next" onClick={() => go(1)} aria-label="Мошини навбатӣ">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="cs-controls">
          <span className="cs-count" aria-live="off">
            <span><b>{pad(active + 1)}</b> / {pad(N)}</span>
            {/* Навори пешравии худкор: бо ҳар мошин ва ҳар идомаи худкор аз сар */}
            <span className="cs-progress" aria-hidden="true">{running && <i key={active} style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />}</span>
          </span>
          <div className="cs-thumbs" role="tablist" aria-label="Мошинҳо">
            {CARS.map((c, i) => (
              <button key={c.id} type="button" role="tab" aria-selected={i === active} aria-label={`${pad(i + 1)} — ${c.name}`}
                className={`cs-thumb ${i === active ? 'on' : ''}`} onClick={() => jump(i)}>
                <img src={src(c.id, 600)} alt="" loading="lazy" decoding="async" style={{ objectPosition: c.pos }} />
              </button>
            ))}
          </div>
          <div className="cs-dots" aria-hidden="true">
            {CARS.map((c, i) => <i key={c.id} className={i === active ? 'on' : ''} />)}
          </div>
          <button type="button" className="cs-play" onClick={() => setPlaying((p) => !p)} aria-pressed={!playing}
            aria-label={playing ? 'Худкорро қатъ кардан' : 'Худкор нишон додан'}>
            {playing
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" /></svg>}
          </button>
        </div>

        {allLink && (
          <div className="cg-more-wrap">
            <Link to={ALL_CARS_HREF} className="cg-more">Ҳамаи {N} мошинро бинед <span aria-hidden="true">→</span></Link>
          </div>
        )}
      </div>

      {open >= 0 && <Lightbox list={CARS} index={open} setIndex={setOpen} onClose={() => setOpen(-1)} sel={sel} />}
      {sel.ids.length > 0 && !ordering && <SelectionBar sel={sel} onOrder={() => setOrdering(true)} />}
      {ordering && <OrderModal sel={sel} onClose={() => setOrdering(false)} />}
    </section>
  )
}
