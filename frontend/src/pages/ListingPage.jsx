import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Calendar from '../components/Calendar'
import WeatherForecast from '../components/WeatherForecast'
import { Ornament } from '../components/fx'
import NightPage from '../components/NightPage'
import PlaceMiniMap from '../components/map/PlaceMiniMap'
import { placeByListing } from '../places'
import { Empty, ErrorBox, Spinner, StarInput, Stars, useToast } from '../components/ui'
import { fmtDate, imgUrl, money, PRICE_UNITS, useAsync, WEDDING_LIMITS } from '../utils'
import './ListingPage.css'
import LineIcon from '../components/Icon'

const DESC_LIMIT = 420 // аз ин дарозтар — «Бештар хондан»
const FLOWER_CATS = ['flowers', 'hall-decor', 'balloons', 'garden']
const ARCH_CATS = ['arch', 'tuykhona', 'small-hall', 'rentals']

export default function ListingPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const res = useAsync(() => api.listing(id), [id])
  const reviews = useAsync(() => api.reviews(id), [id])
  const [favBusy, setFavBusy] = useState(false)
  const bookRef = useRef(null)

  if (res.loading) return <Spinner big />
  if (res.error) {
    return (
      <div className="container page">
        {res.error.status === 404
          ? <Empty icon={<LineIcon name="dove" />} title="Эълон ёфт нашуд" action={<Link to="/search" className="btn btn-primary">Ба ҷустуҷӯ</Link>} />
          : <ErrorBox error={res.error} onRetry={res.reload} />}
      </div>
    )
  }
  const l = res.data
  const isOwner = user && (user.id === l.vendor.id || user.role === 'admin')

  const toggleFav = async () => {
    if (!user) return nav(`/login?next=/listing/${id}`)
    setFavBusy(true)
    try {
      await api.favorite(l.id, !l.is_favorite)
      res.setData({ ...l, is_favorite: !l.is_favorite })
      toast(l.is_favorite ? 'Аз интихобшуда хориҷ шуд' : 'Ба интихобшуда илова шуд')
    } catch (e) { toast(e.message, 'err') } finally { setFavBusy(false) }
  }

  const scrollToBooking = () => bookRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <NightPage className="lp">

      <div className="container lp-wrap">
        <nav className="lp-crumbs">
          <Link to="/search">Хизматҳо</Link><span aria-hidden="true">›</span>
          <Link to={`/search?category=${l.category.slug}`}>{l.category.name}</Link><span aria-hidden="true">›</span>
          <span>{l.city.name}</span>
        </nav>

        <Hero listing={l} onFav={toggleFav} favBusy={favBusy} />

        <div className="lp-body">
          <aside className="lp-side" ref={bookRef} id="lp-book">
            <div className="lp-book lp-rise" style={{ '--d': '120ms' }}>
              <div className="lp-price">
                <span className="lp-price-from">аз</span>
                <b>{money(l.price_from)}</b>
                <span className="lp-price-unit">{PRICE_UNITS[l.price_unit]}</span>
              </div>
              <div className="lp-vendor">
                <span className="lp-avatar">{initials(l.vendor.full_name)}</span>
                <div>
                  <b>{l.vendor.full_name}</b>
                  {l.vendor.is_verified && <span className="lp-verified"><Icon name="check" />Тасдиқшуда</span>}
                  <div className="lp-soft lp-small">Хизматрасон</div>
                </div>
              </div>
              <a className="lp-btn lp-btn-outline" href={`tel:${l.contact_phone}`}><Icon name="phone" />{l.contact_phone}</a>
              {isOwner ? (
                <Link to={`/vendor/listings/${l.id}`} className="lp-btn lp-btn-gold">Таҳрир кардан</Link>
              ) : (
                <BookingForm listing={l} />
              )}
            </div>
          </aside>

          <section className="lp-card lp-desc lp-rise" style={{ '--d': '180ms' }}>
            <h2>Тавсиф</h2>
            <Ornament className="lp-ornament" />
            <Description text={l.description} />
            {l.includes?.length > 0 && (
              <>
                <h3 className="lp-sub">Чӣ дохил мешавад</h3>
                <ul className="lp-includes">{l.includes.map((x) => <li key={x}><Icon name="check" />{x}</li>)}</ul>
              </>
            )}
          </section>

          {placeByListing(l.id) && (
            <section className="lp-card lp-place lp-rise" style={{ '--d': '210ms' }}>
              <h2>Ҷойгиршавӣ</h2>
              <Ornament className="lp-ornament" />
              <PlaceMiniMap place={placeByListing(l.id)} />
            </section>
          )}

          <section className="lp-card lp-reviews lp-rise" style={{ '--d': '240ms' }}>
            <div className="lp-card-head">
              <div>
                <h2>Шарҳҳо</h2>
                <Ornament className="lp-ornament" />
              </div>
              {user && !isOwner && <ReviewForm listingId={l.id} onDone={() => { reviews.reload(); res.reload() }} />}
            </div>
            {reviews.loading ? <Spinner /> : reviews.data?.length ? (
              <>
                <RatingSummary items={reviews.data} />
                <ul className="lp-review-list">
                  {reviews.data.map((r) => (
                    <li key={r.id}>
                      <span className="lp-avatar lp-avatar-sm">{initials(r.author.full_name)}</span>
                      <div>
                        <div className="lp-review-head">
                          <b>{r.author.full_name}</b>
                          <Stars value={r.rating} />
                          <span className="lp-soft lp-small">{fmtDate(r.created_at)}</span>
                        </div>
                        {r.text && <p>{r.text}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="lp-empty">
                <svg viewBox="0 0 80 64" aria-hidden="true">
                  <path d="M10 10h48a6 6 0 0 1 6 6v24a6 6 0 0 1-6 6H30l-12 10V46h-8a6 6 0 0 1-6-6V16a6 6 0 0 1 6-6z" />
                  <path d="M24 28l4-8 4 8-4 4zM40 28l4-8 4 8-4 4z" />
                  <circle cx="68" cy="12" r="3" /><circle cx="74" cy="22" r="2" />
                </svg>
                <div>
                  <b>Ҳоло шарҳ нест</b>
                  <p>Шарҳро мизоҷоне менависанд, ки ин хизматро гирифтаанд. Шояд шумо аввалин бошед!</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Навори поёни мобилӣ ба body мебарем: animation-и волидҳо position: fixed-ро вайрон мекунад */}
      {!isOwner && createPortal(
        <>
          <div className="lp-bar" role="region" aria-label="Брон">
            <div className="lp-bar-price"><span>аз</span> <b>{money(l.price_from)}</b><small>{PRICE_UNITS[l.price_unit]}</small></div>
            <button type="button" className="lp-btn lp-btn-gold" onClick={scrollToBooking}>Брон кардан</button>
          </div>
          {/* ҷойи холӣ пас аз footer, то навор охири саҳифаро напӯшонад */}
          <div className="lp-bar-space" aria-hidden="true" />
        </>,
        document.body,
      )}
    </NightPage>
  )
}

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()

/* ---------- Hero: банер + сарлавҳа болои он ---------- */
function Hero({ listing: l, onFav, favBusy }) {
  const images = l.images
  const [idx, setIdx] = useState(0)
  const [lightbox, setLightbox] = useState(-1)
  const touchX = useRef(null)
  // Акси амудӣ ё хурд (масалан мошин аз телефон) дар чорчӯбаи 21:9 бурида ва хира мешавад —
  // онро пурра ва то FIT_ZOOM калон нишон медиҳем, дар паси он ҳамон акс хира
  const [fit, setFit] = useState({})
  const n = images.length
  const go = (d) => setIdx((i) => (i + d + n) % n)

  return (
    <section className="lp-hero">
      <div className={`lp-banner ${n ? '' : 'lp-banner-empty'}`}>
        {n ? (
          <div className="lp-slides"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX)
              if (Math.abs(dx) > 50 && n > 1) go(dx < 0 ? 1 : -1)
              touchX.current = null
            }}>
            {images.map((im, i) => (
              <button type="button" key={im.id} className={`lp-slide ${i === idx ? 'on' : ''}`} onClick={() => setLightbox(i)}
                aria-label={`Акси ${i + 1} — калон кардан`} tabIndex={i === idx ? 0 : -1}>
                {fit[im.id] && <img className="lp-slide-bg" src={imgUrl(im.url)} alt="" aria-hidden="true" />}
                <img className={fit[im.id] ? 'lp-slide-fit' : ''} src={imgUrl(im.url)} alt={i === 0 ? l.title : ''} loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                  style={fit[im.id] && { width: fit[im.id].w * FIT_ZOOM, height: fit[im.id].h * FIT_ZOOM }}
                  onLoad={(e) => {
                    const { naturalWidth: w, naturalHeight: h } = e.currentTarget
                    if (h > w * 0.8 || w < 1100) setFit((p) => (p[im.id] ? p : { ...p, [im.id]: { w, h } }))
                  }} />
              </button>
            ))}
            {n > 1 && (
              <>
                <button type="button" className="lp-hero-nav lp-hero-prev" onClick={() => go(-1)} aria-label="Акси пештар">‹</button>
                <button type="button" className="lp-hero-nav lp-hero-next" onClick={() => go(1)} aria-label="Акси баъдӣ">›</button>
                <div className="lp-dots" aria-hidden="true">{images.map((im, i) => <i key={im.id} className={i === idx ? 'on' : ''} />)}</div>
              </>
            )}
          </div>
        ) : (
          <div className="lp-art-wrap">
            <CategoryArt slug={l.category.slug} />
            <p>Аксҳо ба наздикӣ илова мешаванд</p>
            <span className="lp-shimmer" aria-hidden="true" />
          </div>
        )}

        {['tl', 'tr', 'bl', 'br'].map((c) => (
          <svg key={c} className={`lp-corner lp-corner-${c}`} viewBox="0 0 40 40" aria-hidden="true">
            <path d="M2 26V8a6 6 0 0 1 6-6h18M8 16a8 8 0 0 1 8-8" /><circle cx="15" cy="15" r="1.6" />
          </svg>
        ))}

        <button type="button" className={`lp-fav ${l.is_favorite ? 'on' : ''}`} onClick={onFav} disabled={favBusy}
          aria-label={l.is_favorite ? 'Аз интихобшуда хориҷ кардан' : 'Ба интихобшуда илова кардан'} aria-pressed={l.is_favorite}>
          <Icon name="heart" />
        </button>

        <header className="lp-title">
          <span className="lp-chip"><span aria-hidden="true">{l.category.icon}</span> {l.category.name}</span>
          <h1>{l.title}</h1>
          <div className="lp-meta">
            <span className="lp-meta-item">
              <Icon name="star" />
              {l.rating_count > 0
                ? <><b>{l.rating_avg.toFixed(1)}</b><span className="lp-soft">({l.rating_count} шарҳ)</span></>
                : <span className="lp-soft">Ҳоло шарҳ нест</span>}
            </span>
            <span className="lp-meta-item"><Icon name="pin" />{l.city.name}{l.address ? `, ${l.address}` : ''}</span>
            {l.capacity && <span className="lp-meta-item"><Icon name="users" />то {l.capacity} нафар</span>}
            <span className="lp-meta-item"><Icon name="eye" /><span className="lp-soft">{l.views} тамошо</span></span>
          </div>
        </header>
      </div>

      {n > 1 && (
        <div className="lp-thumbs">
          {images.slice(0, 6).map((im, i) => (
            <button type="button" key={im.id} className={i === idx ? 'on' : ''} onClick={() => (i === 5 && n > 6 ? setLightbox(i) : setIdx(i))} aria-label={`Акси ${i + 1}`}>
              <img src={imgUrl(im.url)} alt="" loading="lazy" decoding="async" />
              {i === 5 && n > 6 && <span className="lp-more">+{n - 6} фото</span>}
            </button>
          ))}
        </div>
      )}

      {lightbox >= 0 && <Lightbox images={images} title={l.title} index={lightbox} setIndex={setLightbox} onClose={() => setLightbox(-1)} />}
    </section>
  )
}

