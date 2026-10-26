import { createContext, useCallback, useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { imgUrl, money, PRICE_UNITS, useCatalog } from '../utils'
import CategoryIcon from './CategoryIcon'
import { categoryPhoto } from './categoryMedia'
import './ListingCard.css'
import { Rings3D, useTilt } from './fx'
import Icon from './Icon'

export function Spinner({ big }) {
  return <div className={big ? 'page-loader' : 'inline-loader'} role="status" aria-label="Бор шуда истодааст"><Rings3D size={big ? 'lg' : 'md'} /></div>
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="alert alert-error" role="alert">
      <span>{error.message || String(error)}</span>
      {onRetry && <button className="btn btn-sm btn-ghost" onClick={onRetry}>Аз нав</button>}
    </div>
  )
}

export function Empty({ icon = <Icon name="flower" />, title, text, action }) {
  return (
    <div className="empty reveal">
      <div className="empty-stage"><span className="empty-orbit" aria-hidden="true" /><span className="empty-icon">{icon}</span></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Stars({ value = 0, count, size }) {
  const full = Math.round(value)
  return (
    <span className={`stars ${size || ''}`} title={`${value.toFixed(1)} аз 5`}>
      {'★★★★★'.slice(0, full)}<span className="stars-off">{'★★★★★'.slice(full)}</span>
      {count !== undefined && <span className="stars-count">{count > 0 ? `${value.toFixed(1)} (${count})` : 'Шарҳ нест'}</span>}
    </span>
  )
}

export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Баҳо">
      {[1, 2, 3, 4, 5].map((n) => (
        <button type="button" key={n} aria-label={`${n} ситора`}
          className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>
      ))}
    </div>
  )
}

export function Price({ value, unit }) {
  return (
    <span className="price">
      <span className="price-from">аз</span> <b>{money(value)}</b>
      <span className="price-unit"> {PRICE_UNITS[unit]}</span>
    </span>
  )
}

export function ListingCard({ l }) {
  const cover = imgUrl(l.cover)
  const tilt = useTilt(5)
  const catalog = useCatalog()
  const groupSlug = catalog?.groups.find((g) => g.id === l.category.group_id)?.slug
  // Агар хизматрасон акс нагузошта бошад — акси категория (Wikimedia Commons, ниг. /aksho)
  const fallback = !cover && groupSlug ? categoryPhoto(groupSlug) : null
  return (
    <Link ref={tilt} to={`/listing/${l.id}`} className="lc tilt reveal">
      <span className="tilt-glare" aria-hidden="true" />
      <span className="lc-img">
        {cover ? <img src={cover} alt="" loading="lazy" decoding="async" />
          : fallback ? (
            <>
              <img src={fallback.src} srcSet={fallback.srcSet} sizes="(max-width: 560px) 92vw, (max-width: 1099px) 46vw, 420px" alt="" loading="lazy" decoding="async" />
              <span className="lc-veil" aria-hidden="true" />
              <span className="lc-badge"><CategoryIcon slug={groupSlug} /></span>
            </>
          ) : <span className="lc-ph"><CategoryIcon slug={groupSlug} /></span>}
        <span className="lc-tag">{l.category.name}</span>
        {!l.is_active && <span className="lc-off">Пинҳон</span>}
      </span>
      <span className="lc-body">
        <span className="lc-title">{l.title}</span>
        <span className="lc-meta">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          {l.city.name}{l.capacity ? ` · то ${l.capacity} нафар` : ''}
        </span>
        <span className="lc-rate">{l.rating_count > 0 ? <Stars value={l.rating_avg} count={l.rating_count} /> : <span className="lc-new">Нав</span>}</span>
        <span className="lc-foot">
          <span className="lc-price"><small>аз</small> <b>{money(l.price_from)}</b><small className="lc-unit">{PRICE_UNITS[l.price_unit]}</small></span>
          <span className="lc-go" aria-hidden="true">Дидан <i>→</i></span>
        </span>
      </span>
    </Link>
  )
}

export function Pager({ page, size, total, onChange }) {
  const pages = Math.ceil(total / size)
  if (pages <= 1) return null
  const nums = []
  for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) nums.push(i)
  return (
    <nav className="pager" aria-label="Саҳифаҳо">
      <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Пеш</button>
      {nums.map((n) => (
        <button key={n} className={`btn btn-sm ${n === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => onChange(n)}>{n}</button>
      ))}
      <button className="btn btn-ghost btn-sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Баъд ›</button>
    </nav>
  )
}

// ---- Огоҳиномаҳои хурд (toast) ----
const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random()
    setItems((s) => [...s, { id, text, kind }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)
