import { useEffect, useState } from 'react'
import { api } from '../api'
import { MONTHS_CAP, todayISO, toISO, WEEKDAYS } from '../utils'

/**
 * Тақвими санаҳои холӣ/банд.
 * mode="pick"  — мизоҷ санаро интихоб мекунад (санаҳои банд ғайрифаъол).
 * mode="manage" — хизматрасон санаҳоро банд/озод мекунад (onToggle).
 */
export default function Calendar({ listingId, value, onChange, mode = 'pick', onToggle, refreshKey = 0 }) {
  const now = new Date()
  const [cursor, setCursor] = useState(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number)
      return new Date(y, m - 1, 1)
    }
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [busy, setBusy] = useState(new Set())
  const [loading, setLoading] = useState(false)

  const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    if (!listingId) return
    let alive = true
    setLoading(true)
    api.availability(listingId, monthKey)
      .then((r) => alive && setBusy(new Set(r.busy)))
      .catch(() => alive && setBusy(new Set()))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [listingId, monthKey, refreshKey])

  const today = todayISO()
  const first = new Date(cursor)
  const offset = (first.getDay() + 6) % 7 // душанбе аввал
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(cursor.getFullYear(), cursor.getMonth(), d)))

  const canPrev = cursor > new Date(now.getFullYear(), now.getMonth(), 1)
  const shift = (n) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1))

  return (
    <div className={`calendar ${loading ? 'is-loading' : ''}`}>
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Моҳи пеш">‹</button>
        <strong>{MONTHS_CAP[cursor.getMonth()]} {cursor.getFullYear()}</strong>
        <button type="button" className="cal-nav" onClick={() => shift(1)} aria-label="Моҳи баъд">›</button>
      </div>
      <div className="cal-grid" key={monthKey}>
        {WEEKDAYS.map((w) => <div key={w} className="cal-wd">{w}</div>)}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />
          const past = iso < today
          const isBusy = busy.has(iso)
          const selected = value === iso
          const disabled = past || (mode === 'pick' && isBusy)
          const cls = ['cal-day', isBusy && 'busy', selected && 'selected', past && 'past', iso === today && 'today']
            .filter(Boolean).join(' ')
          return (
            <button type="button" key={iso} className={cls} disabled={disabled}
              title={isBusy ? 'Банд' : 'Холӣ'}
              onClick={() => (mode === 'pick' ? onChange?.(iso) : onToggle?.(iso, isBusy))}>
              {Number(iso.slice(8))}
            </button>
          )
        })}
      </div>
      <div className="cal-legend">
        <span><i className="dot dot-free" /> Холӣ</span>
        <span><i className="dot dot-busy" /> Банд</span>
        {mode === 'pick' && <span><i className="dot dot-sel" /> Интихоб</span>}
      </div>
    </div>
  )
}
