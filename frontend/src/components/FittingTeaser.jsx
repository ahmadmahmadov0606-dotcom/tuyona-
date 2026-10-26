import { Link } from 'react-router-dom'
import { api } from '../api'
import { imgUrl, useAsync } from '../utils'
import Icon from './Icon'
import './FittingTeaser.css'

/** Саҳифаи асосӣ: даъват ба ороишгоҳи AI бо либосҳои воқеии каталог */
export default function FittingTeaser() {
  const outfits = useAsync(() => api.tryonOutfits(), [])
  // Аз ҳар категория як либос — то гуногунӣ намоён бошад
  const seen = new Set()
  const picks = (outfits.data || []).filter((l) => !seen.has(l.category.slug) && seen.add(l.category.slug)).slice(0, 4)

  return (
    <section className="container section">
      <div className="ftz reveal">
        <div className="ftz-copy">
          <p className="ftz-kicker"><Icon name="sparkle" /> Нав · Ороишгоҳи AI</p>
          <h2>Либоси тӯйро пеш аз иҷора <em>дар тани худ</em> бинед</h2>
          <p className="ftz-text">Сурати худро бор кунед, костюм ё чапонро аз каталог интихоб кунед — AI дар як дақиқа нишон медиҳад, ки он ба шумо чӣ гуна мезебад.</p>
          <ol className="ftz-steps">
            <li><span><Icon name="camera" /></span>Сурат</li>
            <li><span><Icon name="hanger" /></span>Либос</li>
            <li><span><Icon name="sparkle" /></span>Натиҷа</li>
          </ol>
          <div className="ftz-actions">
            <Link to="/oroishgoh" className="btn btn-gold btn-lg">Озмудан →</Link>
            {outfits.data?.length > 0 && <span className="ftz-count">{outfits.data.length} либос дар каталог</span>}
          </div>
        </div>

        <Link to="/oroishgoh" className="ftz-fan" aria-label="Либосҳои ороишгоҳ">
          {picks.map((l, i) => (
            <figure key={l.id} className="ftz-card" style={{ '--i': i, '--n': picks.length }}>
              <img src={imgUrl(l.cover)} alt="" loading="lazy" decoding="async" />
              <figcaption>{l.category.name}</figcaption>
            </figure>
          ))}
          {!picks.length && <span className="ftz-ph"><Icon name="hanger" /></span>}
        </Link>
      </div>
    </section>
  )
}