function Lightbox({ images, title, index, setIndex, onClose }) {
  const n = images.length
  const touchX = useRef(null)
  const go = (d) => setIndex((i) => (i + d + n) % n)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % n)
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + n) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [n, onClose, setIndex])

  // Ба body мебарем, то transform-и волидҳо position: fixed-ро вайрон накунад
  return createPortal(
    <div className="lp-lb" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - (touchX.current ?? e.changedTouches[0].clientX)
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touchX.current = null
      }}>
      <button type="button" className="lp-lb-btn lp-lb-close" onClick={onClose} aria-label="Пӯшидан">✕</button>
      {n > 1 && <button type="button" className="lp-lb-btn lp-lb-prev" onClick={() => go(-1)} aria-label="Пештар">‹</button>}
      <figure>
        <img key={index} src={imgUrl(images[index].url)} alt={title} />
        <figcaption>{index + 1} / {n}</figcaption>
      </figure>
      {n > 1 && <button type="button" className="lp-lb-btn lp-lb-next" onClick={() => go(1)} aria-label="Баъдӣ">›</button>}
    </div>,
    document.body,
  )
}

/** Тасвири тиллоии line-art аз рӯи категория: гул, равоқ ё ангуштарин */
function CategoryArt({ slug }) {
  if (FLOWER_CATS.includes(slug)) {
    const petals = [0, 72, 144, 216, 288]
    return (
      <svg className="lp-art" viewBox="0 0 160 120" aria-hidden="true">
        {petals.map((a) => <ellipse key={a} cx="80" cy="40" rx="10" ry="20" transform={`rotate(${a} 80 58)`} />)}
        <circle cx="80" cy="58" r="7" />
        <path d="M80 78c0 14-4 24-10 34M80 90c8-6 16-6 22-2M80 98c-8-4-16-4-22 0" />
      </svg>
    )
  }
  if (ARCH_CATS.includes(slug)) {
    return (
      <svg className="lp-art" viewBox="0 0 160 120" aria-hidden="true">
        <path d="M36 114V58c0-26 20-46 44-46s44 20 44 46v56" />
        <path d="M48 114V60c0-19 14-34 32-34s32 15 32 34v54" />
        <path d="M80 12V4M74 8h12M24 114h112" />
        <circle cx="80" cy="44" r="4" />
      </svg>
    )
  }
  return (
    <svg className="lp-art" viewBox="0 0 160 120" aria-hidden="true">
      <circle cx="64" cy="72" r="30" /><circle cx="96" cy="72" r="30" />
      <path d="M58 30l6-10h12l6 10-12 10z" /><path d="M64 20l6 10 6-10M58 30h24" />
      <path d="M20 72h10M130 72h10" />
    </svg>
  )
}

