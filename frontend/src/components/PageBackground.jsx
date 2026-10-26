import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import './PageBackground.css'

const LIGHTS = 16 // шумораи чароғҳо (дар мобилӣ CSS танҳо 6-тоашро нишон медиҳад)

/** Ҳангоми пинҳон будани таб true — барои бозмондани аниматсияҳо */
export function usePageHidden() {
  const [hidden, setHidden] = useState(() => document.hidden)
  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return hidden
}

/**
 * Заминаи ягонаи саҳифаҳо («Шаби тӯй», аз /qonun): градиенти бургундӣ, нақши сӯзанӣ, чароғҳои шинокунанда ва виньетка.
 * position: fixed дар зери ҳамаи мундариҷа; ба body бурда мешавад, то transform-и волидҳо (аниматсияи саҳифа) онро вайрон накунад.
 * Дар вақти намоиш ба body синфи .has-page-bg (барои ранги матнҳое, ки бевосита болои замина меистанд)
 * ва ҳангоми пинҳон будани таб .page-bg-paused илова мешавад.
 */
export default function PageBackground() {
  const paused = usePageHidden()
  useEffect(() => {
    document.body.classList.add('has-page-bg')
    return () => document.body.classList.remove('has-page-bg', 'page-bg-paused')
  }, [])
  // синф дар body — то аниматсияҳои дигари саҳифа (масалан нури hero) ҳам таваққуф кунанд
  useEffect(() => { document.body.classList.toggle('page-bg-paused', paused) }, [paused])
  return createPortal(
    <div className={`page-bg ${paused ? 'is-paused' : ''}`} aria-hidden="true">
      <div className="page-bg-pattern" />
      {Array.from({ length: LIGHTS }, (_, i) => <span key={i} className={`page-bg-light l${i + 1}`} />)}
      <div className="page-bg-vignette" />
    </div>,
    document.body,
  )
}
