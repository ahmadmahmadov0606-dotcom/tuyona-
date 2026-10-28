import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import CarsGallery from '../components/CarsGallery'
import CategoryIcon from '../components/CategoryIcon'
import { categoryPhoto } from '../components/categoryMedia'
import PageBackground from '../components/PageBackground'
import { ErrorBox, Pager, Stars, useToast } from '../components/ui'
import { creditFor } from '../categoryCredits'
import { imgUrl, money, PRICE_UNITS, todayISO, useAsync, useCatalog } from '../utils'
import './Search.css'

const SORTS = {
  popular: 'Маъмултарин', rating: 'Баҳои баланд', price_asc: 'Арзонтар', price_desc: 'Қиматтар', new: 'Навтарин',
}
const KEYS = ['q', 'category', 'group', 'city', 'min_price', 'max_price', 'min_capacity', 'available_on', 'sort', 'page']
const EXTRA_KEYS = ['q', 'available_on', 'min_price', 'max_price', 'min_capacity']

// Як сатри кӯтоҳ барои hero-и ҳар гурӯҳ
const GROUP_DESC = {
  venue: 'Тӯйхонаҳо, толорҳо ва боғҳо барои ҳар андозаи тӯй',
  transport: 'Мошини арӯс, кортеж ва нақлиёт барои меҳмонон',
  bride: 'Либос, атлас, ҳуснорой ва ҷавоҳирот барои арӯс',
  groom: 'Костюм, чапон ва сартарошхона барои домод',
  program: 'Сароянда, тамада, карнайчӣ, садо ва равшанӣ',
  media: 'Суратгир, видеограф ва дрон — хотираҳои абадӣ',
  food: 'Ошпаз, оши тӯй, торт, дастархон ва ширинӣ',
  decor: 'Ороиши толор, гулҳо, арк ва пуфакҳо',
  planning: 'Ташкилотчии тӯй, пешхизматҳо ва меҳмондорӣ',
  other: 'Даъватнома ва иҷораи миз, курсӣ ва хайма',
}
const ALL_DESC = 'Ҳамаи хизматҳои тӯй дар як ҷо — бо нарх ва санаҳои холӣ'

