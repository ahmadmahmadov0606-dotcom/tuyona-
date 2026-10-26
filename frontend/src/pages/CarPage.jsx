import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CARS, carById, carSrc as src, MAX_CARS } from '../cars'
import { OPEN_KEY, OrderForm, Plate, store, useCarSelection } from '../components/CarsGallery'
import Icon from '../components/Icon'
import NightPage from '../components/NightPage'
import { Empty } from '../components/ui'
import '../components/CarsGallery.css'
import './CarPage.css'

const BACK = '/search?group=transport'

/** /moshin/:id — саҳифаи як мошини шоурум: акси калон ва формаи фармоиш. Мошинҳои дигарро ҳам илова кардан мумкин (то MAX_CARS). */
export default function CarPage() {
  const { id } = useParams()
  const car = carById(id)
  const sel = useCarSelection()

  // Мошини ҳамин саҳифа ҳамеша дар фармоиш аст
  useEffect(() => {
    store.set(OPEN_KEY, null)
    if (car && !sel.has(car.id)) sel.toggle(car.id)
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (!car) {
    return (
      <div className="container page">
        <Empty icon={<Icon name="car" />} title="Мошин ёфт нашуд" action={<Link to={BACK} className="btn btn-primary">Ҳамаи мошинҳо</Link>} />
      </div>
    )
  }

  const others = CARS.filter((c) => c.id !== car.id)
  const full = sel.ids.length >= MAX_CARS

  return (
    <NightPage className="car">
      <div className="container car-wrap">
        <nav className="car-crumbs" aria-label="Пайраҳа">
          <Link to="/">Асосӣ</Link><span aria-hidden="true">›</span>
          <Link to={BACK}>Мошинҳо</Link><span aria-hidden="true">›</span>
          <span>{car.name}</span>
        </nav>

        <div className="car-grid">
          <section className="car-media">
            <figure className="car-photo">
              <img key={car.id} src={src(car.id, 1200)} srcSet={`${src(car.id, 600)} 600w, ${src(car.id, 1200)} 1200w`}
                sizes="(max-width: 960px) 100vw, 640px" alt={car.name} style={{ objectPosition: car.focus || car.pos }} />
              <span className="car-photo-shade" aria-hidden="true" />
              <figcaption>
                <p className="cg-kicker">Tuyona · Showroom</p>
                <h1>{car.name}</h1>
                {car.note && <p className="car-note">{car.note}</p>}
                {car.plates.length > 0 && <span className="cg-plates">{car.plates.map((p) => <Plate key={p} value={p} />)}</span>}
              </figcaption>
            </figure>

            <div className="car-more">
              <div className="car-more-head">
                <h2>Боз мошин илова кунед</h2>
                <span>{sel.ids.length} / {MAX_CARS} · корвон тибқи қонун</span>
              </div>
              <div className="car-thumbs">
                {others.map((c) => {
                  const on = sel.has(c.id)
                  return (
                    <button key={c.id} type="button" className={`car-thumb ${on ? 'on' : ''}`} disabled={!on && full} onClick={() => sel.toggle(c.id)}
                      aria-pressed={on} aria-label={on ? `${c.name} — аз фармоиш хориҷ кардан` : `${c.name} — ба фармоиш илова кардан`}>
                      <img src={src(c.id, 600)} alt="" loading="lazy" style={{ objectPosition: c.pos }} />
                      <i aria-hidden="true">{on ? '✓' : '+'}</i>
                      <span>{c.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <aside className="car-order cg-modal-card">
            <OrderForm sel={sel} next={`/moshin/${car.id}`} />
          </aside>
        </div>
      </div>
    </NightPage>
  )
}
