import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { Ornament, Rings3D } from '../components/fx'
import { ErrorBox, useToast } from '../components/ui'
import Icon from '../components/Icon'
import GoogleButton from '../components/GoogleButton'

function AuthScene({ children }) {
  return (
    <div className="auth-wrap">
      <div className="auth-sky" aria-hidden="true">
        <span className="auth-arch" />
        <span className="auth-rings"><Rings3D size="xl" /></span>
      </div>
      <div className="invite">{children}</div>
    </div>
  )
}

function InviteHead({ title, sub }) {
  return (
    <div className="invite-head">
      <span className="seal" aria-hidden="true">Т</span>
      <h1>{title}</h1>
      <Ornament />
      {sub && <p className="muted">{sub}</p>}
    </div>
  )
}

/** Майдони парол бо тугмаи 👁 — корбар хатои навиштанро мебинад */
function PasswordInput(props) {
  const [show, setShow] = useState(false)
  return (
    <span className="pw-wrap">
      <input {...props} type={show ? 'text' : 'password'} />
      <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? 'Пинҳон кардани парол' : 'Нишон додани парол'}
        aria-pressed={show} tabIndex={-1}>{show ? '🙈' : '👁'}</button>
    </span>
  )
}

function safeNext(sp, fallback) {
  const n = sp.get('next')
  return n && n.startsWith('/') && !n.startsWith('//') ? n : fallback
}

export function Login() {
  const { login, user } = useAuth()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to={safeNext(sp, '/')} replace />

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const u = await login(email, password)
      nav(safeNext(sp, u.role === 'vendor' ? '/vendor' : '/'), { replace: true })
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  return (
    <AuthScene>
      <form className="auth-card" onSubmit={submit}>
        <InviteHead title="Хуш омадед" sub="Бо email ворид шавед" />
        <label className="field">
          <span>Email</span>
          <input type="email" required autoComplete="email" placeholder="shumo@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          <span>Парол</span>
          <PasswordInput required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <ErrorBox error={err} />
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? '…' : 'Ворид шудан'}</button>
        <GoogleButton onDone={(u) => nav(safeNext(sp, u.role === 'vendor' ? '/vendor' : '/'), { replace: true })} />
        <p className="center small">Ҳисоб надоред? <Link to={`/register${sp.get('next') ? `?next=${encodeURIComponent(sp.get('next'))}` : ''}`}>Сабти ном</Link></p>
      </form>
    </AuthScene>
  )
}

export function Register() {
  const { register, user } = useAuth()
  const toast = useToast()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const [f, setF] = useState({ full_name: '', email: '', password: '', password2: '', role: sp.get('role') === 'vendor' ? 'vendor' : 'client' })
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  if (user) return <Navigate to="/" replace />
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    if (f.password !== f.password2) return setErr(new Error('Паролҳо мувофиқ нестанд'))
    setBusy(true); setErr(null)
    try {
      const u = await register({ full_name: f.full_name, email: f.email, password: f.password, role: f.role })
      toast('Хуш омадед!')
      nav(u.role === 'vendor' ? '/vendor/listings/new' : safeNext(sp, '/'), { replace: true })
    } catch (e2) { setErr(e2) } finally { setBusy(false) }
  }

  return (
    <AuthScene>
      <form className="auth-card" onSubmit={submit}>
        <InviteHead title="Сабти ном" />
        <div className="role-switch" role="radiogroup" aria-label="Нақши шумо">
          <button type="button" role="radio" aria-checked={f.role === 'client'} className={f.role === 'client' ? 'on' : ''} onClick={() => setF({ ...f, role: 'client' })}>
            <b><Icon name="rings" /> Тӯй дорам</b><span>Хизмат меҷӯям</span>
          </button>
          <button type="button" role="radio" aria-checked={f.role === 'vendor'} className={f.role === 'vendor' ? 'on' : ''} onClick={() => setF({ ...f, role: 'vendor' })}>
            <b><Icon name="briefcase" /> Хизматрасон</b><span>Эълон мегузорам</span>
          </button>
        </div>
        <label className="field">
          <span>{f.role === 'vendor' ? 'Ном ё номи ширкат' : 'Ному насаб'}</span>
          <input required minLength={2} maxLength={120} value={f.full_name} onChange={set('full_name')} autoComplete="name" />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" required placeholder="shumo@mail.com" value={f.email} onChange={set('email')} autoComplete="email" />
        </label>
        <div className="row2">
          <label className="field">
            <span>Парол</span>
            <PasswordInput required minLength={6} maxLength={72} value={f.password} onChange={set('password')} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>Такрори парол</span>
            <PasswordInput required value={f.password2} onChange={set('password2')} autoComplete="new-password" />
          </label>
        </div>
        <ErrorBox error={err} />
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>{busy ? '…' : 'Сохтани ҳисоб'}</button>
        <GoogleButton role={f.role} onDone={(u) => { toast('Хуш омадед!'); nav(u.role === 'vendor' ? '/vendor' : safeNext(sp, '/'), { replace: true }) }} />
        <p className="center small">Ҳисоб доред? <Link to="/login">Ворид шавед</Link></p>
      </form>
    </AuthScene>
  )
}
