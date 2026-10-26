import { useRef } from 'react'
import { Link } from 'react-router-dom'
import CategoryIcon from './CategoryIcon'
import { categoryPhoto, groupHref, useInView } from './categoryMedia'
import { usePageHidden } from './PageBackground'
import { Spinner } from './ui'
import './CategoriesB.css'

const PARTICLES = 18
// Ҷойҳои доимии заррачаҳои тиллоӣ (дар мобилӣ танҳо 8-тои аввал)
const DOTS = Array.from({ length: PARTICLES }, (_, i) => {
  const r = (n) => ((Math.sin((i + 1) * n) * 10000) % 1 + 1) % 1
  return { left: `${(r(12.99) * 94 + 3).toFixed(1)}%`, top: `${(r(78.23) * 80 + 10).toFixed(1)}%`,
    '--s': `${(2 + r(4.58) * 4).toFixed(1)}px`, '--t': `${(14 + r(9.1) * 14).toFixed(1)}s`, animationDelay: `-${(r(3.7) * 20).toFixed(1)}s` }
})

/** Ҳалқаи ороишии гулбаргӣ гирди медалион */
function PetalRing() {
  return (
    <svg className="cb-ring" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" strokeDasharray="1.5 6" />
      {Array.from({ length: 24 }, (_, i) => (
        <path key={i} transform={`rotate(${i * 15} 100 100)`} d="M100 6c3 4 3 8 0 11-3-3-3-7 0-11z" />
      ))}
    </svg>
  )
}

/** Варианти B — «Медалионҳои махмалӣ»: заминаи бургундии торик ва 10 медалиони тиллоӣ */
export default function CategoriesB({ catalog }) {
  const ref = useRef(null)
  const shown = useInView(ref, { margin: '0px 0px -60px 0px' })
  const onScreen = useInView(ref, { once: false, margin: '100px 0px' })
  const hidden = usePageHidden()
  const groups = catalog?.groups || []
  const rows = [groups.slice(0, 5), groups.slice(5)]

  return (
    <section ref={ref} className={`cb ${shown ? 'in' : ''} ${!onScreen || hidden ? 'is-paused' : ''}`} aria-labelledby="cb-title">
      <div className="cb-bg" aria-hidden="true">
        <span className="cb-glow" />
        {DOTS.map((st, i) => <i key={i} className={`cb-dot ${i >= 8 ? 'cb-dot-extra' : ''}`} style={st} />)}
      </div>
      <div className="container cb-in">
        <header className="cb-head">
          <p className="cb-label"><span />Хизматҳо<span /></p>
          <h2 id="cb-title">Категорияҳо</h2>
          <p className="cb-sub">Ҳар чизе, ки тӯй лозим дорад — аз толор то даъватнома.</p>
        </header>

        {!catalog ? <Spinner /> : (
          <div className="cb-hive">
            {rows.map((row, r) => (
              <div key={r} className={`cb-row ${r ? 'cb-row-off' : ''}`}>
                {row.map((g, k) => {
                  const i = r * 5 + k
                  const photo = categoryPhoto(g.slug)
                  return (
                    <Link key={g.id} to={groupHref(g)} className="cb-med" style={{ '--i': i }}>
                      <span className="cb-disc">
                        <PetalRing />
                        <span className="cb-core">
                          {photo
                            ? <img src={photo.src} srcSet={photo.srcSet} sizes="170px" alt="" loading="lazy" decoding="async" />
                            : <CategoryIcon slug={g.slug} className="cb-ico" />}
                        </span>
                      </span>
                      <span className="cb-name">{g.name}</span>
                      <span className="cb-subs">{g.categories.map((c) => <span key={c.id}>{c.name}</span>)}</span>
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        <div className="cb-cta-wrap">
          <Link to="/search" className="cb-cta">Тамоми каталогро бинед <span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  )
}
