// Гузариши кортҳои шоурум бо Web Animations API.
// Ҳар анимация аз ҳолати ҳозираи намоёни корт оғоз мешавад (getComputedStyle), бинобар ин
// жест ё клики нав дар мобайни гузариш бе ҷаҳиш онро идома медиҳад. Танҳо transform/opacity/filter.

const OUT_MS = 380
const IN_MS = 520
const OVERLAP_MS = 120 // баромад ва даромад ҳамдигарро мепӯшонанд — кадри холӣ нест
const IN_DELAY = OUT_MS - OVERLAP_MS
const TOTAL = IN_DELAY + IN_MS
const EASE_OUT = 'cubic-bezier(0.55, 0, 0.75, 0.2)'
const EASE_IN = 'cubic-bezier(0.16, 1, 0.3, 1)'
const INFO_DELAY = TOTAL - 120 // ном пас аз «истодан», рақамҳо 80 мс баъд
const INFO_STEP = 80

const stop = (el) => el?.getAnimations().forEach((a) => a.cancel())

// Ҳолати ҳозираи намоён (бо назардошти анимацияи нотамом) — нуқтаи оғози анимацияи нав
function snapshot(el) {
  const cs = getComputedStyle(el)
  return { transform: cs.transform === 'none' ? 'none' : cs.transform, opacity: cs.opacity, filter: cs.filter === 'none' ? 'blur(0px)' : cs.filter }
}

// Ҷойи охирини корт аз CSS (--tx/--ry/--sc/--op аз рӯи data-pos)
function restingState(el) {
  const cs = getComputedStyle(el)
  const v = (k) => cs.getPropertyValue(k).trim()
  return { transform: `translateX(${v('--tx')}) rotateY(${v('--ry')}) scale(${v('--sc')})`, opacity: v('--op') }
}

/**
 * outEl — корти пештара (метавонад набошад), inEl — корти нав.
 * dir: 1 — мошинҳо ба чап мераванд (навбатӣ), −1 — ба рост.
 * fresh — корти нав ҳозир пайдо шуд (ҳолати пешинаи намоён надорад).
 */
export function runSwitch({ outEl, inEl, dir, fresh, reduced }) {
  const fromOut = outEl && snapshot(outEl)
  const fromIn = inEl && !fresh && snapshot(inEl)
  stop(outEl); stop(inEl)
  const parts = inEl ? [...inEl.querySelectorAll('.cs-info > *, .cs-actions')] : []
  parts.forEach(stop)

  if (reduced) {
    inEl?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' })
    return
  }

  if (outEl) {
    const rest = restingState(outEl)
    const duration = TOTAL + 200
    const split = OUT_MS / duration
    outEl.animate([
      { ...fromOut, easing: EASE_OUT },
      { transform: `translateX(${-dir * 40}%) scale(0.9)`, opacity: 0, filter: 'blur(4px)', offset: split },
      // пас аз рафтан корт бе намоён шудан ба ҷойи паҳлӯӣ мегузарад ва нарм пайдо мешавад
      { transform: rest.transform, opacity: 0, filter: 'blur(0px)', offset: split + 0.001, easing: 'ease-out' },
      { transform: rest.transform, opacity: rest.opacity, filter: 'blur(0px)' },
    ], { duration })
  }

  if (inEl) {
    const start = { transform: `translateX(${dir * 40}%) scale(0.92)`, opacity: 0, filter: 'blur(4px)' }
    const a = IN_DELAY / TOTAL
    const land = a + (IN_MS * 0.72) / TOTAL
    inEl.animate([
      // корти паҳлӯӣ (ё нимароҳ) аввал нарм ба нуқтаи оғоз меравад — бе ҷаҳиш
      { ...(fromIn || start), easing: 'ease-in' },
      { ...start, offset: a, easing: EASE_IN },
      { transform: 'translateX(0) translateY(0) scale(1)', opacity: 1, filter: 'blur(0px)', offset: land, easing: 'ease-out' },
      { transform: 'translateX(0) translateY(3px) scale(1)', opacity: 1, filter: 'blur(0px)', offset: land + (1 - land) * 0.45, easing: 'ease-in-out' }, // «клевок»
      { transform: 'none', opacity: 1, filter: 'blur(0px)' },
    ], { duration: TOTAL })

    parts.forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }],
      { duration: 300, delay: INFO_DELAY + i * INFO_STEP, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'backwards' },
    ))
  }
}

export const GLOW_DELAY = TOTAL - 80 // дурахши ҳошия дар лаҳзаи «истодан»
