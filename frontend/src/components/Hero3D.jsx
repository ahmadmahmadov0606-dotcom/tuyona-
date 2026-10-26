import { useEffect, useRef, useState } from 'react'

/**
 * Саҳнаи 3D-и саҳифаи асосӣ: ду ангуштарини тиллоии ба ҳам бандшуда, алмос,
 * гулбаргҳои афтанда ва гарди тиллоӣ. three.js танҳо дар ҳамин ҷо бор карда мешавад.
 * Ҷойи ангуштаринҳо аз рӯи элементи `anchorRef` (сутуни рост ё ҷойи болои мобилӣ) муайян мешавад.
 */
export default function Hero3D({ anchorRef }) {
  const wrap = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let disposed = false
    let cleanup = () => {}
    import('./hero-scene').then(({ createScene }) => {
      if (disposed || !wrap.current) return
      try {
        cleanup = createScene(wrap.current, () => anchorRef?.current)
      } catch {
        setFailed(true)
      }
    }).catch(() => setFailed(true))
    return () => { disposed = true; cleanup() }
  }, [anchorRef])

  return (
    <div className="hero-3d" ref={wrap} aria-hidden="true">
      {failed && <div className="rings-css"><i /><i /></div>}
    </div>
  )
}
