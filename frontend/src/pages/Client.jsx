import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Empty, ErrorBox, ListingCard, Spinner, useToast } from '../components/ui'
import { carById } from '../cars'
import { BOOKING_STATUS, fmtDate, imgUrl, todayISO, useAsync } from '../utils'
import Icon from '../components/Icon'

export function Favorites() {
  const res = useAsync(() => api.favorites(), [])
  return (
    <div className="container page">
      <div className="page-head"><h1>Интихобшуда</h1></div>
      <ErrorBox error={res.error} onRetry={res.reload} />
      {res.loading ? <Spinner /> : res.data?.length ? (
        <div className="grid">{res.data.map((l) => <ListingCard key={l.id} l={l} />)}</div>
      ) : (
        <Empty icon={<Icon name="heart" />} title="Ҳоло холӣ" text="Хизматҳои писандидаро бо ♡ нигоҳ доред, то баъд муқоиса кунед."
          action={<Link to="/search" className="btn btn-primary">Ҷустуҷӯ</Link>} />
      )}
    </div>
  )
}

export function BookingRow({ b, actions, showClient }) {
  const st = BOOKING_STATUS[b.status]
  const cover = imgUrl(b.listing.cover)
  return (
    <div className="booking-row">
      <Link to={`/listing/${b.listing.id}`} className="br-img">
        {cover ? <img src={cover} alt="" /> : <Icon name="sparkle" />}
      </Link>
      <div className="br-body">
        <Link to={`/listing/${b.listing.id}`} className="br-title">{b.listing.title}</Link>
        <div className="br-meta">
          <span><Icon name="calendar" /> <b>{fmtDate(b.event_date)}</b></span>
          {b.guests && <span><Icon name="users" /> {b.guests} нафар</span>}
          {showClient && <span><Icon name="user" /> {b.client.full_name}</span>}
          {showClient && <a href={`tel:${b.contact_phone}`}><Icon name="phone" /> {b.contact_phone}</a>}
        </div>
        {b.note && <p className="br-note">“{b.note}”</p>}
      </div>
      <div className="br-side">
        <span className={`badge ${st.cls}`}>{st.label}</span>
        {actions}
      </div>
    </div>
  )
}

export function MyBookings() {
  const res = useAsync(() => api.myBookings(), [])
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  const today = todayISO()

  const cancel = async (b) => {
    if (!window.confirm('Бронро бекор мекунед?')) return
    setBusy(b.id)
    try {
      const nb = await api.setBookingStatus(b.id, 'cancelled')
      res.setData(res.data.map((x) => (x.id === nb.id ? nb : x)))
      toast('Брон бекор шуд')
    } catch (e) { toast(e.message, 'err') } finally { setBusy(null) }
  }

  const upcoming = res.data?.filter((b) => b.event_date >= today) || []
  const past = res.data?.filter((b) => b.event_date < today) || []

  return (
    <div className="container page narrow">
      <div className="page-head"><h1>Бронҳои ман</h1></div>
      <p className="alert alert-info">
        <span>Тибқи қонун дар бораи тӯй ба <b>комиссияи доимии маҳаллӣ</b> хабар диҳед ва бо тӯйхона ва санъаткорон <b>шартномаи хаттӣ</b> бандед. <Link to="/qonun">Қонуни тӯй</Link></span>
      </p>
      <ErrorBox error={res.error} onRetry={res.reload} />
      {res.loading ? <Spinner /> : !res.data?.length ? (
        <Empty icon={<Icon name="calendar" />} title="Ҳоло брон надоред" text="Хизмати лозимиро ёбед ва санаи тӯйро брон кунед."
          action={<Link to="/search" className="btn btn-primary">Ҷустуҷӯ</Link>} />
      ) : (
        <>
          {upcoming.length > 0 && <h2 className="h-sec">Наздик</h2>}
          {upcoming.map((b) => (
            <BookingRow key={b.id} b={b} actions={
              ['pending', 'confirmed'].includes(b.status) && (
                <button className="btn btn-ghost btn-sm" disabled={busy === b.id} onClick={() => cancel(b)}>Бекор кардан</button>
              )} />
          ))}
          {past.length > 0 && <h2 className="h-sec">Гузашта</h2>}
          {past.map((b) => (
            <BookingRow key={b.id} b={b} actions={
              b.status === 'confirmed' && <Link className="btn btn-ghost btn-sm" to={`/listing/${b.listing.id}`}><Icon name="pen" /> Шарҳ</Link>} />
          ))}
        </>
      )}
      <CarOrders />
    </div>
  )
}

function CarNames({ ids }) {
  return ids.map((id) => carById(id)).filter(Boolean).map((c) => `${c.name}${c.plates.length ? ` (${c.plates.join(', ')})` : ''}`).join(' · ')
}

/** Фармоишҳои мошинҳо аз галереяи «Мошинҳои бартар» */
function CarOrders() {
  const res = useAsync(() => api.myCarOrders(), [])
  const toast = useToast()
  const [busy, setBusy] = useState(null)
  if (res.loading || !res.data?.length) return null

  const cancel = async (o) => {
    if (!window.confirm('Фармоиши мошинҳоро бекор мекунед?')) return
    setBusy(o.id)
    try {
      const no = await api.cancelCarOrder(o.id)
      res.setData(res.data.map((x) => (x.id === no.id ? no : x)))
      toast('Фармоиш бекор шуд')
    } catch (e) { toast(e.message, 'err') } finally { setBusy(null) }
  }

  return (
    <>
      <h2 className="h-sec">Фармоиши мошинҳо</h2>
      {res.data.map((o) => {
        const st = BOOKING_STATUS[o.status]
        const first = carById(o.cars[0])
        return (
          <div key={o.id} className="booking-row">
            <span className="br-img">{first ? <img src={`/cars/optimized/car-${first.id}-600.webp`} alt="" /> : <Icon name="car" />}</span>
            <div className="br-body">
              <span className="br-title">Кортеж — {o.cars.length} мошин</span>
              <div className="br-meta">
                <span><Icon name="calendar" /> <b>{fmtDate(o.event_date)}</b>, {o.start_time}</span>
                {o.pickup_address && <span><Icon name="pin" /> {o.pickup_address}</span>}
              </div>
              <p className="br-note"><CarNames ids={o.cars} /></p>
            </div>
            <div className="br-side">
              <span className={`badge ${st.cls}`}>{st.label}</span>
              {['pending', 'confirmed'].includes(o.status) && o.event_date >= todayISO() && (
                <button className="btn btn-ghost btn-sm" disabled={busy === o.id} onClick={() => cancel(o)}>Бекор кардан</button>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
