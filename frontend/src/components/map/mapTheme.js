// Умумӣ барои ҳамаи харитаҳои сайт: бор кардан, услуби OpenFreeMap (рангҳои аслӣ) ва нишонаҳои «қатраи тиллоӣ».

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
export const DUSHANBE = [68.787, 38.5598]

export const MAP_LOCALE = {
  'NavigationControl.ZoomIn': 'Калон кардан',
  'NavigationControl.ZoomOut': 'Хурд кардан',
  'NavigationControl.ResetBearing': 'Ба шимол',
  'GeolocateControl.FindMyLocation': 'Ман дар куҷо?',
  'GeolocateControl.LocationNotAvailable': 'Ҷойгиршавӣ дастрас нест',
  'FullscreenControl.Enter': 'Тамоми экран',
  'FullscreenControl.Exit': 'Баромадан аз тамоми экран',
  'AttributionControl.ToggleAttribution': 'Манбаъҳои харита',
  'CooperativeGesturesHandler.WindowsHelpText': 'Барои калон кардан Ctrl + чархакро истифода баред',
  'CooperativeGesturesHandler.MacHelpText': 'Барои калон кардан ⌘ + чархакро истифода баред',
  'CooperativeGesturesHandler.MobileHelpText': 'Харитаро бо ду ангушт ҳаракат диҳед',
}

/** maplibre-gl танҳо ҳангоми зарурат (dynamic import) */
let mlPromise = null
export function loadMaplibre() {
  if (!mlPromise) mlPromise = import('./maplibre').then((m) => m.default).catch((e) => { mlPromise = null; throw e })
  return mlPromise
}

export function createMap(ml, container, options = {}) {
  return new ml.Map({
    container,
    style: STYLE_URL,
    center: DUSHANBE,
    zoom: 12,
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    locale: MAP_LOCALE,
    ...options,
  })
}

const NAME = ['coalesce', ['get', 'name:tg'], ['get', 'name:ru'], ['get', 'name']]

/**
 * Услуби «liberty» бе тағйири рангҳо. Танҳо: биноҳои 3D аз zoom 15 (бо рангҳои аслӣ)
 * ва номҳо бо тоҷикӣ/русӣ (агар бошанд), то бо забони сайт мувофиқ бошад.
 */
export function prepareStyle(map) {
  for (const { id, type, layout = {} } of map.getStyle().layers) {
    if (type === 'fill-extrusion') { try { map.setLayerZoomRange(id, 15, 24) } catch { /* ҳеҷ */ } }
    else if (type === 'symbol' && layout['text-field'] != null) { try { map.setLayoutProperty(id, 'text-field', NAME) } catch { /* ҳеҷ */ } }
  }
}

// ----- Нишонаҳо: қатраи тиллоӣ бо ҳалқаҳо (мисли логотип) ва аломати навъ -----
const GLYPHS = {
  // ду ҳалқа — тӯйхона
  venue: '<g fill="none" stroke="url(#g)" stroke-width="4"><circle cx="33" cy="42" r="10"/><circle cx="47" cy="42" r="10"/></g><path d="M33 27l4-5h6l4 5-7 5z" fill="url(#g)"/>',
  // чангол ва корд — тарабхона
  restaurant: '<g fill="none" stroke="url(#g)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 26v8a4 4 0 0 0 8 0v-8M34 26v28"/><path d="M49 26c-4 3-5 11-1 15h1v13"/></g>',
  // камера — аксбардорӣ
  photo: '<g fill="none" stroke="url(#g)" stroke-width="3.4" stroke-linejoin="round"><rect x="24" y="31" width="32" height="22" rx="5"/><path d="M33 31l3-5h8l3 5"/><circle cx="40" cy="42" r="6"/></g>',
  // мошин
  car: '<path d="M21 45v-4.5c0-1.4 1-2.6 2.4-2.9l5.6-1.2 5-5.4a5 5 0 0 1 3.7-1.6h7.6a5 5 0 0 1 3.9 1.9l4.3 5.1 4.6 1.2c1.3.4 2.3 1.6 2.3 3V45z" fill="url(#g)"/><g fill="#5a1430" stroke="url(#g)" stroke-width="2.6"><circle cx="30" cy="46" r="4.6"/><circle cx="50" cy="46" r="4.6"/></g><path d="M35.5 36.5l3-3.3h4v3.3zM45 36.5v-3.3h2.6l2.8 3.3z" fill="#5a1430"/>',
}

function pinSvg(type) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="104" viewBox="0 0 80 104">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e3ad"/><stop offset=".5" stop-color="#d4a24c"/><stop offset="1" stop-color="#f3d48f"/></linearGradient>
<linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc9c"/><stop offset=".55" stop-color="#c6913d"/><stop offset="1" stop-color="#8f6420"/></linearGradient>
</defs>
<ellipse cx="40" cy="100" rx="11" ry="3" fill="#000" opacity=".45"/>
<path d="M40 2C61 2 77 18 77 39c0 21-20 36-37 59C23 75 3 60 3 39 3 18 19 2 40 2z" fill="url(#d)" stroke="#5a1430" stroke-width="2"/>
<circle cx="40" cy="39" r="27" fill="#5a1430"/>
<circle cx="40" cy="39" r="24" fill="none" stroke="#f8e3ad" stroke-width="1" opacity=".5"/>
${GLYPHS[type] || GLYPHS.venue}
</svg>`
}

function svgImage(svg) {
  const img = new Image(80, 104)
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return img.decode().then(() => img)
}

/** Нишонаҳоро ба харита илова мекунад: pin-<type> */
export async function addPinImages(map, types) {
  const imgs = await Promise.all(types.map((t) => svgImage(pinSvg(t)).then((img) => [t, img])))
  for (const [t, img] of imgs) if (!map.hasImage(`pin-${t}`)) map.addImage(`pin-${t}`, img, { pixelRatio: 2 })
}
