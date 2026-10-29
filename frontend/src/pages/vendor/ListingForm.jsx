import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import Calendar from '../../components/Calendar'
import { ErrorBox, Spinner, useToast } from '../../components/ui'
import { fmtDate, imgUrl, PRICE_UNITS, useCatalog } from '../../utils'
import Icon from '../../components/Icon'

const EMPTY = {
  title: '', category_id: '', city_id: '', description: '', address: '',
  contact_phone: '', price_from: '', price_unit: 'event', capacity: '', is_active: true,
}

export default function ListingForm() {
  const { id } = useParams()
  const isNew = !id
  const catalog = useCatalog()
  const nav = useNavigate()
  const toast = useToast()
  const [f, setF] = useState({ ...EMPTY })
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(!isNew)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isNew) return
    api.listing(id).then((l) => {
      setListing(l)
      setF({
        title: l.title, category_id: String(l.category.id), city_id: String(l.city.id), description: l.description,
        address: l.address, contact_phone: l.contact_phone, price_from: String(l.price_from), price_unit: l.price_unit,
        capacity: l.capacity ? String(l.capacity) : '', is_active: l.is_active,
      })
    }).catch(setErr).finally(() => setLoading(false))
  }, [id, isNew])

  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    const body = {
      ...f,
      category_id: Number(f.category_id), city_id: Number(f.city_id),
      price_from: Number(f.price_from), capacity: f.capacity ? Number(f.capacity) : null,
    }
    try {
      if (isNew) {
        delete body.is_active
        const l = await api.createListing(body)
        toast('Эълон сохта шуд! Акнун суратҳоро илова кунед.')
        nav(`/vendor/listings/${l.id}`, { replace: true })
      } else {
        const l = await api.updateListing(id, body)
        setListing(l)
        toast('Тағйирот нигоҳ дошта шуд')
      }
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  const remove = async () => {
    if (!window.confirm('Эълонро тамоман нест мекунед? Ин амалро баргардондан мумкин нест.')) return
    try {
      await api.deleteListing(id)
      toast('Эълон нест карда шуд')
      nav('/vendor')
    } catch (e) { toast(e.message, 'err') }
  }

  if (loading || !catalog) return <Spinner big />
  const cat = catalog.categories.find((c) => String(c.id) === f.category_id)
  const showCapacity = !cat || ['venue', 'food'].includes(cat.group.slug)

  return (
    <div className="container page narrow">
      <nav className="crumbs"><Link to="/vendor">Кабинет</Link> › <span>{isNew ? 'Эълони нав' : 'Таҳрир'}</span></nav>
      <div className="page-head row-between">
        <h1>{isNew ? 'Эълони нав' : f.title}</h1>
        {!isNew && <Link to={`/listing/${id}`} className="btn btn-ghost btn-sm">Дидани саҳифа →</Link>}
      </div>

      <form className="box form" onSubmit={submit}>
        <h2>Маълумоти асосӣ</h2>
        <label className="field">
          <span>Сарлавҳа *</span>
          <input required minLength={3} maxLength={140} value={f.title} onChange={set('title')} placeholder="Масалан: Лимузини сафед бо ронанда" />
        </label>
        <div className="row2">
          <label className="field">
            <span>Категория *</span>
            <select required value={f.category_id} onChange={set('category_id')}>
              <option value="">— интихоб —</option>
              {catalog.groups.map((g) => (
                <optgroup key={g.id} label={`${g.icon} ${g.name}`}>
                  {g.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Шаҳр *</span>
            <select required value={f.city_id} onChange={set('city_id')}>
              <option value="">— интихоб —</option>
              {catalog.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span>Нарх аз (сомонӣ) *</span>
            <input required type="number" min="0" max="10000000" value={f.price_from} onChange={set('price_from')} />
          </label>
          <label className="field">
            <span>Барои</span>
            <select value={f.price_unit} onChange={set('price_unit')}>
              {Object.entries(PRICE_UNITS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field">
            <span>Телефон барои тамос *</span>
            <input required value={f.contact_phone} onChange={set('contact_phone')} />
          </label>
          {showCapacity && (
            <label className="field">
              <span>Ғунҷоиш (нафар)</span>
              <input type="number" min="1" max="10000" value={f.capacity} onChange={set('capacity')} />
            </label>
          )}
        </div>
        <label className="field">
          <span>Суроға</span>
          <input maxLength={200} value={f.address} onChange={set('address')} placeholder="Кӯча, хона, мавзеъ" />
        </label>
        <label className="field">
          <span>Тавсиф</span>
          <textarea rows="6" maxLength={5000} value={f.description} onChange={set('description')}
            placeholder="Чӣ дохил мешавад, шартҳо, таҷриба…" />
        </label>
        {!isNew && (
          <label className="check">
            <input type="checkbox" checked={f.is_active} onChange={set('is_active')} />
            <span>Эълон фаъол аст (дар ҷустуҷӯ намоён)</span>
          </label>
        )}
        <ErrorBox error={err} />
        <div className="row-actions">
          <button className="btn btn-primary btn-lg" disabled={busy}>{busy ? '…' : isNew ? 'Сохтан' : 'Нигоҳ доштан'}</button>
          {!isNew && <button type="button" className="btn btn-danger" onClick={remove}>Нест кардан</button>}
        </div>
      </form>

      {listing && <ImagesManager listing={listing} onChange={setListing} />}
      {listing && <DatesManager listingId={listing.id} />}
    </div>
  )
}

function ImagesManager({ listing, onChange }) {
  const toast = useToast()
  const input = useRef()
  const [busy, setBusy] = useState(false)

  const upload = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    const tooBig = files.find((f) => f.size > 5 * 1024 * 1024)
    if (tooBig) return toast(`«${tooBig.name}» аз 5MB калон аст`, 'err')
    setBusy(true)
    try {
      await api.uploadImages(listing.id, files)
      onChange(await api.listing(listing.id))
      toast('Суратҳо бор шуданд')
    } catch (e2) { toast(e2.message, 'err') } finally { setBusy(false) }
  }

  const remove = async (img) => {
    try {
      await api.deleteImage(listing.id, img.id)
      onChange({ ...listing, images: listing.images.filter((i) => i.id !== img.id) })
    } catch (e) { toast(e.message, 'err') }
  }

  return (
    <section className="box">
      <div className="section-head">
        <h2>Суратҳо <span className="muted small">({listing.images.length}/12)</span></h2>
        <button className="btn btn-ghost btn-sm" disabled={busy || listing.images.length >= 12} onClick={() => input.current.click()}>
          {busy ? 'Бор мешавад…' : '+ Илова кардан'}
        </button>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={upload} />
      </div>
      {listing.images.length === 0 ? (
        <button type="button" className="dropzone" onClick={() => input.current.click()}>
          <Icon name="image" /> Суратҳоро интихоб кунед (JPG, PNG, WEBP, то 5MB). Сурати аввал — муқова.
        </button>
      ) : (
        <div className="img-grid">
          {listing.images.map((im, i) => (
            <div key={im.id} className="img-item">
              <img src={imgUrl(im.url)} alt="" />
              {i === 0 && <span className="chip chip-on-img">Муқова</span>}
              <button className="img-del" aria-label="Нест кардан" onClick={() => remove(im)}>✕</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DatesManager({ listingId }) {
  const toast = useToast()
  const [key, setKey] = useState(0)
  const toggle = async (iso, isBusy) => {
    try {
      if (isBusy) await api.unblockDays(listingId, [iso])
      else await api.blockDays(listingId, [iso])
      toast(isBusy ? `${fmtDate(iso)} озод шуд` : `${fmtDate(iso)} банд шуд`)
      setKey((k) => k + 1)
    } catch (e) { toast(e.message, 'err') }
  }
  return (
    <section className="box">
      <h2>Тақвими бандӣ</h2>
      <p className="muted small">Агар сана берун аз сайт банд шуда бошад, онро пахш кунед — дар ҷустуҷӯ «банд» нишон дода мешавад. Бронҳои тасдиқшуда худкор банд мешаванд.</p>
      <div className="cal-wrap"><Calendar listingId={listingId} mode="manage" onToggle={toggle} refreshKey={key} /></div>
    </section>
  )
}
