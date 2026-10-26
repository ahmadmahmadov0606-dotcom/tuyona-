import { useEffect, useState } from 'react'
import { api } from './api'

export const PRICE_UNITS = {
  event: 'барои тӯй',
  hour: 'дар як соат',
  day: 'дар як рӯз',
  person: 'барои 1 нафар',
  item: 'барои 1 дона',
}

export const BOOKING_STATUS = {
  pending: { label: 'Интизор', cls: 'badge-wait' },
  confirmed: { label: 'Тасдиқ шуд', cls: 'badge-ok' },
  rejected: { label: 'Рад шуд', cls: 'badge-no' },
  cancelled: { label: 'Бекор шуд', cls: 'badge-muted' },
}

// Ҳадҳои тӯй тибқи Қонуни ҶТ «Дар бораи танзими ҷашну маросим» аз 20.06.2024, №2048 (моддаҳои 12 ва 16)
export const WEDDING_LIMITS = { feast: 150, osh: 200, cars: 4, hours: 3, days: 2, events: 2, family: 15 }

export const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр']
export const MONTHS_CAP = MONTHS.map((m) => m[0].toUpperCase() + m.slice(1))
export const WEEKDAYS = ['Дш', 'Сш', 'Чш', 'Пш', 'Ҷм', 'Шб', 'Як']

export const money = (n) => `${Number(n).toLocaleString('ru-RU').replace(/,/g, ' ')} сомонӣ`

export const fmtDate = (iso) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export const toISO = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export const todayISO = () => toISO(new Date())

export const imgUrl = (u) => u ? ((import.meta.env.VITE_API_URL || '') + u) : null

// Каталог (категорияҳо ва шаҳрҳо) як бор бор карда мешавад ва дар хотира мемонад.
let catalogPromise = null
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = Promise.all([api.categories(), api.cities()])
      .then(([groups, cities]) => ({
        groups,
        cities,
        categories: groups.flatMap((g) => g.categories.map((c) => ({ ...c, group: g }))),
      }))
      .catch((e) => { catalogPromise = null; throw e })
  }
  return catalogPromise
}

export function useCatalog() {
  const [cat, setCat] = useState(null)
  useEffect(() => { loadCatalog().then(setCat).catch(() => {}) }, [])
  return cat
}

export function useAsync(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error) => alive && setState({ data: null, error, loading: false }),
    )
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { ...state, reload: () => setTick((t) => t + 1), setData: (data) => setState((s) => ({ ...s, data })) }
}
