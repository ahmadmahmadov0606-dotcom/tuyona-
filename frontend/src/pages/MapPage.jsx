import NightPage from '../components/NightPage'
import PlacesMap from '../components/map/PlacesMap'
import './MapPage.css'

/** /harita — харитаи пурраи ҷойҳои тӯй */
export default function MapPage() {
  return (
    <NightPage className="hp">
      <div className="container hp-wrap">
        <header className="hp-head">
          <p className="hp-kicker"><span aria-hidden="true" />Душанбе<span aria-hidden="true" /></p>
          <h1>Харитаи хизматҳо</h1>
          <p className="hp-sub">Тӯйхонаҳо, тарабхонаҳо, аксбардорон ва мошинҳои тӯй — дар як харита.</p>
        </header>
        <PlacesMap variant="page" />
      </div>
    </NightPage>
  )
}