/* ---------- Тавсиф ---------- */
function Description({ text }) {
  const [open, setOpen] = useState(false)
  if (!text) return <p className="lp-soft">Хизматрасон ҳоло тавсиф нанавиштааст.</p>
  const long = text.length > DESC_LIMIT
  return (
    <>
      <p className="lp-desc-text">{long && !open ? `${text.slice(0, DESC_LIMIT).replace(/\s+\S*$/, '')}…` : text}</p>
      {long && <button type="button" className="lp-link" onClick={() => setOpen(!open)}>{open ? 'Камтар' : 'Бештар хондан'}</button>}
    </>
  )
}

/* ---------- Ҷамъбасти баҳо ---------- */
function RatingSummary({ items }) {
  const total = items.length
  const avg = items.reduce((s, r) => s + r.rating, 0) / total
  return (
    <div className="lp-summary">
      <div className="lp-summary-avg">
        <b>{avg.toFixed(1)}</b>
        <Stars value={avg} />
        <span className="lp-soft lp-small">{total} шарҳ</span>
      </div>
      <ul className="lp-bars">
        {[5, 4, 3, 2, 1].map((s) => {
          const c = items.filter((r) => r.rating === s).length
          return (
            <li key={s}>
              <span>{s} ★</span>
              <span className="lp-bar-track"><i style={{ width: `${(c / total) * 100}%` }} /></span>
              <span className="lp-soft">{c}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- Нишонаҳои тиллоӣ (line-art) ---------- */
function Icon({ name }) {
  const p = {
    star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
    pin: <><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.2c2.8.3 5 2.6 5 5.8" /></>,
    eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
    phone: <path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z" />,
    heart: <path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20z" />,
    check: <path d="M4 12.5l5 5L20 6.5" />,
  }[name]
  return <svg className={`lp-ico lp-ico-${name}`} viewBox="0 0 24 24" aria-hidden="true">{p}</svg>
}

const FIT_ZOOM = 1.4

/* ---------- Форми брон (мантиқ бетағйир) ---------- */
function BookingForm({ listing }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [date, setDate] = useState('')
  const [guests, setGuests] = useState('')
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [calKey, setCalKey] = useState(0)
  // Қонуни №2048, моддаи 12: оши тӯй — то 200, зиёфат — то 150 нафар
  const guestLimit = listing.category?.slug === 'oshpaz' ? WEDDING_LIMITS.osh : WEDDING_LIMITS.feast

  const submit = async (e) => {
    e.preventDefault()
    if (!user) return nav(`/login?next=/listing/${listing.id}`)
    if (!date) return setErr(new Error('Санаро дар тақвим интихоб кунед'))
    setBusy(true); setErr(null)
    try {
      await api.book({
        listing_id: listing.id, event_date: date, guests: guests ? Number(guests) : null,
        note, contact_phone: phone,
      })
      toast('Дархост фиристода шуд! Хизматрасон ба зудӣ ҷавоб медиҳад.')
      nav('/bookings')
    } catch (e2) {
      setErr(e2)
      if (e2.status === 409) { setDate(''); setCalKey((k) => k + 1) }
    } finally { setBusy(false) }
  }

  return (
    <form onSubmit={submit} className="lp-form">
      <h3>Брон кардан</h3>
      <Calendar listingId={listing.id} value={date} onChange={setDate} refreshKey={calKey} />
      {date && <p className="lp-picked"><Icon name="check" />Санаи интихобшуда: <b>{fmtDate(date)}</b></p>}
      {date && <WeatherForecast listing={listing} date={date} />}
      {(listing.capacity || listing.price_unit === 'person') && (
        <label className="lp-field">
          <span>Шумораи меҳмонон</span>
          <input type="number" min="1" max={Math.min(listing.capacity || Infinity, guestLimit)} value={guests} onChange={(e) => setGuests(e.target.value)} />
          <small className={`lp-hint ${Number(guests) > guestLimit ? 'over' : ''}`}>
            {Number(guests) > guestLimit ? '⚠ ' : '§ '}
            Тибқи қонун: зиёфат — то {WEDDING_LIMITS.feast}, оши тӯй — то {WEDDING_LIMITS.osh} нафар. <Link to="/qonun">Муфассал</Link>
          </small>
        </label>
      )}
      <label className="lp-field">
        <span>Телефон барои тамос</span>
        <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+992 …" inputMode="tel" />
      </label>
      <label className="lp-field">
        <span>Изҳорот (ихтиёрӣ)</span>
        <textarea rows="2" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Вақт, суроға, хоҳишҳо…" />
      </label>
      <ErrorBox error={err} />
      <button className="lp-btn lp-btn-gold lp-btn-main" disabled={busy}>
        {busy ? 'Фиристода мешавад…' : user ? 'Фиристодани дархост' : 'Барои брон ворид шавед'}
      </button>
    </form>
  )
}

/* ---------- Форми шарҳ (мантиқ бетағйир) ---------- */
function ReviewForm({ listingId, onDone }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  if (!open) return <button type="button" className="lp-btn lp-btn-outline lp-btn-sm" onClick={() => setOpen(true)}>✍ Шарҳ навиштан</button>

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api.addReview(listingId, { rating, text })
      toast('Ташаккур барои шарҳ!')
      setOpen(false); setText(''); onDone()
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }
  return (
    <form className="lp-review-form" onSubmit={submit}>
      <StarInput value={rating} onChange={setRating} />
      <textarea rows="3" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Таассуроти шумо…" />
      <ErrorBox error={err} />
      <div className="lp-row">
        <button className="lp-btn lp-btn-gold lp-btn-sm" disabled={busy}>Фиристодан</button>
        <button type="button" className="lp-btn lp-btn-outline lp-btn-sm" onClick={() => setOpen(false)}>Бекор</button>
      </div>
    </form>
  )
}
