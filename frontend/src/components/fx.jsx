import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Хами 3D бо мушак: --rx/--ry (кунҷ) ва --gx/--gy (ҷойи нур) барои CSS. */
export function useTilt(max = 9) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !canHover()) return
    let raf = 0
    const move = (e) => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`)
        el.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`)
        el.style.setProperty('--gx', `${px * 100}%`)
        el.style.setProperty('--gy', `${py * 100}%`)
      })
    }
    const enter = () => el.classList.add('tilting')
    const leave = () => {
      cancelAnimationFrame(raf)
      el.classList.remove('tilting')
      el.style.setProperty('--rx', '0deg')
      el.style.setProperty('--ry', '0deg')
    }
    el.addEventListener('pointerenter', enter)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('pointerenter', enter)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
    }
  }, [max])
  return ref
}

/** Блок бо хами 3D — барои карточкаҳо ва панелҳо. */
export function Tilt({ as: Tag = 'div', max, className = '', children, ...rest }) {
  const ref = useTilt(max)
  return <Tag ref={ref} className={`tilt ${className}`} {...rest}>{children}<span className="tilt-glare" aria-hidden="true" /></Tag>
}

/**
 * Пайдошавии элементҳо ҳангоми scroll. Ба ҳар элемент бо синфи .reveal
 * (ҳатто баъд аз боркунии API) синфи .in илова мешавад.
 */
export function useRevealAll() {
  const loc = useLocation()
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target) }
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
    const scan = () => document.querySelectorAll('.reveal:not(.in)').forEach((el) => {
      if (reduce) el.classList.add('in')
      else io.observe(el)
    })
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(document.getElementById('root'), { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect() }
  }, [loc.pathname])
}

/** Ороиши тиллоӣ (нақши сӯзанӣ) барои ҷудокунии бахшҳо. */
export function Ornament({ className = '' }) {
  return (
    <svg className={`ornament ${className}`} viewBox="0 0 240 24" aria-hidden="true">
      <path d="M0 12h92M148 12h92" stroke="currentColor" strokeWidth="1" />
      <circle cx="86" cy="12" r="2" fill="currentColor" />
      <circle cx="154" cy="12" r="2" fill="currentColor" />
      <g fill="none" stroke="currentColor" strokeWidth="1.3">
        <path d="M120 2l10 10-10 10-10-10z" />
        <path d="M120 7l5 5-5 5-5-5z" fill="currentColor" />
        <path d="M100 12c4-6 8-6 10 0M140 12c-4-6-8-6-10 0M100 12c4 6 8 6 10 0M140 12c-4 6-8 6-10 0" />
      </g>
    </svg>
  )
}

/** Ду ҳалқаи 3D-и CSS — барои боркунӣ ва ҳолатҳои холӣ. */
export function Rings3D({ size = 'md' }) {
  return <span className={`rings3d rings3d-${size}`} aria-hidden="true"><i /><i /></span>
}

/** Медалиони сӯзанӣ (SVG), ки дар 3D гардиш мекунад. */
export function Suzani({ className = '' }) {
  const petals = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg className={`suzani ${className}`} viewBox="-100 -100 200 200" aria-hidden="true">
      <defs>
        <linearGradient id="sz-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f7dc9c" /><stop offset=".5" stopColor="#d4a24c" /><stop offset="1" stopColor="#f3d08a" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#sz-g)" strokeWidth="1.6">
        <circle r="96" /><circle r="88" strokeDasharray="2 5" />
        {petals.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M0-84C14-70 14-52 0-40C-14-52-14-70 0-84Z" />
            <path d="M0-76C6-68 6-56 0-50C-6-56-6-68 0-76Z" fill="url(#sz-g)" opacity=".35" />
            <circle cy="-30" r="3" fill="url(#sz-g)" />
          </g>
        ))}
        <circle r="26" /><circle r="18" fill="url(#sz-g)" opacity=".25" />
        {petals.map((a) => <path key={a} transform={`rotate(${a + 15})`} d="M0-26L4-18L0-12L-4-18Z" fill="url(#sz-g)" />)}
      </g>
    </svg>
  )
}
