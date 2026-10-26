import { useEffect, useState } from 'react'
import { placeByListing } from '../places'
import { fmtDate } from '../utils'

// Обу ҳаво аз Open-Meteo (open-meteo.com): ройгон, бе калид, маълумоти ECMWF, DWD ва дигар хадамоти миллии обу ҳаво.
// То 16 рӯз — пешгӯии дақиқ; дуртар — миёнаи воқеии ҳамон сана дар 10 соли охир (архиви ERA5).
const FORECAST = 'https://api.open-meteo.com/v1/forecast'
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive'
const TZ = 'Asia/Dushanbe'
const FORECAST_DAYS = 16
const YEARS = 10

// [паҳноӣ, дарозӣ] — маркази шаҳрҳо (агар ҷой дар харита набошад)
const CITY_COORDS = {
  dushanbe: [38.5598, 68.787], khujand: [40.2826, 69.6222], bokhtar: [37.8364, 68.7803], kulob: [37.9146, 69.7845],
  istaravshan: [39.9108, 69.0064], panjakent: [39.4952, 67.6093], hisor: [38.5263, 68.5513], vahdat: [38.5563, 69.0144],
  tursunzoda: [38.5108, 68.2303], isfara: [40.1264, 70.6252], khorugh: [37.4897, 71.5531], danghara: [38.0985, 69.3375],
}

