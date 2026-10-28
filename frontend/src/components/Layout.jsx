import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Ornament, useRevealAll } from './fx'
import Icon from './Icon'
import WeddingAssistant from './WeddingAssistant'

// Саҳифаҳое, ки болояшон торик аст — header дар болои онҳо шаффоф мешавад.
const NIGHT_PAGES = ['/', '/login', '/register', '/qonun', '/harita', '/oroishgoh']

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Тӯёна — саҳифаи асосӣ">
      <span className="logo-mark">
        <svg viewBox="0 0 64 64" width="38" height="38" aria-hidden="true">
          <defs>
            <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f8e0a6" /><stop offset=".55" stopColor="#c9963f" /><stop offset="1" stopColor="#f1cf86" />
            </linearGradient>
          </defs>
          <path d="M32 3C46 3 56 13 56 27V61H8V27C8 13 18 3 32 3Z" fill="var(--brand)" />
          <path d="M32 7C44 7 52 15 52 27V57H12V27C12 15 20 7 32 7Z" fill="none" stroke="url(#lg-gold)" strokeWidth="1.2" opacity=".7" />
          <g fill="none" stroke="url(#lg-gold)" strokeWidth="3.6"><circle cx="26" cy="38" r="10" /><circle cx="38" cy="38" r="10" /></g>
          <path d="M26 24l3.5-5h5L38 24l-6 5z" fill="url(#lg-gold)" />
        </svg>
      </span>
      <span className="logo-text">Тӯёна<small>хизматҳои тӯй</small></span>
    </Link>
  )
}

function Header() {
  const { user, logout, isVendor, isAdmin } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => setOpen(false), [loc.pathname])
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  return (
    <header className={`header ${scrolled ? 'scrolled' : ''} ${NIGHT_PAGES.includes(loc.pathname) ? 'on-hero' : ''}`}>
      <div className="container header-in">
        <Logo />
        <button type="button" className="burger" aria-label="Меню" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
        <nav className={`nav ${open ? 'open' : ''}`}>
          <NavLink to="/search">Ҳамаи хизматҳо</NavLink>
          <NavLink to="/harita">Харита</NavLink>
          <NavLink to="/oroishgoh">Ороишгоҳ</NavLink>
          <NavLink to="/qonun">Қонуни тӯй</NavLink>
          {user && <NavLink to="/favorites"><Icon name="heart" className="nav-ico" /> Интихобшуда</NavLink>}
          {user && <NavLink to="/bookings">Бронҳои ман</NavLink>}
          {isVendor && <NavLink to="/vendor">Кабинети хизматрасон</NavLink>}
          {isAdmin && <NavLink to="/admin">Маъмур</NavLink>}
          {user ? (
            <div className="nav-user">
              <span className="avatar" title={user.full_name}>{user.full_name[0]}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { logout(); nav('/') }}>Баромад</button>
            </div>
          ) : (
            <div className="nav-user">
              <Link to="/login" className="btn btn-ghost btn-sm">Ворид</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Сабт</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  const loc = useLocation()
  return (
    <footer className="footer">
      <div className="footer-wave" aria-hidden="true" />
      <div className="footer-mark" aria-hidden="true">Тӯёна</div>
      <div className="container footer-in">
        <div>
          <Logo />
          <p className="footer-tag">Ҳамаи хизматҳои тӯй дар як ҷо — аз тӯйхона то мошини арӯс.</p>
          <Ornament className="footer-orn" />
        </div>
        <div className="footer-links">
          <Link to="/search">Ҷустуҷӯ</Link>
          <Link to="/register?role=vendor">Хизматрасон шавед</Link>
          <Link to="/search?group=venue">Тӯйхонаҳо</Link>
          <Link to="/search?group=transport">Мошини арӯс</Link>
          <Link to="/harita">Харитаи хизматҳо</Link>
          <Link to="/qonun">Қонуни танзими ҷашну маросим</Link>
          <Link to="/fikr" state={{ from: loc.pathname }}>Фикру пешниҳод</Link>
        </div>
        <p className="footer-copy small">© {new Date().getFullYear()} Тӯёна. Бо муҳаббат дар Тоҷикистон сохта шуд.
          {' '}· <Link to="/aksho">Аксҳо: Wikimedia Commons (CC BY / CC BY-SA)</Link></p>
      </div>
    </footer>
  )
}

export default function Layout() {
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  useRevealAll()
  return (
    <>
      <a href="#main" className="skip-link">Гузариш ба мундариҷа</a>
      <div className="silk-bg" aria-hidden="true" />
      <Header />
      <main id="main" tabIndex={-1} className="main" key={loc.pathname}><Outlet /></main>
      <Footer />
      <WeddingAssistant />
    </>
  )
}
