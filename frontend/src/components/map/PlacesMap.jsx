import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { PLACE_TYPES, PLACES, placeHref, placesGeoJSON, routeLinks, typeOf } from '../../places'
import { useInView } from '../categoryMedia'
import { addPinImages, createMap, loadMaplibre, prepareStyle } from './mapTheme'
import './PlacesMap.css'

const SRC = 'places'
const TYPES = PLACE_TYPES.map((t) => t.id)
const FEATURES = placesGeoJSON()
const idxOf = (pid) => PLACES.findIndex((p) => p.id === pid)
const isMobile = () => window.matchMedia('(max-width: 767px)').matches
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Шумораи нуқтаҳои кластер барои филтри ҷорӣ (clusterProperties — шумора аз рӯи навъ)
const countExpr = (type) => (type === 'all' ? ['get', 'point_count'] : ['get', type])
const pinFilter = (type) => ['all', ['!', ['has', 'point_count']], type === 'all' ? true : ['==', ['get', 'type'], type]]
const clusterFilter = (type) => ['all', ['has', 'point_count'], ['>', countExpr(type), 0]]

function addPlaceLayers(map) {
  map.addSource(SRC, {
    type: 'geojson', data: FEATURES, cluster: true, clusterRadius: 52, clusterMaxZoom: 14,
    clusterProperties: Object.fromEntries(TYPES.map((t) => [t, ['+', ['case', ['==', ['get', 'type'], t], 1, 0]]])),
  })
  map.addLayer({ id: 'pm-cluster-glow', type: 'circle', source: SRC, filter: clusterFilter('all'),
    paint: { 'circle-color': '#e9c784', 'circle-opacity': 0.18, 'circle-blur': 0.6,
      'circle-radius': ['step', countExpr('all'), 30, 5, 36, 10, 44] } })
  map.addLayer({ id: 'pm-cluster', type: 'circle', source: SRC, filter: clusterFilter('all'),
    paint: { 'circle-color': '#d4a24c', 'circle-stroke-color': '#5a1430', 'circle-stroke-width': 3,
      'circle-radius': ['step', countExpr('all'), 19, 5, 23, 10, 28] } })
  map.addLayer({ id: 'pm-cluster-count', type: 'symbol', source: SRC, filter: clusterFilter('all'),
    layout: { 'text-field': ['to-string', countExpr('all')], 'text-font': ['Noto Sans Bold'], 'text-size': 14, 'text-allow-overlap': true },
    paint: { 'text-color': '#2a1406' } })
  // Ҳолаи нишонаи интихобшуда/зери курсор (филтр бо pid)
  map.addLayer({ id: 'pm-halo', type: 'circle', source: SRC, filter: ['==', ['get', 'pid'], ''],
    paint: { 'circle-color': '#f8e3ad', 'circle-opacity': 0.28, 'circle-radius': 24, 'circle-blur': 0.5, 'circle-translate': [0, -2] } })
  map.addLayer({ id: 'pm-pin', type: 'symbol', source: SRC, filter: pinFilter('all'),
    layout: { 'icon-image': ['concat', 'pin-', ['get', 'type']], 'icon-anchor': 'bottom', 'icon-allow-overlap': true,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 1] } })
}

/** Корти popup дар услуби сайт (бо portal ба DOM-и popup-и MapLibre) */
function PlacePopup({ place, onClose }) {
  const routes = routeLinks(place.coords)
  return (
    <div className="pm-pop">
      <div className="pm-pop-img"><img src={place.photo} alt="" loading="lazy" decoding="async" /></div>
      <button type="button" className="pm-pop-x" onClick={onClose} aria-label="Пӯшидан">✕</button>
      <div className="pm-pop-body">
        <span className="pm-pop-type">{typeOf(place.type)?.one}</span>
        <h3>{place.name}</h3>
        <p className="pm-pop-addr">{place.address}</p>
        {place.phone && <a className="pm-pop-tel" href={`tel:${place.phone}`}>{place.phone}</a>}
        <div className="pm-pop-actions">
          <Link to={placeHref(place)} className="pm-pop-go">Батафсил</Link>
          <a className="pm-pop-route" href={routes.google} target="_blank" rel="noopener noreferrer">Роҳ</a>
        </div>
        <a className="pm-pop-yandex" href={routes.yandex} target="_blank" rel="noopener noreferrer">Роҳ дар Яндекс Харита →</a>
      </div>
    </div>
  )
}

/**
 * Харитаи ҷойҳо (тӯйхонаҳо, тарабхонаҳо, аксбардорӣ, мошинҳо).
 * variant: 'section' (саҳифаи асосӣ, ~70vh) | 'page' (/harita, тамоми экран).
 */
