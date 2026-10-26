import { useEffect, useState } from 'react'
import PHOTOS from './categoryPhotos.gen'

// Акси категория аз public/categories/optimized (агар скрипт онро сохта бошад), вагарна null
export function categoryPhoto(slug) {
  if (!PHOTOS.includes(slug)) return null
  const base = `/categories/optimized/${slug}`
  return { src: `${base}-600.webp`, srcSet: `${base}-600.webp 600w, ${base}-1200.webp 1200w` }
}

export const pad2 = (i) => String(i + 1).padStart(2, '0')
export const groupHref = (g) => `/search?group=${g.slug}`

// Оё элемент дар экран аст (once — пас аз бори аввал дигар назорат намекунем)
export function useInView(ref, { once = true, margin = '0px' } = {}) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    if (!('IntersectionObserver' in window)) { setInView(true); return undefined }
    const io = new IntersectionObserver(([en]) => {
      setInView(en.isIntersecting)
      if (en.isIntersecting && once) io.disconnect()
    }, { rootMargin: margin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, once, margin])
  return inView
}
