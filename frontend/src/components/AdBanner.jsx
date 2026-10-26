import { Link } from 'react-router-dom'
import './AdBanner.css'

// Баннери реклама дар саҳифаи асосӣ. Суратро бо файли худ иваз кунед: public/ads/banner.jpg
export default function AdBanner({ image = '/ads/banner.jpg', to = '/search', kicker = 'Реклама', title = 'Ҷои реклама барои шумо',
  text = 'Хизмати худро ба ҳазорон ҷуфтҳои навхонадор нишон диҳед.', cta = 'Муфассал' }) {
  return (
    <section className="container section">
      <Link to={to} className="ad-banner reveal">
        <img src={image} alt="" loading="lazy" decoding="async" />
        <div className="ad-banner-copy">
          <p className="ad-banner-kicker">{kicker}</p>
          <h2>{title}</h2>
          <p>{text}</p>
          <span className="btn btn-gold">{cta} →</span>
        </div>
      </Link>
    </section>
  )
}
