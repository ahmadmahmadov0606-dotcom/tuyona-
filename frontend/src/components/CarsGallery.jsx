import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { CARS, carById, carSrc as src, MAX_CARS } from '../cars'
import { fmtDate, todayISO } from '../utils'
import { ErrorBox, useToast } from './ui'
import './CarsGallery.css'

const SEL_KEY = 'tuyona-car-selection' // интихоб пас аз вуруд ҳам мемонад
export const OPEN_KEY = 'tuyona-car-order-open' // пас аз вуруд формаро худкор мекушоем
export const store = {
  get: (k) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v) } catch { /* ҳеҷ */ } },
}

const srcSet = (id) => `${src(id, 600)} 600w, ${src(id, 1200)} 1200w`
// Паҳнои тахминии корт дар ҳар андозаи экран — браузер аксро бо андозаи лозимӣ мегирад
const SIZES = {
  hero: '(max-width: 767px) 85vw, (max-width: 1099px) 50vw, 600px',
  wide: '(max-width: 767px) 85vw, (max-width: 1099px) 100vw, 900px',
  tall: '(max-width: 767px) 85vw, (max-width: 1099px) 50vw, 300px',
}
const sizeOf = (area) => (area === 'a' || area === 'b' ? SIZES.hero : area === 'g' || area === 'j' ? SIZES.wide : SIZES.tall)
export const pad = (n) => String(n).padStart(2, '0')

/** Рақами давлатии Тоҷикистон: парчами хурд + «TJ» + рақамҳо */
export function Plate({ value }) {
  return (
    <span className="cg-plate">
      <span className="cg-plate-flag" aria-hidden="true"><i /><b>TJ</b></span>
      <span className="cg-plate-num">{value}</span>
    </span>
  )
}

/** Интихоби мошинҳо барои фармоиш (то MAX_CARS) */
export function useCarSelection() {
  const toast = useToast()
  const [ids, setIds] = useState(() => {
    try { return JSON.parse(store.get(SEL_KEY) || '[]').filter((id) => carById(id)).slice(0, MAX_CARS) } catch { return [] }
  })
  useEffect(() => { store.set(SEL_KEY, ids.length ? JSON.stringify(ids) : null) }, [ids])
  const has = (id) => ids.includes(id)
  const toggle = (id) => {
    if (has(id)) { setIds(ids.filter((x) => x !== id)); return }
    if (ids.length >= MAX_CARS) { toast(`Тибқи қонун корвони тӯй — на бештар аз ${MAX_CARS} мошин`, 'err'); return }
    setIds([...ids, id])
  }
  return { ids, has, toggle, remove: (id) => setIds(ids.filter((x) => x !== id)), clear: () => setIds([]) }
}

/** Галереяи пурра — дар саҳифаи категорияи «Нақлиёт». Пахши мошин — ба саҳифаи фармоиши он (/moshin/:id) */
export default function CarsGallery() {
  const list = CARS
  const nav = useNavigate()
  const sel = useCarSelection()
  const [active, setActive] = useState(0)
  const gridRef = useRef(null)

  // Пайдошавӣ ҳангоми scroll — як бор
  useEffect(() => {
    const cards = gridRef.current?.querySelectorAll('.cg-card')
    if (!cards) return
    if (!('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cards.forEach((c) => c.classList.add('cg-in'))
      return
    }
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('cg-in'); io.unobserve(en.target) }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    cards.forEach((c) => io.observe(c))
    return () => io.disconnect()
  }, [])

  // Мобилӣ: нуқтаи фаъол аз рӯи scroll-и карусел
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const card = el.querySelector('.cg-card')
        if (!card || el.scrollWidth <= el.clientWidth) return
        const step = card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || 0)
        setActive(Math.min(list.length - 1, Math.round(el.scrollLeft / step)))
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const goToCard = (i) => gridRef.current?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })

  return (
    <section className="cg" aria-labelledby="cg-title">
      <div className="container">
        <header className="cg-head">
          <p className="cg-kicker">Tuyona · Showroom</p>
          <h2 id="cg-title">Мошинҳои бартар</h2>
          <p className="cg-sub">Рақамҳои зебо барои мошинҳои зебо</p>
        </header>

        <div className="cg-grid" ref={gridRef}>
          {list.map((c, i) => {
            const on = sel.has(c.id)
            return (
              <article key={c.id} className={`cg-card cg-${c.area} ${on ? 'cg-selected' : ''}`} style={{ '--i': i % 4 }}>
                <img src={src(c.id, 600)} srcSet={srcSet(c.id)} sizes={sizeOf(c.area)} alt={c.name}
                  loading="lazy" decoding="async" style={{ objectPosition: c.pos }} />
                <span className="cg-shade" aria-hidden="true" />
                <Link to={`/moshin/${c.id}`} className="cg-open"
                  aria-label={`${c.name}${c.plates.length ? `, ${c.plates.join(', ')}` : ''} — фармоиш додан`} />
                <span className="cg-info">
                  <span className="cg-name">{c.name}{c.note && <small>{c.note}</small>}</span>
                  {c.plates.length > 0 && <span className="cg-plates">{c.plates.map((p) => <Plate key={p} value={p} />)}</span>}
                </span>
                <SelectButton on={on} name={c.name} onClick={() => nav(`/moshin/${c.id}`)} />
              </article>
            )
          })}
        </div>

        <div className="cg-dots" role="tablist" aria-label="Аксҳо">
          {list.map((c, i) => (
            <button key={c.id} type="button" role="tab" aria-selected={i === active} aria-label={`${pad(i + 1)} — ${c.name}`}
              className={i === active ? 'on' : ''} onClick={() => goToCard(i)} />
          ))}
        </div>
      </div>

      {sel.ids.length > 0 && <SelectionBar sel={sel} onOrder={() => nav(`/moshin/${sel.ids[0]}`)} />}
    </section>
  )
}

