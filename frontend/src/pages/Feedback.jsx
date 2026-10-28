import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import { ErrorBox, StarInput } from '../components/ui'

export const FEEDBACK_TOPICS = [
  ['idea', 'Пешниҳод'],
  ['bug', 'Хато дар сайт'],
  ['praise', 'Ташаккур'],
  ['other', 'Дигар'],
]

/** /fikr — фикру пешниҳод дар бораи сайт. Маъмур дар панели админ мехонад. */
export default function Feedback() {
  const { user } = useAuth()
  const loc = useLocation()
  const [f, setF] = useState({ topic: 'idea', rating: 0, message: '', name: '', contact: '' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      await api.sendFeedback({ ...f, rating: f.rating || null, page: loc.state?.from || '' })
      setSent(true)
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  if (sent) {
    return (
      <div className="container page narrow">
        <div className="box fb-done">
          <span className="fb-done-ico" aria-hidden="true"><Icon name="check" /></span>
          <h1>Ташаккур!</h1>
          <p className="muted">Фикри шумо ба мо расид. Мо ҳар паёмро мехонем ва сайтро беҳтар мекунем.</p>
          <div className="fb-actions">
            <Link to="/" className="btn btn-primary">Ба саҳифаи асосӣ</Link>
            <button type="button" className="btn btn-ghost" onClick={() => { setSent(false); setF({ ...f, message: '', rating: 0 }) }}>Боз нависед</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container page narrow">
      <div className="page-head">
        <h1>Фикру пешниҳод</h1>
        <p className="muted">Хато ёфтед, пешниҳод доред ё мехоҳед ташаккур гӯед? Нависед — ҳар паёмро мехонем.</p>
      </div>
      <form className="box fb-form" onSubmit={submit}>
        <div className="fb-topics" role="radiogroup" aria-label="Мавзӯъ">
          {FEEDBACK_TOPICS.map(([value, label]) => (
            <button key={value} type="button" role="radio" aria-checked={f.topic === value}
              className={`fb-topic ${f.topic === value ? 'on' : ''}`} onClick={() => setF({ ...f, topic: value })}>{label}</button>
          ))}
        </div>
        <div className="field">
          <span>Баҳои сайт (ихтиёрӣ)</span>
          <StarInput value={f.rating} onChange={(rating) => setF({ ...f, rating })} />
        </div>
        <label className="field">
          <span>Паёми шумо</span>
          <textarea required minLength={5} maxLength={2000} rows={6} value={f.message} onChange={set('message')}
            placeholder={f.topic === 'bug' ? 'Дар кадом саҳифа ва чӣ хато шуд?' : 'Фикри худро нависед…'} />
        </label>
        {!user && (
          <div className="row2">
            <label className="field">
              <span>Ном (ихтиёрӣ)</span>
              <input maxLength={120} value={f.name} onChange={set('name')} autoComplete="name" />
            </label>
            <label className="field">
              <span>Телефон ё email (ихтиёрӣ)</span>
              <input maxLength={120} value={f.contact} onChange={set('contact')} placeholder="барои ҷавоб" />
            </label>
          </div>
        )}
        <ErrorBox error={err} />
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? '…' : 'Фиристодан'}</button>
        {user && <p className="small muted fb-who">Аз номи <b>{user.full_name}</b> ({user.email}) фиристода мешавад.</p>}
      </form>
    </div>
  )
}
