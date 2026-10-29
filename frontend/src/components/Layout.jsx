import { useEffect, useRef, useState } from 'react'
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
  const [userOpen, setUserOpen] = useState(false)
  const userBox = useRef(null)
  useEffect(() => { setOpen(false); setUserOpen(false) }, [loc.pathname])
  // Клик берун аз менюи ҳисоб ё Escape — пӯшида мешавад
  useEffect(() => {
    if (!userOpen) return undefined
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !userBox.current?.contains(e.target)) setUserOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [userOpen])
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
          <NavLink to="/fikr" state={{ from: loc.pathname }}>Фикру пешниҳод</NavLink>
          {user ? (
            // Пайвандҳои шахсӣ дар менюи ҳисоб — менюи боло барои корбари воридшуда ҳам як сатр мемонад
            <div className="nav-user" ref={userBox}>
              <button type="button" className="nav-user-btn" aria-haspopup="menu" aria-expanded={userOpen} onClick={() => setUserOpen(!userOpen)}>
                <span className="avatar" aria-hidden="true">{user.full_name[0].toUpperCase()}</span>
                <span className="nav-user-name">{user.full_name.split(' ')[0]}</span>
                <span className="nav-caret" aria-hidden="true">▾</span>
              </button>
              <div className={`user-menu ${userOpen ? 'open' : ''}`} role="menu">
                <NavLink to="/favorites" role="menuitem"><Icon name="heart" className="nav-ico" /> Интихобшуда</NavLink>
                <NavLink to="/bookings" role="menuitem">Бронҳои ман</NavLink>
                {isVendor && <NavLink to="/vendor" role="menuitem">Кабинети хизматрасон</NavLink>}
                {isAdmin && <NavLink to="/admin" role="menuitem">Панели маъмур</NavLink>}
                <button type="button" role="menuitem" className="user-menu-out" onClick={() => { logout(); nav('/') }}>Баромад</button>
              </div>
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
