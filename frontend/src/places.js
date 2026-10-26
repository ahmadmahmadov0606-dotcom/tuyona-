// Ҷойҳо дар харита (OpenFreeMap). Ҳар ҷой ба эълони сайт (listingId → /listing/:id) пайваст аст.
// ⚠ ДИҚҚАТ: координатаҳо ва суроғаҳо тахминӣ (намунавӣ) мебошанд — пеш аз нашр онҳоро тафтиш кунед
//   ва бо координатаҳои воқеӣ иваз кунед ([дарозӣ (lng), паҳноӣ (lat)] — мисли Google Maps, вале баръакс!).
//   Телефонҳо аз эълонҳои намунавии база гирифта шудаанд (+992 900 000 001).
import { carSrc } from './cars'

export const PLACE_TYPES = [
  { id: 'venue', label: 'Тӯйхонаҳо', one: 'Тӯйхона' },
  { id: 'restaurant', label: 'Тарабхонаҳо', one: 'Тарабхона' },
  { id: 'photo', label: 'Аксбардорӣ', one: 'Аксбардорӣ' },
  { id: 'car', label: 'Мошинҳо', one: 'Мошин' },
]
export const typeOf = (id) => PLACE_TYPES.find((t) => t.id === id)

const venuePhoto = '/categories/optimized/venue-600.webp'
const mediaPhoto = '/categories/optimized/media-600.webp'

export const PLACES = [
  { id: 'oriyono', listingId: 1, type: 'venue', name: 'Тӯйхонаи «Ориёно»', coords: [68.7731, 38.5781], // TODO: тафтиш кунед
    address: 'Душанбе, хиёбони Рӯдакӣ', phone: '+992900000001', photo: venuePhoto },
  { id: 'navruz', listingId: 2, type: 'venue', name: 'Тӯйхонаи «Наврӯз»', coords: [68.7962, 38.5905], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Исмоили Сомонӣ', phone: '+992900000001', photo: venuePhoto },
  { id: 'somon-palace', listingId: 3, type: 'restaurant', name: 'Ресторани «Сомон Палас»', coords: [68.7598, 38.5603], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Айнӣ', phone: '+992900000001', photo: venuePhoto },
  { id: 'dastarkhon', listingId: 4, type: 'restaurant', name: 'Толори «Дастархон»', coords: [68.8104, 38.5552], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Борбад', phone: '+992900000001', photo: venuePhoto },
  { id: 'video-4k', listingId: 15, type: 'photo', name: 'Видео бо клипи тӯй, 4K', coords: [68.7854, 38.5688], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Шотемур', phone: '+992900000001', photo: mediaPhoto },
  { id: 'limo', listingId: 5, type: 'car', name: 'BMW 7 Series барои арӯс', coords: [68.7465, 38.5842], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Н. Қаробоев', phone: '+992900000001', photo: carSrc('01', 600) },
  { id: 'mercedes', listingId: 6, type: 'car', name: 'Mercedes S-Class бо ронанда', coords: [68.7709, 38.5497], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Саъдии Шерозӣ', phone: '+992900000001', photo: carSrc('08', 600) },
  { id: 'retro', listingId: 7, type: 'car', name: 'Rolls-Royce Phantom барои арӯс', coords: [68.8023, 38.5761], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Бохтар', phone: '+992900000001', photo: carSrc('05', 600) },
  { id: 'cortege', listingId: 8, type: 'car', name: 'Кортежи 4 мошини боҳашамат', coords: [68.7577, 38.5952], // TODO: тафтиш кунед
    address: 'Душанбе, кӯчаи Фирдавсӣ', phone: '+992900000001', photo: carSrc('11', 600) },
]

export const placeByListing = (listingId) => PLACES.find((p) => p.listingId === Number(listingId))
export const placeHref = (p) => `/listing/${p.listingId}`
export const routeLinks = ([lng, lat]) => ({
  google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  yandex: `https://yandex.ru/maps/?rtext=~${lat},${lng}&rtt=auto`,
})

/** GeoJSON барои манбаи харита */
export function placesGeoJSON(list = PLACES) {
  return {
    type: 'FeatureCollection',
    features: list.map((p, i) => ({
      type: 'Feature', id: i + 1, // id-и рақамӣ — барои feature-state
      geometry: { type: 'Point', coordinates: p.coords },
      properties: { pid: p.id, type: p.type, name: p.name },
    })),
  }
}
