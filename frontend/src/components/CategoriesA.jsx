import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import CategoryIcon from './CategoryIcon'
import { categoryPhoto, groupHref, pad2, useInView } from './categoryMedia'
import { usePageHidden } from './PageBackground'
import { Spinner } from './ui'
import './CategoriesA.css'

const TITLE = 'Категорияҳо'
const SUBS_SHOWN = 2
const TILT = 6 // дараҷаи ҳадди аксар

/** Шумораи хизматҳои фаъол дар ҳар гурӯҳ (як дархости хурд барои ҳар гурӯҳ, танҳо вақте бахш намоён шуд) */
function useGroupCounts(groups, enabled) {
  const [counts, setCounts] = useState({})
  useEffect(() => {
    if (!enabled || !groups.length) return undefined
    let alive = true
    Promise.all(groups.map((g) => api.search({ group: g.slug, size: 1 }).then((r) => [g.slug, r.total]).catch(() => [g.slug, null])))
      .then((pairs) => alive && setCounts(Object.fromEntries(pairs)))
    return () => { alive = false }
  }, [groups, enabled])
  return counts
}

/** Хами 3D ва нури тиллоии паси курсор (танҳо desktop); CSS аз --rx/--ry/--mx/--my истифода мебарад */
function useTilt() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return undefined
    let raf = 0
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width
      const py = (e.clientY - r.top) / r.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${((px - 0.5) * TILT * 2).toFixed(2)}deg`)
        el.style.setProperty('--rx', `${((0.5 - py) * TILT * 2).toFixed(2)}deg`)
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`)
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`)
      })
    }
    const leave = () => { cancelAnimationFrame(raf); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => { cancelAnimationFrame(raf); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) }
  }, [])
  return ref
}

function ArchCard({ g, i, count }) {
  const ref = useTilt()
  const photo = categoryPhoto(g.slug)
  const subs = g.categories
  return (
    <Link ref={ref} to={groupHref(g)} className={`ca-card ${photo ? 'has-photo' : ''}`} style={{ '--i': i }}>
      <span className="ca-window">
        {photo ? (
          <>
            <img src={photo.src} srcSet={photo.srcSet} sizes="(max-width: 767px) 45vw, 240px" alt="" loading="lazy" decoding="async" />
            <span className="ca-veil" aria-hidden="true" />
            <span className="ca-glass"><CategoryIcon slug={g.slug} className="ca-ico" /></span>
          </>
        ) : <CategoryIcon slug={g.slug} className="ca-ico ca-ico-big" />}
        <span className="ca-shimmer" aria-hidden="true" />
        {count > 0 && <span className="ca-badge">{count} хизмат</span>}
      </span>
      <span className="ca-body">
        <span className="ca-num">{pad2(i)}</span>
        <span className="ca-name">{g.name}</span>
        <span className="ca-subs">
          {subs.slice(0, SUBS_SHOWN).map((c) => <span key={c.id}>{c.name}</span>)}
          {subs.length > SUBS_SHOWN && <span className="ca-more">ва ғайра</span>}
        </span>
      </span>
      <span className="ca-glare" aria-hidden="true" />
    </Link>
  )
}

/** Варианти A — «Тирезаҳои равоқӣ»: навори бургундии қасрӣ + 10 тирезаи равоқӣ бо акс */
export default function CategoriesA({ catalog }) {
  const ref = useRef(null)
  const shown = useInView(ref, { margin: '0px 0px -80px 0px' })
  const onScreen = useInView(ref, { once: false, margin: '120px 0px' })
  const hidden = usePageHidden()
  const groups = catalog?.groups || []
  const counts = useGroupCounts(groups, shown)

  return (
    <section ref={ref} className={`ca ${shown ? 'in' : ''} ${!onScreen || hidden ? 'is-paused' : ''}`} aria-labelledby="ca-title">
      <div className="ca-band" aria-hidden="true"><span className="ca-edge" /></div>
      <div className="container ca-in">
        <header className="ca-head">
          <p className="ca-label">Хизматҳо</p>
          <h2 id="ca-title" aria-label={TITLE}>
            {[...TITLE].map((ch, k) => <span key={k} aria-hidden="true" style={{ '--k': k }}>{ch}</span>)}
          </h2>
          <p className="ca-sub">Ҳар чизе, ки тӯй лозим дорад — аз толор то даъватнома.</p>
        </header>

        {!catalog ? <Spinner /> : (
          <div className="ca-grid">
            {groups.map((g, i) => <ArchCard key={g.id} g={g} i={i} count={counts[g.slug]} />)}
          </div>
        )}

        <div className="ca-cta-wrap">
          <Link to="/search" className="ca-cta">Тамоми каталогро бинед <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  )
}
