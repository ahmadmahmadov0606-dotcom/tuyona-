import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { Empty, ErrorBox, ListingCard, Spinner, useToast } from '../../components/ui'
import { BookingRow } from '../Client'
import { fmtDate, useAsync } from '../../utils'
import Icon from '../../components/Icon'

const TABS = [
  ['pending', 'Нав'], ['confirmed', 'Тасдиқшуда'], ['', 'Ҳама'],
]

export default function VendorDashboard() {
  const { user } = useAuth()
  const toast = useToast()
  const stats = useAsync(() => api.vendorStats(), [])
  const listings = useAsync(() => api.vendorListings(), [])
  const [tab, setTab] = useState('pending')
  const bookings = useAsync(() => api.incoming(tab || undefined), [tab])
  const [busy, setBusy] = useState(null)

  const act = async (b, status) => {
    const msg = { confirmed: 'Тасдиқ мекунед? Дархостҳои дигари ҳамин сана худкор рад мешаванд.\n\nТибқи қонун (моддаи 17) хизмат бо шартномаи хаттӣ расонида мешавад; шумораи меҳмонон (то 150, оши тӯй то 200) ва вақт (то 3 соат, то 22:00) бояд риоя шаванд.', rejected: 'Рад мекунед?', cancelled: 'Бекор мекунед?' }[status]
    if (!window.confirm(msg)) return
    setBusy(b.id)
    try {
      await api.setBookingStatus(b.id, status)
      toast(status === 'confirmed' ? 'Тасдиқ шуд — сана банд шуд' : 'Навсозӣ шуд')
      bookings.reload(); stats.reload()
    } catch (e) { toast(e.message, 'err'); bookings.reload() } finally { setBusy(null) }
  }

  const s = stats.data
  return (
    <div className="container page">
      <div className="page-head row-between">
        <div>
          <h1>Кабинети хизматрасон</h1>
          <p className="muted">Салом, {user.full_name}!</p>
        </div>
        <Link to="/vendor/listings/new" className="btn btn-primary">+ Эълони нав</Link>
      </div>

      {s && (
        <div className="stats">
          <div className="stat"><b>{s.active_listings}<small>/{s.listings}</small></b><span>Эълонҳои фаъол</span></div>
          <div className="stat"><b>{s.total_views}</b><span>Тамошо</span></div>
          <div className="stat stat-hl"><b>{s.bookings_pending}</b><span>Дархостҳои нав</span></div>
          <div className="stat"><b>{s.bookings_confirmed}</b><span>Тасдиқшуда</span></div>
        </div>
      )}

      {s?.upcoming.length > 0 && (
        <section className="box">
          <h2>Тӯйҳои наздик</h2>
          <ul className="upcoming">
            {s.upcoming.map((b) => (
              <li key={b.id}><b>{fmtDate(b.event_date)}</b> — {b.listing.title} <span className="muted">({b.client.full_name}, {b.contact_phone})</span></li>
            ))}
          </ul>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Дархостҳо</h2>
          <div className="seg">
            {TABS.map(([k, v]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>)}
          </div>
        </div>
        <ErrorBox error={bookings.error} onRetry={bookings.reload} />
        {bookings.loading ? <Spinner /> : !bookings.data?.length ? (
          <Empty icon={<Icon name="inbox" />} title="Дархост нест" text={tab === 'pending' ? 'Дархостҳои нав дар ин ҷо пайдо мешаванд.' : undefined} />
        ) : bookings.data.map((b) => (
          <BookingRow key={b.id} b={b} showClient actions={
            <>
              {b.status === 'pending' && (
                <>
                  <button className="btn btn-primary btn-sm" disabled={busy === b.id} onClick={() => act(b, 'confirmed')}>Тасдиқ</button>
                  <button className="btn btn-ghost btn-sm" disabled={busy === b.id} onClick={() => act(b, 'rejected')}>Рад</button>
                </>
              )}
              {b.status === 'confirmed' && (
                <button className="btn btn-ghost btn-sm" disabled={busy === b.id} onClick={() => act(b, 'cancelled')}>Бекор</button>
              )}
            </>
          } />
        ))}
      </section>

      <section className="section">
        <div className="section-head"><h2>Эълонҳои ман</h2></div>
        <ErrorBox error={listings.error} onRetry={listings.reload} />
        {listings.loading ? <Spinner /> : !listings.data?.length ? (
          <Empty icon={<Icon name="pen" />} title="Ҳоло эълон надоред" text="Аввалин эълонро гузоред — бо сурат ва нарх."
            action={<Link to="/vendor/listings/new" className="btn btn-primary">+ Эълони нав</Link>} />
        ) : (
          <div className="grid">
            {listings.data.map((l) => (
              <div key={l.id} className="vendor-card">
                <ListingCard l={l} />
                <Link to={`/vendor/listings/${l.id}`} className="btn btn-ghost btn-sm btn-block">✏ Таҳрир, сурат ва тақвим</Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
