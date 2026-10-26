import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { ErrorBox, Pager, Spinner, useToast } from '../../components/ui'
import { carById } from '../../cars'
import { BOOKING_STATUS, fmtDate, money, useAsync } from '../../utils'

const ROLES = { client: 'Мизоҷ', vendor: 'Хизматрасон', admin: 'Маъмур' }

export default function Admin() {
  const stats = useAsync(() => api.adminStats(), [])
  const [tab, setTab] = useState('listings')
  const s = stats.data
  return (
    <div className="container page">
      <div className="page-head"><h1>Панели маъмур</h1></div>
      {s && (
        <div className="stats">
          <div className="stat"><b>{s.users}</b><span>Корбарон</span></div>
          <div className="stat"><b>{s.vendors}</b><span>Хизматрасонҳо</span></div>
          <div className="stat"><b>{s.active_listings}<small>/{s.listings}</small></b><span>Эълонҳо</span></div>
          <div className="stat"><b>{s.bookings_confirmed}<small>/{s.bookings}</small></b><span>Бронҳо</span></div>
        </div>
      )}
      <div className="seg seg-lg">
        <button className={tab === 'listings' ? 'on' : ''} onClick={() => setTab('listings')}>Эълонҳо</button>
        <button className={tab === 'users' ? 'on' : ''} onClick={() => setTab('users')}>Корбарон</button>
        <button className={tab === 'cars' ? 'on' : ''} onClick={() => setTab('cars')}>Фармоиши мошинҳо</button>
      </div>
      {tab === 'listings' ? <ListingsTable onChange={stats.reload} /> : tab === 'users' ? <UsersTable onChange={stats.reload} /> : <CarOrdersTable />}
    </div>
  )
}

function ListingsTable({ onChange }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const res = useAsync(() => api.adminListings({ q: query, page, size: 20 }), [query, page])
  const toggle = async (l) => {
    try {
      const nl = await api.adminSetListingActive(l.id, !l.is_active)
      res.setData({ ...res.data, items: res.data.items.map((x) => (x.id === nl.id ? nl : x)) })
      onChange()
    } catch (e) { toast(e.message, 'err') }
  }
  return (
    <section className="box">
      <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q) }}>
        <input placeholder="Ҷустуҷӯи эълон…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost">Ёфтан</button>
      </form>
      <ErrorBox error={res.error} />
      {res.loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Сарлавҳа</th><th>Категория</th><th>Шаҳр</th><th>Нарх</th><th>Ҳолат</th><th /></tr></thead>
            <tbody>
              {res.data.items.map((l) => (
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td><Link to={`/listing/${l.id}`}>{l.title}</Link></td>
                  <td>{l.category.name}</td>
                  <td>{l.city.name}</td>
                  <td className="nowrap">{money(l.price_from)}</td>
                  <td><span className={`badge ${l.is_active ? 'badge-ok' : 'badge-muted'}`}>{l.is_active ? 'Фаъол' : 'Пинҳон'}</span></td>
                  <td><button className="btn btn-ghost btn-sm" onClick={() => toggle(l)}>{l.is_active ? 'Пинҳон кардан' : 'Фаъол кардан'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res.data && <Pager page={page} size={20} total={res.data.total} onChange={setPage} />}
    </section>
  )
}

function UsersTable({ onChange }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [page, setPage] = useState(1)
  const res = useAsync(() => api.adminUsers({ q: query, role, page, size: 20 }), [query, role, page])
  const toggle = async (u) => {
    if (u.is_active && !window.confirm(`${u.full_name}-ро бастан? Эълонҳояш низ пинҳон мешаванд.`)) return
    try {
      const nu = await api.adminSetUserActive(u.id, !u.is_active)
      res.setData({ ...res.data, items: res.data.items.map((x) => (x.id === nu.id ? nu : x)) })
      onChange()
    } catch (e) { toast(e.message, 'err') }
  }
  return (
    <section className="box">
      <form className="admin-search" onSubmit={(e) => { e.preventDefault(); setPage(1); setQuery(q) }}>
        <input placeholder="Ном ё email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value) }}>
          <option value="">Ҳама нақшҳо</option>
          {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn btn-ghost">Ёфтан</button>
      </form>
      <ErrorBox error={res.error} />
      {res.loading ? <Spinner /> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Ном</th><th>Email</th><th>Нақш</th><th>Сана</th><th>Ҳолат</th><th /></tr></thead>
            <tbody>
              {res.data.items.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.full_name}</td>
                  <td className="nowrap">{u.email}</td>
                  <td>{ROLES[u.role]}</td>
                  <td className="nowrap">{fmtDate(u.created_at)}</td>
                  <td><span className={`badge ${u.is_active ? 'badge-ok' : 'badge-no'}`}>{u.is_active ? 'Фаъол' : 'Баста'}</span></td>
                  <td>{u.role !== 'admin' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => toggle(u)}>{u.is_active ? 'Бастан' : 'Кушодан'}</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res.data && <Pager page={page} size={20} total={res.data.total} onChange={setPage} />}
    </section>
  )
}

/** Фармоишҳои мошинҳо аз галереяи «Мошинҳои бартар» */
function CarOrdersTable() {
  const toast = useToast()
  const [status, setStatus] = useState('pending')
  const [page, setPage] = useState(1)
  const res = useAsync(() => api.adminCarOrders({ status, page, size: 20 }), [status, page])
  const setSt = async (o, st) => {
    const msg = { confirmed: 'Фармоишро тасдиқ мекунед?', rejected: 'Фармоишро рад мекунед?' }[st]
    if (msg && !window.confirm(msg)) return
    try {
      const no = await api.adminSetCarOrderStatus(o.id, st)
      res.setData({ ...res.data, items: res.data.items.map((x) => (x.id === no.id ? no : x)) })
      toast('Навсозӣ шуд')
    } catch (e) { toast(e.message, 'err') }
  }
  return (
    <section className="box">
      <div className="admin-search">
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value) }} aria-label="Ҳолат">
          <option value="">Ҳама ҳолатҳо</option>
          {Object.entries(BOOKING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <ErrorBox error={res.error} />
      {res.loading ? <Spinner /> : !res.data.items.length ? <p className="muted">Фармоиш нест.</p> : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Мизоҷ</th><th>Телефон</th><th>Сана ва вақт</th><th>Мошинҳо</th><th>Суроға / изҳорот</th><th>Ҳолат</th><th /></tr></thead>
            <tbody>
              {res.data.items.map((o) => {
                const st = BOOKING_STATUS[o.status]
                return (
                  <tr key={o.id}>
                    <td>{o.id}</td>
                    <td>{o.client.full_name}</td>
                    <td className="nowrap"><a href={`tel:${o.contact_phone}`}>{o.contact_phone}</a></td>
                    <td className="nowrap">{fmtDate(o.event_date)}, {o.start_time}</td>
                    <td>{o.cars.map((id) => {
                      const c = carById(id)
                      return <div key={id}>{c ? `${c.name}${c.plates.length ? ` — ${c.plates.join(', ')}` : ''}` : id}</div>
                    })}</td>
                    <td>{o.pickup_address}{o.note && <div className="muted small">{o.note}</div>}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td className="nowrap">
                      {o.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => setSt(o, 'confirmed')}>Тасдиқ</button>{' '}
                          <button className="btn btn-ghost btn-sm" onClick={() => setSt(o, 'rejected')}>Рад</button>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {res.data && <Pager page={page} size={20} total={res.data.total} onChange={setPage} />}
    </section>
  )
}
