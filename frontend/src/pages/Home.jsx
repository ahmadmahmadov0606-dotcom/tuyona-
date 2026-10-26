import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { Ornament, Suzani, Tilt } from '../components/fx'
import FittingTeaser from '../components/FittingTeaser'
import PlacesMap from '../components/map/PlacesMap'
import Hero3D from '../components/Hero3D'
import PageBackground from '../components/PageBackground'
import CategoriesA from '../components/CategoriesA'
import CategoriesB from '../components/CategoriesB'
import CategoriesC from '../components/CategoriesC'
import { ListingCard, Spinner } from '../components/ui'
import { todayISO, useAsync, useCatalog } from '../utils'

// МУВАҚҚАТӢ: барои муқоисаи 3 дизайни «Категорияҳо» — /?cat=a | b | c. Пас аз интихоб нест карда мешавад.
const CATEGORY_VARIANTS = { a: CategoriesA, b: CategoriesB, c: CategoriesC }

export default function Home() {
  const [sp] = useSearchParams()
  const Categories = CATEGORY_VARIANTS[sp.get('cat')] || CategoriesA
  const catalog = useCatalog()
  const nav = useNavigate()
  const [form, setForm] = useState({ q: '', category: '', city: '', available_on: '' })
  const popular = useAsync(() => api.search({ sort: 'popular', size: 8 }), [])
  const anchor = useRef(null)

  const go = (f) => {
    const p = new URLSearchParams()
    Object.entries(f).forEach(([k, v]) => {
      if (!v) return
      // «group:slug» — тамоми гурӯҳ (масалан ҳамаи нақлиёт), вагарна slug-и категория
      if (k === 'category' && v.startsWith('group:')) p.set('group', v.slice(6))
      else p.set(k, v)
    })
    nav(`/search?${p}`)
  }
  const submit = (e) => {
    e.preventDefault()
    go(form)
  }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  // Категорияро интихоб кард — фавран ба ҳамон категория мегузарем
  const pickCategory = (e) => {
    const f = { ...form, category: e.target.value }
    setForm(f)
    if (f.category) go(f)
  }

  return (
    <>
      <PageBackground />
      <section className="hero">
        <div className="hero-sky" aria-hidden="true" />
        <Hero3D anchorRef={anchor} />
        <div className="container hero-in">
          <div className="hero-grid">
            <div className="hero-anchor" ref={anchor} aria-hidden="true" />
            <div className="hero-copy">
              <p className="eyebrow"><span className="eyebrow-line" />Платформаи тӯй дар Тоҷикистон</p>
              <h1>Ҳама чизи тӯй<br /><em>дар як ҷо</em></h1>
              <p className="hero-sub">Тӯйхона, мошини арӯс, сароянда, суратгир, либос ва ошпаз. Санаҳои холиро бинед ва бевосита брон кунед.</p>
              <div className="hero-badges">
                <span><b>✦</b> Санаҳои холӣ дар вақти воқеӣ</span>
                <span><b>✦</b> Шарҳҳои мизоҷони воқеӣ</span>
              </div>
            </div>
          </div>

          <form className="search-box" onSubmit={submit}>
            <label className="sb-field sb-wide">
              <span>Чӣ лозим?</span>
              <input placeholder="Масалан: лимузин, тӯйхона…" value={form.q} onChange={set('q')} />
            </label>
            <label className="sb-field">
              <span>Категория</span>
              <select value={form.category} onChange={pickCategory}>
                <option value="">Ҳама</option>
                {catalog?.groups.map((g) => (
                  <optgroup key={g.id} label={`${g.icon} ${g.name}`}>
                    <option value={`group:${g.slug}`}>Ҳамаи «{g.name}»</option>
                    {g.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="sb-field">
              <span>Шаҳр</span>
              <select value={form.city} onChange={set('city')}>
                <option value="">Ҳама шаҳрҳо</option>
                {catalog?.cities.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </select>
            </label>
            <label className="sb-field">
              <span>Санаи тӯй</span>
              <input type="date" min={todayISO()} value={form.available_on} onChange={set('available_on')} />
            </label>
            <button className="btn btn-gold btn-lg">Ҷустуҷӯ</button>
          </form>
        </div>
        <div className="hero-arch-edge" aria-hidden="true" />
      </section>

      <div className="ribbons" aria-hidden="true">
        <div className="ribbon ribbon-a"><div>{RIBBON}{RIBBON}</div></div>
        <div className="ribbon ribbon-b"><div>{RIBBON}{RIBBON}</div></div>
      </div>

      <Categories catalog={catalog} />

      <FittingTeaser />

      <section className="container section">
        <SectionTitle kicker="Интихоби ҷуфтҳои навхонадор" title="Маъмултарин" more={<Link to="/search?sort=popular" className="link">Бештар →</Link>} />
        {popular.loading ? <Spinner /> : (
          <div className="lc-grid">
            {popular.data?.items.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>
        )}
      </section>

      <section className="container section home-map">
        <SectionTitle kicker="Тӯйхонаҳо, тарабхонаҳо, мошинҳо" title="Дар харита"
          more={<Link to="/harita" className="link">Харитаи пурра →</Link>} />
        <PlacesMap variant="section" />
      </section>

      <section className="container section">
        <Link to="/qonun" className="law-teaser reveal">
          <span className="law-teaser-seal" aria-hidden="true">§</span>
          <div>
            <p className="kicker">Қонуни ҶТ аз 20.06.2024, №2048</p>
            <h2>Тӯй дар доираи қонун</h2>
            <p>Зиёфат — то 150 нафар, оши тӯй — то 200 нафар, давомнокӣ — то 3 соат, корвон — то 4 мошин. Ҳамаи талаботи асосӣ ва санҷиши тез.</p>
          </div>
          <span className="btn btn-gold">Муфассал →</span>
        </Link>
      </section>

      <section className="container section how">
        <SectionTitle kicker="Се қадам то рӯзи хушбахтӣ" title="Чӣ тавр кор мекунад?" center />
        <div className="steps">
          {STEPS.map(([t, d], i) => (
            <Tilt key={t} className="step reveal" style={{ '--i': i }}>
              <b>{i + 1}</b><h3>{t}</h3><p>{d}</p>
            </Tilt>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="cta reveal">
          <div className="cta-medallion" aria-hidden="true"><Suzani /></div>
          <div className="cta-copy">
            <h2>Шумо хизмати тӯй пешниҳод мекунед?</h2>
            <p>Тӯйхона, мошин, суратгир ё сароянда — эълон гузоред ва мизоҷони нав пайдо кунед.</p>
          </div>
          <Link to="/register?role=vendor" className="btn btn-gold btn-lg">Хизматрасон шудан</Link>
        </div>
      </section>
    </>
  )
}

const RIBBON = (
  <>
    {['Тӯйхона', 'Мошини арӯс', 'Сароянда', 'Суратгир', 'Либоси арӯс', 'Ошпаз', 'Гулҳо', 'Торт', 'Мусиқӣ'].map((w) => (
      <span key={w}>{w}<i>✦</i></span>
    ))}
  </>
)

const STEPS = [
  ['Ёбед', 'Категория, шаҳр ва санаи тӯйро интихоб кунед — танҳо хизматҳои холӣ нишон дода мешаванд.'],
  ['Муқоиса кунед', 'Нарх, сурат, шарҳу баҳои мизоҷони воқеиро бинед.'],
  ['Брон кунед', 'Дархост фиристед — хизматрасон тасдиқ мекунад ва сана барои шумо банд мешавад.'],
]

function SectionTitle({ kicker, title, more, center }) {
  return (
    <div className={`section-title reveal ${center ? 'is-center' : ''}`}>
      <div>
        <p className="kicker">{kicker}</p>
        <h2>{title}</h2>
        <Ornament />
      </div>
      {more}
    </div>
  )
}