export function SelectButton({ on, name, onClick, big }) {
  return (
    <button type="button" className={`cg-pick ${on ? 'on' : ''} ${big ? 'cg-pick-big' : ''}`} onClick={onClick} aria-pressed={on}
      aria-label={on ? `${name} — аз фармоиш хориҷ кардан` : `${name} — барои фармоиш интихоб кардан`}>
      <span aria-hidden="true">{on ? '✓' : '+'}</span>{big && (on ? 'Интихоб шуд' : 'Интихоб кардан')}
    </button>
  )
}

/** Навори поёнӣ: мошинҳои интихобшуда ва тугмаи фармоиш */
export function SelectionBar({ sel, onOrder }) {
  return createPortal(
    <div className="cg-bar" role="region" aria-label="Мошинҳои интихобшуда">
      <div className="cg-bar-in">
        <div className="cg-bar-cars">
          {sel.ids.map((id) => {
            const c = carById(id)
            return (
              <button key={id} type="button" className="cg-bar-thumb" onClick={() => sel.remove(id)} aria-label={`${c.name} — хориҷ кардан`}>
                <img src={src(id, 600)} alt="" style={{ objectPosition: c.pos }} /><i aria-hidden="true">✕</i>
              </button>
            )
          })}
          {Array.from({ length: MAX_CARS - sel.ids.length }, (_, i) => <span key={i} className="cg-bar-slot" aria-hidden="true" />)}
        </div>
        <p className="cg-bar-text"><b>{sel.ids.length} / {MAX_CARS}</b> мошин интихоб шуд<small>Корвони тӯй тибқи қонун — то {MAX_CARS} мошин</small></p>
        <button type="button" className="cg-bar-clear" onClick={sel.clear}>Тоза</button>
        <button type="button" className="cg-btn-gold" onClick={onOrder}>Фармоиш додан →</button>
      </div>
    </div>,
    document.body,
  )
}

/** Формаи фармоиш дар тирезаи болоӣ (шоуруми саҳифаи асосӣ) */
export function OrderModal({ sel, onClose }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [onClose])

  return createPortal(
    <div className="cg-modal" role="dialog" aria-modal="true" aria-labelledby="cg-order-title" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cg-modal-card">
        <button type="button" className="cg-modal-x" onClick={onClose} aria-label="Пӯшидан">✕</button>
        <OrderForm sel={sel} onClose={onClose} onEmpty={onClose} next="/" />
      </div>
    </div>,
    document.body,
  )
}

