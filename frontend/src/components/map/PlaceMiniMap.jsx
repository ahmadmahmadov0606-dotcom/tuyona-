import { useEffect, useRef, useState } from 'react'
import { routeLinks } from '../../places'
import { useInView } from '../categoryMedia'
import { addPinImages, createMap, loadMaplibre, prepareStyle } from './mapTheme'
import './PlacesMap.css'

/** Харитаи хурд дар саҳифаи ҷой: як нишона, zoom 15 (биноҳои 3D), тугмаҳои «Роҳ» */
export default function PlaceMiniMap({ place }) {
  const rootRef = useRef(null)
  const mapEl = useRef(null)
  const near = useInView(rootRef, { margin: '200px 0px' })
  const [status, setStatus] = useState('idle')

  useEffect(() => {
    if (!near) return undefined
    let cancelled = false
    let map = null
    setStatus('loading')
    loadMaplibre().then((ml) => {
      if (cancelled || !mapEl.current) return
      map = createMap(ml, mapEl.current, { center: place.coords, zoom: 15.5, pitch: 40, cooperativeGestures: true })
      map.touchZoomRotate.disableRotation()
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      map.on('style.load', async () => {
        prepareStyle(map)
        try { await addPinImages(map, [place.type]) } catch { /* бе икона */ }
        if (cancelled) return
        map.addSource('place', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: place.coords }, properties: {} } })
        map.addLayer({ id: 'place-glow', type: 'circle', source: 'place',
          paint: { 'circle-color': '#f8e3ad', 'circle-opacity': 0.25, 'circle-radius': 26, 'circle-blur': 0.6 } })
        map.addLayer({ id: 'place-pin', type: 'symbol', source: 'place',
          layout: { 'icon-image': `pin-${place.type}`, 'icon-anchor': 'bottom', 'icon-allow-overlap': true } })
        setStatus('ready')
      })
    }).catch(() => !cancelled && setStatus('error'))
    return () => { cancelled = true; map?.remove() }
  }, [near, place])

  const routes = routeLinks(place.coords)
  return (
    <div ref={rootRef} className="pm pm-mini">
      <div className="pm-stage pm-mini-stage">
        <div ref={mapEl} className="pm-map" role="region" aria-label={`Харита: ${place.name}`} />
        {status !== 'ready' && (
          <div className="pm-overlay">
            {status === 'error' ? <p>Харита бор нашуд.</p> : <span className="pm-loader" aria-label="Харита бор шуда истодааст" />}
          </div>
        )}
      </div>
      <div className="pm-mini-foot">
        <span>{place.address}</span>
        <div className="pm-mini-actions">
          <a href={routes.google} target="_blank" rel="noopener noreferrer" className="pm-pop-go">Роҳ (Google)</a>
          <a href={routes.yandex} target="_blank" rel="noopener noreferrer" className="pm-pop-route">Яндекс</a>
        </div>
      </div>
    </div>
  )
}
