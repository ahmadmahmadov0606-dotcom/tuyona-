import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CategoryIcon from './CategoryIcon'
import PHOTOS from './categoryPhotos.gen'
import { Spinner } from './ui'
import './HomeCategories.css'

const PER_ROW = 5
const num = (i) => String(i + 1).padStart(2, '0')
const href = (g) => `/search?group=${g.slug}`

/** Нишонаи line-art дар доираи гулобӣ бо ҳалқаи тиллоӣ */
function IconCircle({ slug, big }) {
  return <span className={`hc-icircle ${big ? 'big' : ''}`}><CategoryIcon slug={slug} /></span>
}

/** Қисми болоӣ: акси категория дар шакли равоқ (агар бошад), вагарна нишонаи калон */
function Media({ slug, sizes }) {
  if (!PHOTOS.includes(slug)) return <span className="hc-media"><IconCircle slug={slug} big /></span>
  const base = `/categories/optimized/${slug}`
  return (
    <span className="hc-media has-photo">
      <img src={`${base}-600.webp`} srcSet={`${base}-600.webp 600w, ${base}-1200.webp 1200w`} sizes={sizes} alt="" loading="lazy" decoding="async" />
    </span>
  )
}

const Pills = ({ g }) => <span className="hc-pills">{g.categories.map((c) => <span key={c.id}>{c.name}</span>)}</span>

/** Бахши «Категорияҳо» — панелҳои кушодашаванда бо рангҳои шири-тиллоии сайт */
export default function HomeCategories({ catalog }) {
  const ref = useRef(null)
  const [shown, setShown] = useState(false) // пайдошавӣ як бор (дар state, то React синфро пок накунад)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { setShown(true); io.disconnect() } }, { rootMargin: '80px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const groups = catalog?.groups || []
  const rows = [groups.slice(0, PER_ROW), groups.slice(PER_ROW)].filter((r) => r.length)

  return (
    <section ref={ref} className={`hc ${shown ? 'in' : ''}`} aria-labelledby="hc-title">
      <span className="hc-rule hc-rule-top" aria-hidden="true" />

      <div className="container hc-in">
        <header className="hc-head">
          <p className="hc-label"><span />Хизматҳо<span /></p>
          <h2 id="hc-title">Категорияҳо</h2>
          <p className="hc-sub">Ҳар чизе, ки тӯй лозим дорад — аз толор то даъватнома.</p>
        </header>

        {!catalog ? <Spinner /> : (
          <>
            <div className="hc-desk">
              {rows.map((row, r) => <PanelRow key={r} row={row} offset={r * PER_ROW} />)}
              <div className="hc-cta-wrap">
                <Link to="/search" className="hc-cta">Тамоми каталогро бинед <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <Carousel groups={groups} />
          </>
        )}
      </div>
      <span className="hc-rule hc-rule-bottom" aria-hidden="true" />
    </section>
  )
}

/** Як қатори 5 панел: панели болои он муш ё focus аст кушода мешавад, вагарна аввалин */
function PanelRow({ row, offset }) {
  const [active, setActive] = useState(0)
  return (
    <div className="hc-row" onMouseLeave={() => setActive(0)}>
      {row.map((g, i) => (
        <Link key={g.id} to={href(g)} className={`hc-panel ${i === active ? 'open' : ''}`} style={{ '--i': i + offset }}
          onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} aria-label={g.name}>
          <span className="hc-closed" aria-hidden="true">
            <span className="hc-vname">{g.name}</span>
            <IconCircle slug={g.slug} />
          </span>
          <span className="hc-open">
            <Media slug={g.slug} sizes="(min-width: 1400px) 640px, 50vw" />
            <span className="hc-num">{num(i + offset)}</span>
            <span className="hc-name">{g.name}</span>
            <Pills g={g} />
            <span className="hc-go" aria-hidden="true">→</span>
          </span>
        </Link>
      ))}
    </div>
  )
}

/** Мобилӣ/планшет: карусели уфуқӣ бо scroll-snap */
function Carousel({ groups }) {
  const trackRef = useRef(null)
  const [idx, setIdx] = useState(0)

  const onScroll = () => {
    const el = trackRef.current
    const card = el?.firstElementChild
    if (!card) return
    const step = card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || 0)
    setIdx(Math.max(0, Math.min(groups.length - 1, Math.round(el.scrollLeft / step))))
  }

  return (
    <div className="hc-mob">
      <div className="hc-track" ref={trackRef} onScroll={onScroll}>
        {groups.map((g, i) => (
          <Link key={g.id} to={href(g)} className="hc-card">
            <Media slug={g.slug} sizes="78vw" />
            <span className="hc-card-body">
              <span className="hc-num">{num(i)}</span>
              <span className="hc-name">{g.name}</span>
              <Pills g={g} />
            </span>
            <span className="hc-go" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
      <div className="hc-progress" aria-hidden="true">
        <span className="hc-bar"><i style={{ transform: `scaleX(${(idx + 1) / groups.length})` }} /></span>
        <span className="hc-count">{num(idx)} / {num(groups.length - 1)}</span>
      </div>
      <Link to="/search" className="hc-cta-mob">Тамоми каталогро бинед <span aria-hidden="true">→</span></Link>
    </div>
  )
}