// Кодҳои WMO → [аломат, тавсиф]
const WMO = [
  [[0], '☀️', 'Офтобӣ'], [[1], '🌤️', 'Асосан офтобӣ'], [[2], '⛅', 'Қисман абрнок'], [[3], '☁️', 'Абрнок'],
  [[45, 48], '🌫️', 'Туман'], [[51, 53, 55, 56, 57], '🌦️', 'Борони майда'], [[61, 63, 80, 81], '🌧️', 'Борон'],
  [[65, 82], '🌧️', 'Борони сахт'], [[66, 67], '🌧️', 'Борони яхбаста'], [[71, 73, 77, 85], '🌨️', 'Барф'],
  [[75, 86], '❄️', 'Барфи сахт'], [[95, 96, 99], '⛈️', 'Раъду барқ'],
]
const wmo = (code) => WMO.find(([codes]) => codes.includes(code)) || [[], '🌡️', 'Номаълум']

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (s, n) => { const d = new Date(`${s}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
const daysUntil = (s) => Math.round((new Date(`${s}T12:00:00Z`) - new Date(`${iso(new Date())}T12:00:00Z`)) / 864e5)
const round = (n) => Math.round(n)
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length

async function getJson(url, params) {
  const res = await fetch(`${url}?${new URLSearchParams({ timezone: TZ, ...params })}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function loadForecast([lat, lon], date) {
  const d = await getJson(FORECAST, {
    latitude: lat, longitude: lon, start_date: date, end_date: date,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,sunset',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
  })
  const day = Object.fromEntries(Object.entries(d.daily).map(([k, v]) => [k, v[0]]))
  // Соатҳои тӯй: 12:00 – 21:00, ҳар 3 соат
  const hours = [12, 15, 18, 21].map((h) => ({
    h, t: d.hourly.temperature_2m[h], code: d.hourly.weather_code[h], rain: d.hourly.precipitation_probability[h],
  }))
  return { kind: 'forecast', ...day, hours }
}

/** Миёнаи ҳамон сана (±3 рӯз) дар YEARS соли охир — аз архиви воқеии мушоҳидаҳо */
async function loadClimate([lat, lon], date) {
  const year = Number(date.slice(0, 4))
  const lastFull = new Date().getFullYear() - 1
  const years = Array.from({ length: YEARS }, (_, i) => Math.min(year - 1, lastFull) - i)
  const runs = await Promise.all(years.map((y) => {
    const center = `${y}${date.slice(4)}`.replace(/-02-29$/, '-02-28')
    return getJson(ARCHIVE, {
      latitude: lat, longitude: lon, start_date: addDays(center, -3), end_date: addDays(center, 3),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    }).then((d) => d.daily)
  }))
  const all = (k) => runs.flatMap((r) => r[k]).filter((x) => x != null)
  const rain = all('precipitation_sum')
  const codes = all('weather_code')
  const common = Object.entries(codes.reduce((m, c) => ({ ...m, [c]: (m[c] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]?.[0]
  return {
    kind: 'climate', years: YEARS,
    temperature_2m_max: avg(all('temperature_2m_max')), temperature_2m_min: avg(all('temperature_2m_min')),
    rainy: round((rain.filter((x) => x >= 1).length / rain.length) * 100),
    hottest: Math.max(...all('temperature_2m_max')), coldest: Math.min(...all('temperature_2m_min')),
    weather_code: Number(common),
  }
}

/** Обу ҳаво барои санаи тӯй — дар зери тақвими брон */
export default function WeatherForecast({ listing, date }) {
  const [state, setState] = useState({ loading: true })
  const place = placeByListing(listing.id)
  const coords = place ? [place.coords[1], place.coords[0]] : CITY_COORDS[listing.city?.slug]
  const until = daysUntil(date)

  useEffect(() => {
    if (!coords || until < 0) return
    let alive = true
    setState({ loading: true })
    const load = until < FORECAST_DAYS ? loadForecast : loadClimate
    load(coords, date)
      .then((data) => alive && setState({ data }))
      .catch(() => alive && setState({ error: true }))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, coords?.[0], coords?.[1]])

  if (!coords || until < 0) return null
  const { data, loading, error } = state
  const [, icon, label] = data ? wmo(data.weather_code) : []

  return (
    <section className="lp-wx" aria-live="polite" aria-label={`Обу ҳаво дар ${fmtDate(date)}`}>
      <header className="lp-wx-head">
        <span>Обу ҳаво дар рӯзи тӯй</span>
        {data && <em className={data.kind}>{data.kind === 'forecast' ? 'Пешгӯӣ' : `Миёнаи ${data.years} сол`}</em>}
      </header>

      {loading && <div className="lp-wx-skel" aria-label="Бор шуда истодааст"><i /><i /><i /></div>}
      {error && <p className="lp-wx-err">Обу ҳаворо гирифтан нашуд. Интернетро санҷед.</p>}

      {data && (
        <>
          <div className="lp-wx-main">
            <span className="lp-wx-icon" aria-hidden="true">{icon}</span>
            <div>
              <p className="lp-wx-temp"><b>{round(data.temperature_2m_max)}°</b> / {round(data.temperature_2m_min)}°</p>
              <p className="lp-wx-label">{data.kind === 'forecast' ? label : `Одатан: ${label.toLowerCase()}`}</p>
            </div>
          </div>

          {data.kind === 'forecast' ? (
            <>
              <ul className="lp-wx-stats">
                <li><span>Борон</span><b>{data.precipitation_probability_max ?? 0}%</b></li>
                <li><span>Шамол</span><b>{round(data.wind_speed_10m_max / 3.6)} м/с</b></li>
                <li><span>Ғуруб</span><b>{data.sunset?.slice(11, 16)}</b></li>
              </ul>
              <ol className="lp-wx-hours">
                {data.hours.map(({ h, t, code, rain }) => (
                  <li key={h}>
                    <small>{h}:00</small>
                    <span aria-hidden="true">{wmo(code)[1]}</span>
                    <b>{round(t)}°</b>
                    {rain > 0 && <em>{rain}%</em>}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <ul className="lp-wx-stats">
                <li><span>Рӯзҳои боронӣ</span><b>{data.rainy}%</b></li>
                <li><span>Гармтарин</span><b>{round(data.hottest)}°</b></li>
                <li><span>Хунуктарин</span><b>{round(data.coldest)}°</b></li>
              </ul>
              <p className="lp-wx-note">
                Пешгӯии дақиқ {FORECAST_DAYS} рӯз пеш аз тӯй пайдо мешавад ({fmtDate(addDays(date, -(FORECAST_DAYS - 1)))}). Ҳоло — обу ҳавои воқеии ҳамин рӯзҳо дар {data.years} соли охир.
              </p>
            </>
          )}
          <p className="lp-wx-src">
            {place ? place.name : listing.city?.name} · Манбаъ: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
          </p>
        </>
      )}
    </section>
  )
}