export default function PlacesMap({ variant = 'section' }) {
  const rootRef = useRef(null)
  const stageRef = useRef(null)
  const mapEl = useRef(null)
  const listRef = useRef(null)
  const mapRef = useRef(null)
  const popupRef = useRef(null)
  const geoRef = useRef(null)
  const [popupEl] = useState(() => document.createElement('div'))
  const near = useInView(rootRef, { margin: '250px 0px' })
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const [type, setType] = useState('all')
  const [selected, setSelected] = useState(null) // pid
  const [hover, setHover] = useState(null) // { pid, from: 'map' | 'list' }
  const [sheet, setSheet] = useState(false)
  const [q, setQ] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState('')

  const list = useMemo(() => (type === 'all' ? PLACES : PLACES.filter((p) => p.type === type)), [type])
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase()
    return s ? PLACES.filter((p) => p.name.toLowerCase().includes(s) || p.address.toLowerCase().includes(s)).slice(0, 6) : []
  }, [q])
  const place = selected ? PLACES[idxOf(selected)] : null

  // ----- Харита: як нусха, танҳо вақте ки бахш ба экран наздик шуд -----
  useEffect(() => {
    if (!near || mapRef.current) return undefined
    let cancelled = false
    setStatus('loading')
    loadMaplibre().then((ml) => {
      if (cancelled || !mapEl.current) return
      const map = createMap(ml, mapEl.current, { cooperativeGestures: variant === 'section' })
      mapRef.current = map
      map.touchZoomRotate.disableRotation()
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right')
      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right')
      const geo = new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, fitBoundsOptions: { maxZoom: 14 }, showAccuracyCircle: false })
      geoRef.current = geo
      map.addControl(geo, 'top-right')
      map.addControl(new ml.FullscreenControl({ container: stageRef.current }), 'top-right')
      geo.on('error', () => setNotice('Ҷойгиршавии шумо дастрас нест. Иҷозати геолокатсияро санҷед.'))

      map.on('style.load', async () => {
        prepareStyle(map)
        try { await addPinImages(map, TYPES) } catch { /* иконаҳо бор нашуданд — қабатҳо бе икона */ }
        if (cancelled) return
        addPlaceLayers(map)
        setStatus('ready')
      })
      map.on('error', (e) => { if (!map.isStyleLoaded() && e?.error?.status !== 404) setStatus((s) => (s === 'ready' ? s : 'error')) })

      map.on('click', 'pm-cluster', async (e) => {
        const f = e.features[0]
        try {
          const zoom = await map.getSource(SRC).getClusterExpansionZoom(f.properties.cluster_id)
          map.easeTo({ center: f.geometry.coordinates, zoom: zoom + 0.3, duration: reducedMotion() ? 0 : 600 })
        } catch { /* кластер нест шуд */ }
      })
      map.on('click', 'pm-pin', (e) => { setSelected(e.features[0].properties.pid) })
      // Клик ба ҷои холӣ — popup пӯшида мешавад
      map.on('click', (e) => {
        const layers = ['pm-pin', 'pm-cluster'].filter((id) => map.getLayer(id))
        if (!map.queryRenderedFeatures(e.point, { layers }).length) setSelected(null)
      })
      map.on('mousemove', 'pm-pin', (e) => { map.getCanvas().style.cursor = 'pointer'; setHover({ pid: e.features[0].properties.pid, from: 'map' }) })
      map.on('mouseleave', 'pm-pin', () => { map.getCanvas().style.cursor = ''; setHover(null) })
      map.on('mouseenter', 'pm-cluster', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'pm-cluster', () => { map.getCanvas().style.cursor = '' })
    }).catch(() => !cancelled && setStatus('error'))
    return () => { cancelled = true }
  }, [near, variant])

  useEffect(() => () => { popupRef.current?.remove(); mapRef.current?.remove(); mapRef.current = null }, [])

  // ----- Филтр бо setFilter (бе аз нав бор кардани маълумот) -----
  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map) return
    map.setFilter('pm-pin', pinFilter(type))
    for (const id of ['pm-cluster', 'pm-cluster-glow', 'pm-cluster-count']) map.setFilter(id, clusterFilter(type))
    map.setLayoutProperty('pm-cluster-count', 'text-field', ['to-string', countExpr(type)])
    map.setPaintProperty('pm-cluster', 'circle-radius', ['step', countExpr(type), 19, 5, 23, 10, 28])
  }, [type, status])

  // ----- Ҳола: интихобшуда ё зери курсор -----
  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map) return
    map.setFilter('pm-halo', ['==', ['get', 'pid'], hover?.pid || selected || ''])
    if (hover?.from === 'map') listRef.current?.querySelector(`[data-pid="${hover.pid}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [hover, selected, status])

  // ----- Popup -----
  useEffect(() => {
    const map = mapRef.current
    if (status !== 'ready' || !map) return undefined
    if (!place) { popupRef.current?.remove(); return undefined }
    import('./maplibre').then(({ default: ml }) => {
      if (!popupRef.current) {
        popupRef.current = new ml.Popup({ offset: [0, -48], closeButton: false, closeOnClick: false, maxWidth: '300px', className: 'pm-popup', focusAfterOpen: false })
          .setDOMContent(popupEl)
      }
      popupRef.current.setLngLat(place.coords)
      if (!popupRef.current.isOpen()) popupRef.current.addTo(map)
    })
    return undefined
  }, [place, status, popupEl])

  const flyToPlace = useCallback((p) => {
    const map = mapRef.current
    if (!map) return
    // Popup болои нишона аст — марказро каме поён мегузаронем, то корт пурра намоён бошад
    map.flyTo({ center: p.coords, zoom: Math.max(map.getZoom(), 15), offset: [0, isMobile() ? 120 : 140], essential: true,
      ...(reducedMotion() ? { duration: 0 } : { speed: 1.3 }) })
  }, [])

  const choose = useCallback((p) => {
    if (type !== 'all' && p.type !== type) setType('all')
    setSelected(p.id)
    setSheet(false)
    flyToPlace(p)
  }, [type, flyToPlace])

  const pickSuggestion = (p) => { setQ(p.name); setSuggestOpen(false); choose(p) }
  const onSearchKey = (e) => {
    if (!matches.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSuggestOpen(true); setCursor((c) => (c + 1) % matches.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => (c - 1 + matches.length) % matches.length) }
    else if (e.key === 'Enter') { e.preventDefault(); pickSuggestion(matches[Math.min(cursor, matches.length - 1)]) }
    else if (e.key === 'Escape') setSuggestOpen(false)
  }

  useEffect(() => { if (!notice) return undefined; const t = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(t) }, [notice])

  return (
    <div ref={rootRef} className={`pm pm-${variant}`}>
      <div className="pm-toolbar">
        <div className="pm-search" role="combobox" aria-expanded={suggestOpen && matches.length > 0} aria-haspopup="listbox" aria-owns="pm-suggest">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
          <input type="search" value={q} placeholder="Ҷустуҷӯи ҷой бо ном…" aria-label="Ҷустуҷӯи ҷой" aria-autocomplete="list" aria-controls="pm-suggest"
            onChange={(e) => { setQ(e.target.value); setSuggestOpen(true); setCursor(0) }} onKeyDown={onSearchKey}
            onFocus={() => setSuggestOpen(true)} onBlur={() => setTimeout(() => setSuggestOpen(false), 120)} />
          {suggestOpen && matches.length > 0 && (
            <ul id="pm-suggest" className="pm-suggest" role="listbox">
              {matches.map((p, i) => (
                <li key={p.id} role="option" aria-selected={i === cursor} className={i === cursor ? 'on' : ''}
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(p) }} onMouseEnter={() => setCursor(i)}>
                  <b>{p.name}</b><span>{typeOf(p.type)?.one} · {p.address}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="pm-chips" role="tablist" aria-label="Навъи ҷой">
          {[{ id: 'all', label: 'Ҳама' }, ...PLACE_TYPES].map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={type === t.id} className={`pm-chip ${type === t.id ? 'on' : ''}`}
              onClick={() => setType(t.id)}>
              {t.label}<em>{t.id === 'all' ? PLACES.length : PLACES.filter((p) => p.type === t.id).length}</em>
            </button>
          ))}
        </div>
        <button type="button" className="pm-geo" onClick={() => geoRef.current?.trigger()} disabled={status !== 'ready'}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="7" /></svg>
          Ман дар куҷо?
        </button>
      </div>

      <div ref={stageRef} className="pm-stage">
        <div ref={mapEl} className="pm-map" role="region" aria-label="Харитаи ҷойҳои тӯй дар Душанбе" />
        {status !== 'ready' && (
          <div className="pm-overlay">
            {status === 'error' ? <p>Харита бор нашуд. Пайвасти интернетро санҷед.</p> : <span className="pm-loader" aria-label="Харита бор шуда истодааст" />}
          </div>
        )}
        {notice && <div className="pm-notice" role="status">{notice}</div>}

        <aside className={`pm-list ${sheet ? 'open' : ''}`} aria-label="Рӯйхати ҷойҳо">
          <button type="button" className="pm-sheet-handle" onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>
            <i aria-hidden="true" /><span><b>{list.length}</b> ҷой дар харита</span>
            <em>{sheet ? 'Пинҳон' : 'Рӯйхат'}</em>
          </button>
          <ul ref={listRef}>
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" data-pid={p.id}
                  className={`pm-item ${selected === p.id ? 'on' : ''} ${hover?.pid === p.id ? 'hl' : ''}`}
                  onClick={() => choose(p)} onMouseEnter={() => setHover({ pid: p.id, from: 'list' })} onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover({ pid: p.id, from: 'list' })} onBlur={() => setHover(null)}>
                  <img src={p.photo} alt="" loading="lazy" decoding="async" />
                  <span><b>{p.name}</b><small>{typeOf(p.type)?.one} · {p.address}</small></span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      {place && createPortal(<PlacePopup place={place} onClose={() => setSelected(null)} />, popupEl)}
    </div>
  )
}
