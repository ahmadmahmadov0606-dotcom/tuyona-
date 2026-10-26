import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CategoryIcon from './CategoryIcon'
import { categoryPhoto, groupHref, pad2, useInView } from './categoryMedia'
import { Spinner } from './ui'
import './CategoriesC.css'

/** Варианти C — «Индекси журналӣ»: рӯйхати рақамдор ва корте, ки аз паси курсор мегардад */
export default function CategoriesC({ catalog }) {
  const ref = useRef(null)
  const cardRef = useRef(null)
  const shown = useInView(ref, { margin: '0px 0px -60px 0px' })
  const [hover, setHover] = useState(null) // гурӯҳи зери курсор

  // Корти шинокунанда: ҳамвор (lerp) аз паси курсор — танҳо transform
  useEffect(() => {
    const sec = ref.current
    const card = cardRef.current
    if (!sec || !card || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, running = false
    const loop = () => {
      x += (tx - x) * (reduce ? 1 : 0.14)
      y += (ty - y) * (reduce ? 1 : 0.14)
      card.style.transform = `translate3d(${x}px, ${y}px, 0)`
      if (Math.abs(tx - x) > 0.3 || Math.abs(ty - y) > 0.3) raf = requestAnimationFrame(loop)
      else running = false
    }
    const onMove = (e) => {
      const r = sec.getBoundingClientRect()
      tx = e.clientX - r.left + 28
      ty = e.clientY - r.top - 140
      if (!running) { running = true; raf = requestAnimationFrame(loop) }
    }
    const onEnter = (e) => { const r = sec.getBoundingClientRect(); x = tx = e.clientX - r.left + 28; y = ty = e.clientY - r.top - 140 }
    sec.addEventListener('pointermove', onMove)
    sec.addEventListener('pointerenter', onEnter)
    return () => { cancelAnimationFrame(raf); sec.removeEventListener('pointermove', onMove); sec.removeEventListener('pointerenter', onEnter) }
  }, [])

  const groups = catalog?.groups || []
  const photo = hover ? categoryPhoto(hover.slug) : null

  return (
    <section ref={ref} className={`cc ${shown ? 'in' : ''}`} aria-labelledby="cc-title">
      <div className="cc-bg" aria-hidden="true"><span className="cc-mark">ТӮЙ</span></div>
      <div className="container cc-in">
        <header className="cc-head">
          <div>
            <p className="cc-label">Хизматҳо · Индекс</p>
            <h2 id="cc-title">Категорияҳо</h2>
          </div>
          <p className="cc-sub">Ҳар чизе, ки тӯй лозим дорад — аз толор то даъватнома.</p>
        </header>

        {!catalog ? <Spinner /> : (
          <ol className="cc-list" onMouseLeave={() => setHover(null)}>
            {groups.map((g, i) => (
              <li key={g.id} style={{ '--i': i }}>
                <Link to={groupHref(g)} className="cc-row" onMouseEnter={() => setHover(g)} onFocus={() => setHover(g)} onBlur={() => setHover(null)}>
                  <span className="cc-ico-mob" aria-hidden="true"><CategoryIcon slug={g.slug} /></span>
                  <span className="cc-num">{pad2(i)}</span>
                  <span className="cc-name">{g.name}</span>
                  <span className="cc-subs">{g.categories.map((c) => c.name).join(' · ')}</span>
                  <span className="cc-arrow" aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ol>
        )}

        <div className="cc-cta-wrap">
          <Link to="/search" className="cc-cta">Тамоми каталогро бинед <span aria-hidden="true">→</span></Link>
        </div>
      </div>

      <div className={`cc-float ${hover ? 'on' : ''}`} ref={cardRef} aria-hidden="true">
        <span className="cc-float-in">
          {photo
            ? <img key={hover.slug} src={photo.src} srcSet={photo.srcSet} sizes="220px" alt="" />
            : hover && <CategoryIcon key={hover.slug} slug={hover.slug} className="cc-float-ico cat-ico-draw" />}
          {hover && <span className="cc-float-name">{hover.name}</span>}
        </span>
      </div>
    </section>
  )
}