export default function Search() {
  const [sp, setSp] = useSearchParams()
  const catalog = useCatalog()
  const params = Object.fromEntries(KEYS.map((k) => [k, sp.get(k) || '']))
  const page = Number(params.page) || 1
  const [q, setQ] = useState(params.q)
  const [filtersOpen, setFiltersOpen] = useState(false)
  useEffect(() => setQ(params.q), [params.q])

  const res = useAsync(() => api.search({ ...params, sort: params.sort || 'popular', page, size: 12 }), [sp.toString()])

  const update = (patch) => {
    const next = new URLSearchParams(sp)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in patch)) next.delete('page')
    setSp(next)
  }

  const groupSlug = params.group || catalog?.categories.find((c) => c.slug === params.category)?.group.slug
  const group = catalog?.groups.find((g) => g.slug === groupSlug)
  const cat = catalog?.categories.find((c) => c.slug === params.category)
  const hasFilters = KEYS.some((k) => k !== 'sort' && k !== 'page' && params[k])
  const extraCount = EXTRA_KEYS.filter((k) => params[k]).length

  // Ҷадвалҳо: дар саҳифаи гурӯҳ — зеркатегорияҳо, дар «Ҳамаи хизматҳо» — гурӯҳҳо
  const tabs = !catalog ? [] : group
    ? [
        { key: 'all', label: 'Ҳама', active: !params.category, go: () => update({ category: '', group: group.slug }) },
        ...group.categories.map((c) => ({
          key: c.slug, label: c.name, active: params.category === c.slug,
          go: () => update({ category: params.category === c.slug ? '' : c.slug, group: group.slug }),
        })),
      ]
    : [
        { key: 'all', label: 'Ҳама', active: true, go: () => update({ group: '', category: '' }) },
        ...catalog.groups.map((g) => ({ key: g.slug, label: g.name, active: false, go: () => update({ group: g.slug, category: '' }) })),
      ]

  const heroPhoto = group ? categoryPhoto(group.slug) : null
  const heroCredit = heroPhoto ? creditFor(group.slug) : null
  const favs = useFavorites()
  const groupOf = (l) => catalog?.categories.find((c) => c.id === l.category.id)?.group.slug

  return (
    <div className="cp">
      <PageBackground />
      <div className="container">
        {/* ----- Hero ----- */}
        <section className={`cp-hero ${heroPhoto ? 'has-photo' : ''}`}>
          {heroPhoto && (
            <img key={group.slug} className="cp-hero-photo" src={heroPhoto.src} srcSet={heroPhoto.srcSet} sizes="(max-width: 1300px) 100vw, 1300px"
              alt="" decoding="async" />
          )}
          <nav className="cp-crumbs" aria-label="Пайраҳа">
            <Link to="/search">Хизматҳо</Link>
            {group && <><span aria-hidden="true">›</span>{cat ? <Link to={`/search?group=${group.slug}`}>{group.name}</Link> : <span>{group.name}</span>}</>}
            {cat && <><span aria-hidden="true">›</span><span>{cat.name}</span></>}
          </nav>
          <div className="cp-hero-in">
            <CategoryIcon key={groupSlug || 'all'} slug={groupSlug || 'all'} className="cp-hero-ico cat-ico-draw" />
            <div>
              <h1>{group ? group.name : 'Ҳамаи хизматҳо'}</h1>
              <p>{group ? GROUP_DESC[group.slug] || ALL_DESC : ALL_DESC}</p>
            </div>
          </div>
          {heroCredit && (
            <a className="cp-hero-credit" href={heroCredit.page} target="_blank" rel="noopener noreferrer">
              Акс: {heroCredit.author} / {heroCredit.license}
            </a>
          )}
        </section>

        {/* ----- Ҷадвалҳо ----- */}
        {catalog && <Tabs tabs={tabs} />}
      </div>

      {/* Галереяи пурраи мошинҳо — дар категорияи «Нақлиёт» */}
      {groupSlug === 'transport' && <CarsGallery />}

      <div className="container">

        {/* ----- Панели асбобҳо ----- */}
        <div className="cp-toolbar">
          <p className="cp-count">{res.data ? <><b>{res.data.total}</b> хизмат</> : ' '}</p>
          <div className="cp-tools">
            <label className="cp-select">
              <span className="sr-only">Шаҳр</span>
              <select value={params.city} onChange={(e) => update({ city: e.target.value })} aria-label="Шаҳр">
                <option value="">Ҳама шаҳрҳо</option>
                {catalog?.cities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <label className="cp-select">
              <select value={params.sort || 'popular'} onChange={(e) => update({ sort: e.target.value })} aria-label="Тартиб">
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <button type="button" className={`cp-filter-btn ${filtersOpen ? 'on' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}>
              Филтрҳо{extraCount > 0 && <span className="cp-badge">{extraCount}</span>}
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div className="cp-filters">
            <form onSubmit={(e) => { e.preventDefault(); update({ q }) }} className="cp-field">
              <span>Ҷустуҷӯ</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ном ё калимаи калидӣ" />
            </form>
            <label className="cp-field">
              <span>Холӣ дар сана</span>
              <input type="date" min={todayISO()} value={params.available_on} onChange={(e) => update({ available_on: e.target.value })} />
            </label>
            <div className="cp-field">
              <span>Нарх (сомонӣ)</span>
              <div className="cp-row2">
                <input type="number" min="0" placeholder="аз" key={"min_price" + params.min_price} defaultValue={params.min_price}
                  onBlur={(e) => update({ min_price: e.target.value })} aria-label="Нарх аз" />
                <input type="number" min="0" placeholder="то" key={"max_price" + params.max_price} defaultValue={params.max_price}
                  onBlur={(e) => update({ max_price: e.target.value })} aria-label="Нарх то" />
              </div>
            </div>
            <label className="cp-field">
              <span>Шумораи меҳмонон (ҳадди ақал)</span>
              <input type="number" min="1" key={"min_capacity" + params.min_capacity} defaultValue={params.min_capacity} placeholder="масалан 150"
                onBlur={(e) => update({ min_capacity: e.target.value })} />
            </label>
            {hasFilters && <button type="button" className="cp-clear" onClick={() => setSp({})}>Тоза кардани филтрҳо</button>}
          </div>
        )}

        <ErrorBox error={res.error} onRetry={res.reload} />

        {/* ----- Натиҷаҳо ----- */}
        {res.loading ? (
          <div className="cp-grid" aria-busy="true" aria-label="Бор шуда истодааст">
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : res.data?.items.length === 0 ? (
          <div className="cp-empty">
            <CategoryIcon slug={groupSlug || 'all'} className="cp-empty-ico" />
            <h2>Дар ин категория ҳоло хизмат нест</h2>
            <p>{hasFilters ? 'Филтрҳоро тағйир диҳед ё санаи дигарро интихоб кунед.' : 'Ба зудӣ хизматрасонҳои нав илова мешаванд.'}</p>
            <div className="cp-empty-actions">
              {hasFilters && <button type="button" className="cp-btn-outline" onClick={() => setSp({})}>Тоза кардани филтрҳо</button>}
              <Link to="/search" className="cp-btn-gold">Ба ҳамаи категорияҳо</Link>
            </div>
          </div>
        ) : res.data && (
          <>
            <div className="cp-grid">
              {res.data.items.map((l, i) => (
                <ResultCard key={l.id} l={l} i={i} iconSlug={groupOf(l)} fav={favs.has(l.id)} onFav={() => favs.toggle(l)} />
              ))}
            </div>
            <div className="cp-pager">
              <Pager page={page} size={12} total={res.data.total} onChange={(p) => update({ page: String(p) })} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/** Ҷадвалҳо бо хати тиллоии ҳаракаткунанда (transform) */
function Tabs({ tabs }) {
  const wrapRef = useRef(null)
  const barRef = useRef(null)
  const activeIdx = tabs.findIndex((t) => t.active)

  useLayoutEffect(() => {
    const place = () => {
      const wrap = wrapRef.current
      const btn = wrap?.children[activeIdx]
      if (!btn || !barRef.current) return
      barRef.current.style.transform = `translateX(${btn.offsetLeft}px) scaleX(${btn.offsetWidth})`
      barRef.current.style.opacity = '1'
      // дар мобилӣ ҷадвали фаъол дар мобайн бошад (танҳо навор scroll мешавад)
      if (wrap.scrollWidth > wrap.clientWidth) wrap.scrollTo({ left: btn.offsetLeft - (wrap.clientWidth - btn.offsetWidth) / 2, behavior: 'smooth' })
    }
    place()
    window.addEventListener('resize', place)
    document.fonts?.ready.then(place)
    return () => window.removeEventListener('resize', place)
  }, [activeIdx, tabs.length, tabs[1]?.key])

  return (
    <div className="cp-tabs-wrap">
      <div className="cp-tabs" ref={wrapRef} role="tablist" aria-label="Зеркатегорияҳо">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={t.active} className={`cp-tab ${t.active ? 'on' : ''}`} onClick={t.go}>{t.label}</button>
        ))}
        <span className="cp-tab-bar" ref={barRef} aria-hidden="true" />
      </div>
    </div>
  )
}

/** Интихобшудаҳои корбар (агар ворид шуда бошад) */
function useFavorites() {
  const { user } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const toast = useToast()
  const [ids, setIds] = useState(() => new Set())

  useEffect(() => {
    if (!user) { setIds(new Set()); return undefined }
    let alive = true
    api.favorites().then((list) => alive && setIds(new Set(list.map((x) => x.id)))).catch(() => {})
    return () => { alive = false }
  }, [user])

  const toggle = async (l) => {
    if (!user) return nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)
    const on = !ids.has(l.id)
    const flip = (add) => setIds((s) => { const n = new Set(s); if (add) n.add(l.id); else n.delete(l.id); return n })
    flip(on)
    try {
      await api.favorite(l.id, on)
      toast(on ? 'Ба интихобшуда илова шуд' : 'Аз интихобшуда хориҷ шуд')
    } catch (e) { flip(!on); toast(e.message, 'err') }
  }
  return { has: (id) => ids.has(id), toggle }
}

function ResultCard({ l, i, iconSlug, fav, onFav }) {
  const cover = imgUrl(l.cover)
  // Агар хизматрасон акс нагузошта бошад — акси категория (Wikimedia Commons, ниг. /aksho)
  const fallback = !cover && iconSlug ? categoryPhoto(iconSlug) : null
  return (
    <article className="cp-card" style={{ '--i': i % 3 }}>
      <Link to={`/listing/${l.id}`} className="cp-card-link" aria-label={l.title} />
      <div className="cp-img">
        {cover ? <img src={cover} alt="" loading="lazy" decoding="async" />
          : fallback ? (
            <>
              <img src={fallback.src} srcSet={fallback.srcSet} sizes="(max-width: 767px) 92vw, 420px" alt="" loading="lazy" decoding="async" />
              <span className="lc-veil" aria-hidden="true" />
              <span className="lc-badge"><CategoryIcon slug={iconSlug} /></span>
            </>
          ) : <div className="cp-ph"><CategoryIcon slug={iconSlug} /></div>}
        <span className="cp-tag">{l.category.name}</span>
        {!l.is_active && <span className="cp-off">Пинҳон</span>}
        <button type="button" className={`cp-fav ${fav ? 'on' : ''}`} onClick={onFav} aria-pressed={fav}
          aria-label={fav ? 'Аз интихобшуда хориҷ кардан' : 'Ба интихобшуда илова кардан'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20z" /></svg>
        </button>
      </div>
      <div className="cp-body">
        <h3>{l.title}</h3>
        <p className="cp-loc">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
          {l.city.name}{l.capacity ? ` · то ${l.capacity} нафар` : ''}
        </p>
        <div className="cp-rate">{l.rating_count > 0 ? <Stars value={l.rating_avg} count={l.rating_count} /> : <span className="cp-new">Нав</span>}</div>
        <div className="cp-foot">
          <span className="cp-price"><span>аз</span> <b>{money(l.price_from)}</b> <small>{PRICE_UNITS[l.price_unit]}</small></span>
          <span className="cp-go" aria-hidden="true">Дидан <i>→</i></span>
        </div>
      </div>
    </article>
  )
}

function SkeletonCard() {
  return (
    <div className="cp-card cp-skel" aria-hidden="true">
      <div className="cp-img cp-shimmer" />
      <div className="cp-body">
        <span className="cp-sk cp-shimmer" style={{ width: '80%' }} />
        <span className="cp-sk cp-shimmer" style={{ width: '50%' }} />
        <span className="cp-sk cp-shimmer" style={{ width: '35%', height: 22 }} />
      </div>
    </div>
  )
}