/** Формаи фармоиш: сана, вақт, суроға, телефон ва изҳорот. Дар тиреза (OrderModal) ва дар саҳифаи мошин (/moshin/:id). */
export function OrderForm({ sel, onClose, onEmpty, next, extra }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [f, setF] = useState({ event_date: '', start_time: '17:00', pickup_address: '', contact_phone: '', note: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => { if (!sel.ids.length && !done) onEmpty?.() }, [sel.ids.length, done, onEmpty])

  // Меҳмон: интихоб нигоҳ дошта мешавад ва пас аз вуруд форма худкор кушода мешавад
  const goLogin = () => {
    store.set(OPEN_KEY, '1')
    nav(`/login?next=${encodeURIComponent(next)}`)
  }

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const o = await api.carOrder({ ...f, cars: sel.ids })
      setDone(o)
      sel.clear()
      toast('Фармоиш қабул шуд! Мо ба зудӣ занг мезанем.')
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  if (done) {
    return (
      <div className="cg-done">
        <span className="cg-done-ico" aria-hidden="true">✓</span>
        <h3 id="cg-order-title">Фармоиш қабул шуд</h3>
        <p>Фармоиши №{done.id} барои <b>{fmtDate(done.event_date)}</b>, соати <b>{done.start_time}</b> — {done.cars.length} мошин.
          Маъмур ба зудӣ бо рақами {done.contact_phone} тамос мегирад.</p>
        <div className="cg-done-actions">
          <Link to="/bookings" className="cg-btn-gold" onClick={onClose}>Фармоишҳои ман</Link>
          {onClose
            ? <button type="button" className="cg-btn-ghost" onClick={onClose}>Пӯшидан</button>
            : <Link to="/search?group=transport" className="cg-btn-ghost">Мошинҳои дигар</Link>}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit}>
      <p className="cg-kicker">Кортежи тӯй</p>
      <h3 id="cg-order-title">Фармоиши мошинҳо</h3>
      <ul className="cg-order-cars">
        {sel.ids.map((id) => {
          const c = carById(id)
          return (
            <li key={id}>
              <img src={src(id, 600)} alt="" style={{ objectPosition: c.pos }} />
              <span><b>{c.name}</b>{c.plates.length > 0 && <small>{c.plates.join(' · ')}</small>}</span>
              <button type="button" onClick={() => sel.remove(id)} aria-label={`${c.name} — хориҷ кардан`}>✕</button>
            </li>
          )
        })}
      </ul>
      {extra}
      <div className="cg-fields">
        <label className="cg-field"><span>Санаи тӯй</span>
          <input type="date" required min={todayISO()} value={f.event_date} onChange={set('event_date')} /></label>
        <label className="cg-field"><span>Вақти оғоз</span>
          <input type="time" required min="06:00" max="21:00" value={f.start_time} onChange={set('start_time')} />
          <small className="cg-hint">Тибқи қонун тӯй то 22:00 анҷом меёбад. Шаҳр: истироҳат аз 08:00, рӯзи корӣ аз 18:00. <Link to="/qonun">Муфассал</Link></small></label>
        <label className="cg-field cg-wide"><span>Суроғаи омадани мошинҳо</span>
          <input value={f.pickup_address} onChange={set('pickup_address')} maxLength={200} placeholder="Масалан: Душанбе, кӯчаи Рӯдакӣ 10" /></label>
        <label className="cg-field cg-wide"><span>Телефон</span>
          <input type="tel" required value={f.contact_phone} onChange={set('contact_phone')} placeholder="+992 …" /></label>
        <label className="cg-field cg-wide"><span>Изҳорот (ихтиёрӣ)</span>
          <textarea rows="2" value={f.note} onChange={set('note')} maxLength={1000} placeholder="Ороиши мошин, масир, хоҳишҳо…" /></label>
      </div>
      <ErrorBox error={err} />
      {user ? (
        <button className="cg-btn-gold cg-submit" disabled={busy || !sel.ids.length}>
          {busy ? 'Фиристода мешавад…' : `Фармоиш додан (${sel.ids.length} мошин)`}
        </button>
      ) : (
        <button type="button" className="cg-btn-gold cg-submit" onClick={goLogin}>Барои фармоиш ворид шавед</button>
      )}
    </form>
  )
}

export function Lightbox({ list, index, setIndex, onClose, sel }) {
  const n = list.length
  const c = list[index]
  const closeRef = useRef(null)
  const touch = useRef(null)
  const go = useCallback((d) => setIndex((i) => (i + d + n) % n), [n, setIndex])

  useEffect(() => {
    const prevFocus = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prevFocus?.focus?.()
    }
  }, [go, onClose])

  // Акси навбатиро пешакӣ бор мекунем
  useEffect(() => { new Image().src = src(list[(index + 1) % n].id, 1200) }, [list, index, n])

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (dy > 80 && dy > Math.abs(dx)) onClose() // swipe ба поён — пӯшидан
    else if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  }

  // Ба body мебарем, то transform-и волидҳо position: fixed-ро вайрон накунад
  return createPortal(
    <div className="cg-lb" role="dialog" aria-modal="true" aria-label={c.name}
      onClick={(e) => e.target === e.currentTarget && onClose()} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button ref={closeRef} type="button" className="cg-lb-btn cg-lb-close" aria-label="Пӯшидан" onClick={onClose}>✕</button>
      <button type="button" className="cg-lb-btn cg-lb-prev" aria-label="Пештар" onClick={() => go(-1)}>‹</button>
      <figure className="cg-lb-fig" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <img key={c.id} src={src(c.id, 1200)} alt={c.name} />
        <figcaption>
          <span className="cg-lb-count">{pad(index + 1)} / {pad(n)}</span>
          <b>{c.name}</b>
          {c.plates.length > 0 && <span className="cg-plates">{c.plates.map((p) => <Plate key={p} value={p} />)}</span>}
          <SelectButton big on={sel.has(c.id)} name={c.name} onClick={() => sel.toggle(c.id)} />
        </figcaption>
      </figure>
      <button type="button" className="cg-lb-btn cg-lb-next" aria-label="Баъдӣ" onClick={() => go(1)}>›</button>
    </div>,
    document.body,
  )
}
