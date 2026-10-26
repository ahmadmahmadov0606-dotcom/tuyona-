import { Children, cloneElement, isValidElement, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Ornament } from '../components/fx'
import NightPage from '../components/NightPage'
import { WEDDING_LIMITS } from '../utils'
import './Law.css'

// Мухтасари Қонуни ҶТ «Дар бораи танзими ҷашну маросим дар Ҷумҳурии Тоҷикистон»
// аз 20 июни соли 2024, №2048 (матни пурра: khovar.tj, «Ҷумҳурият», 22.06.2024).
const SOURCE_URL = 'https://khovar.tj/2024/06/onuni-um-urii-to-ikiston-dar-borai-tanzimi-ashnu-marosim-dar-um-urii-to-ikiston/'

const BANNED_WEDDING = [
  'Фотиҳаи тӯй', 'Маслиҳатошӣ', 'Идонабарӣ', 'Сандуқбарон', 'Сарупобинон', 'Чойгаштак', 'Раисталбон', 'Қудоталбон',
  'Ноншиканон', 'Хонакашон', 'Модарталбон', 'Падарталбон', 'Рӯйбинон', 'Чодарканон', 'Муборакбодӣ', 'Шаҳтозон (роҳбандон)',
  'Тақдими сарупо ба меҳмонон ва хешовандон',
]

const BANNED_MOURNING = ['Оши сари тахта', 'Душанбегӣ', 'Ҷумъагӣ', 'Ҳафт', 'Бист', 'Шашмоҳагӣ']

// Матни қонун — бетағйир. id/chip/ico танҳо барои навигатсия ва нишона.
const SECTIONS = [
  {
    id: 'tuy', chip: 'Тӯйи домоду арӯс', ico: 'rings', art: 'Моддаи 12', title: 'Тӯйи домодию арӯсӣ',
    items: [
      <>На зиёда аз <b>ду маърака</b> ва дар давоми на бештар аз <b>ду рӯз</b>, ба таври ихтиёрӣ.</>,
      <>Зиёфат — барои то <b>150 нафар</b>, оши тӯй — барои то <b>200 нафар</b>, аз ҳисоби ҳар ду ҷониб.</>,
      <>«Домодталбон» ва «арӯсбинон» — дар доираи оила, то <b>15 нафар</b>.</>,
      <>Корвони тӯй — на бештар аз <b>4 мошини сабукрав</b>.</>,
      <>Тӯҳфа танҳо ба арӯсу домод ва падару модарашон иҷозат аст.</>,
      <>Бо розигии ҷонибҳо маблағи зиёфатро барои шароити зисти ҷавонон ё корҳои хайр (роҳ, обрасонӣ, сохтмон) сарф кардан мумкин.</>,
    ],
  },
  {
    id: 'vaqt', chip: 'Вақти гузаронидан', ico: 'clock', art: 'Моддаи 16', title: 'Вақт ва давомнокӣ',
    items: [
      <>Давомнокии тӯю маъракаҳо — то <b>3 соат</b>.</>,
      <><b>Шаҳр:</b> рӯзҳои истироҳат 08:00–22:00, рӯзҳои корӣ 18:00–22:00.</>,
      <><b>Деҳот:</b> рӯзҳои истироҳат 06:00–22:00 (1 апрел – 31 октябр) ва 08:00–22:00 (1 ноябр – 31 март), рӯзҳои корӣ 18:00–22:00.</>,
    ],
  },
  {
    id: 'joy', chip: 'Ҷойи баргузорӣ', ico: 'building', art: 'Моддаи 15', title: 'Ҷойи баргузорӣ',
    items: [
      <>Майдончаҳо (ҳавлиҳо)-и назди биноҳои истиқоматӣ ва дохили манзил.</>,
      <>Тарабхона, қаҳвахона, ошхона ва тӯйхонаҳо — бо риояи тартиботи ҷамъиятӣ.</>,
      <>Мавлудхонӣ — ихтиёрӣ, танҳо дар масҷид, бе ҷамъоварии пул ва хӯрок.</>,
    ],
  },
  {
    id: 'xizmat', chip: 'Барои хизматрасонҳо', ico: 'document', art: 'Моддаи 17', title: 'Барои хизматрасонҳо',
    items: [
      <>Хизмати санъаткорон дар ҷашну маросим дар асоси <b>шартномаи хаттӣ</b> расонида мешавад.</>,
      <>Роҳбарони тарабхона, қаҳвахона ва тӯйхонаҳо хизматро бо шартномаи хаттӣ ташкил медиҳанд ва талаботи шумораи меҳмонон ва вақтро риоя мекунанд.</>,
    ],
  },
  {
    id: 'zodruz', chip: 'Зодрӯз ва кӯдак', ico: 'cake', art: 'Моддаҳои 10–11', title: 'Зодрӯз, хатнасур ва таваллуди кӯдак',
    items: [
      <>Зодрӯз — ихтиёрӣ, танҳо дар доираи оила.</>,
      <>Номгузорӣ, гаҳворабандон, чиллагурезон, мӯйсаргирон — дар доираи оила, бе забҳи чорво ва бе хизмати санъаткорон.</>,
      <>Хатнасур — ихтиёрӣ, дар доираи оила ва бе хизмати санъаткорон.</>,
      <>Маъракаи <b>ақиқа манъ</b> аст.</>,
    ],
  },
  {
    id: 'dafn', chip: 'Дафн ва азодорӣ', ico: 'dove', art: 'Моддаи 14', title: 'Дафн ва азодорӣ',
    items: [
      <>Ҷаноза бе маҳдудияти шумораи иштироккунандагон.</>,
      <>Сеюм, чил ва солгард — бе забҳи чорво ва бе додани хӯрок.</>,
      <>Додани пул ва ашё манъ аст (ба истиснои музди гӯрков ва ғассол).</>,
    ],
  },
  {
    id: 'haj', chip: 'Ҳаҷ ва умра', ico: 'kaaba', art: 'Моддаи 13', title: 'Ҳаҷ ва умра',
    items: [
      <>Гусел ва пешвоз — дар доираи оила.</>,
      <>Ҳоҷизиёрат, ҳоҷиталбон, ҳоҷиошӣ, тақсими тӯҳфа ва оро додани ҳавлӣ, кӯча ва мошин манъ аст.</>,
    ],
  },
  {
    id: 'uhda', chip: 'Уҳдадорӣ ва ҷавобгарӣ', ico: 'scales', art: 'Моддаҳои 18 ва 20', title: 'Уҳдадорӣ ва ҷавобгарӣ',
    items: [
      <>Дар бораи тӯй ва маъракаи дафн ба <b>комиссияи доимии маҳаллӣ</b> хабар додан лозим.</>,
      <>Шод кардан ё часпондани пул дар ҷашну маросим манъ аст.</>,
      <>Зиёфат ба муносибати таъйин ба мансаб ё гирифтани мукофоти давлатӣ манъ аст.</>,
      <>Барои вайрон кардан ҷавобгарӣ пешбинӣ шудааст: ҷарима то <b>100 000 сомонӣ</b> (бо тағйирот ба Кодекси ҳуқуқвайронкунии маъмурӣ); шахсони мансабдор метавонанд аз вазифа озод шаванд.</>,
    ],
  },
]

const BAN_RE = /манъ/i

/** Матни оддии JSX (барои ҷустуҷӯ) */
function textOf(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf(node.props.children)
  return ''
}

/**
 * Танҳо услуб илова мекунад, матн бетағйир: <b> бо рақам/ҳад → тугмачаи тиллоӣ, бо «манъ» → гулобӣ-сурх;
 * мувофиқатҳои ҷустуҷӯ → <mark>.
 */
function decorate(node, re) {
  if (typeof node === 'string') {
    if (!re) return node
    const parts = node.split(re)
    return parts.length === 1 ? node : parts.map((p, i) => (i % 2 ? <mark key={i} className="lw-mark">{p}</mark> : p))
  }
  if (!isValidElement(node)) return node
  const kids = Children.map(node.props.children, (c) => decorate(c, re))
  if (node.type === 'b') {
    const t = textOf(node)
    const cls = BAN_RE.test(t) ? 'lw-ban' : /\d|ду /.test(t) ? 'lw-num' : 'lw-em'
    return cloneElement(node, { className: cls }, kids)
  }
  return cloneElement(node, {}, kids)
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function useIsMobile() {
  const q = '(max-width: 899px)'
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

export default function Law() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(SECTIONS[0].id)
  const [open, setOpen] = useState(() => new Set([SECTIONS[0].id]))
  const [showTop, setShowTop] = useState(false)
  const isMobile = useIsMobile()
  const cardRefs = useRef({})
  const chipRefs = useRef({})
  const lockUntil = useRef(0) // пас аз пахши чип, то охири scroll-и ҳамвор чипи интихобшуда фаъол мемонад

  const q = query.trim()
  const re = q ? new RegExp(`(${escapeRe(q)})`, 'gi') : null
  const visible = useMemo(() => {
    if (!q) return SECTIONS
    const needle = q.toLowerCase()
    return SECTIONS.filter((s) => `${s.art} ${s.title} ${s.items.map(textOf).join(' ')}`.toLowerCase().includes(needle))
  }, [q])

  // Ҳангоми ҷустуҷӯ дар мобилӣ кортҳои ёфташуда кушода мешаванд
  useEffect(() => { if (q) setOpen(new Set(visible.map((s) => s.id))) }, [q, visible])

  // Чипи фаъол аз рӯи scroll: корте, ки болояш аз хати зери навор гузаштааст ва ба он наздиктар аст
  // (дар шабака чанд корт якбора намоёнанд, барои ҳамин «аввалин намоён» дуруст нест)
  useEffect(() => {
    let raf = 0
    const LINE = 200
    const pick = () => {
      if (Date.now() < lockUntil.current) return
      const cards = visible.map((s) => cardRefs.current[s.id]).filter(Boolean)
      if (!cards.length) return
      let best = null
      cards.forEach((el) => {
        const top = el.getBoundingClientRect().top
        if (top <= LINE && (!best || top > best.top)) best = { id: el.dataset.id, top }
      })
      setActive(best ? best.id : cards[0].dataset.id)
    }
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(pick) }
    pick()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [visible, open])

  // Чипи фаъол дар навори уфуқӣ намоён бошад (танҳо навор scroll мешавад, на саҳифа)
  useEffect(() => {
    const chip = chipRefs.current[active]
    const bar = chip?.parentElement
    if (bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2, behavior: 'smooth' })
  }, [active])

  // Пайдошавии кортҳо — як бор. IntersectionObserver ҳангоми scroll-и тез (тугмаи ↑, чипҳо) элементро гум мекунад,
  // барои ҳамин ҳар элементе, ки болояш ба экран расид ё аз он гузашт, нишон дода мешавад.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.lw-rise').forEach((e) => e.classList.add('in'))
      return
    }
    let raf = 0
    const reveal = () => {
      const limit = window.innerHeight - 30
      document.querySelectorAll('.lw-rise:not(.in)').forEach((e) => { if (e.getBoundingClientRect().top < limit) e.classList.add('in') })
    }
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(reveal) }
    reveal()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [visible, open])

  useEffect(() => {
    const on = () => setShowTop(window.scrollY > 700)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const goTo = (id) => {
    setActive(id)
    lockUntil.current = Date.now() + 1000
    if (isMobile) setOpen((s) => new Set(s).add(id))
    requestAnimationFrame(() => {
      const el = cardRefs.current[id]
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 170, behavior: 'smooth' })
    })
  }
  const toggle = (id) => setOpen((s) => {
    const n = new Set(s)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  return (
    <NightPage className="lw">
      <div className="container">
        <header className="lw-hero">
          <p className="lw-label">Қонуни Ҷумҳурии Тоҷикистон</p>
          <h1>Қонуни тӯй</h1>
          <p className="lw-sub" data-law-sub>
            Муҳимтарин талаботи Қонуни ҶТ «Дар бораи танзими ҷашну маросим дар Ҷумҳурии Тоҷикистон»
            аз <b>20 июни соли 2024, №2048</b> — барои тӯйи шумо ва хизматрасонҳо.
          </p>
          <Ornament className="lw-orn" />
          <ul className="lw-stats">
            <li><b>150</b><span>нафар зиёфат</span></li>
            <li><b>200</b><span>нафар оши тӯй</span></li>
            <li><b>4</b><span>мошин</span></li>
          </ul>
        </header>

        <p className="lw-note" data-law-note>
          Қонун пас аз интишори расмӣ (рӯзномаи «Ҷумҳурият», 22.06.2024) эътибор пайдо кард ва Қонуни соли 2007-ро
          «Дар бораи танзими анъана, ҷашн ва маросимҳо» аз эътибор соқит намуд. Дар ин саҳифа мухтасари он оварда шудааст —
          барои матни пурра ва расмӣ ба <a href={SOURCE_URL} target="_blank" rel="noreferrer">манбаъ</a> нигаред.
        </p>

        <div className="lw-nav">
          <nav className="lw-chips" aria-label="Бахшҳои қонун">
            {SECTIONS.map((s) => {
              const hidden = !visible.includes(s)
              return (
                <button key={s.id} type="button" ref={(el) => { chipRefs.current[s.id] = el }}
                  className={`lw-chip ${active === s.id && !hidden ? 'on' : ''}`} disabled={hidden} onClick={() => goTo(s.id)}>
                  {s.chip}
                </button>
              )
            })}
          </nav>
          <label className="lw-search">
            <Icon name="search" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ҷустуҷӯ дар қонун…" aria-label="Ҷустуҷӯ дар қонун" />
            {query && <button type="button" className="lw-clear" onClick={() => setQuery('')} aria-label="Тоза кардан">✕</button>}
          </label>
        </div>

        {visible.length === 0 ? (
          <div className="lw-empty">
            <Icon name="search" />
            <b>Ҳеҷ чиз ёфт нашуд</b>
            <p>Барои «{q}» дар қонун мувофиқат нест. Калимаи дигарро санҷед, масалан «зиёфат» ё «манъ».</p>
            <button type="button" className="lw-btn-outline" onClick={() => setQuery('')}>Тоза кардани ҷустуҷӯ</button>
          </div>
        ) : (
          <div className="lw-masonry">
            {visible.map((s, i) => {
              const isOpen = !isMobile || open.has(s.id)
              const head = (
                <>
                  <span className="lw-ico-wrap"><Icon name={s.ico} /></span>
                  <span className="lw-head-text">
                    <span className="lw-art" data-law-art>{decorate(s.art, re)}</span>
                    <span className="lw-title" data-law-title>{decorate(s.title, re)}</span>
                  </span>
                  {isMobile && <span className={`lw-chev ${isOpen ? 'up' : ''}`} aria-hidden="true">⌄</span>}
                </>
              )
              return (
                <article key={s.id} id={`moddai-${s.id}`} data-id={s.id} data-law-card ref={(el) => { cardRefs.current[s.id] = el }}
                  className={`lw-card lw-rise ${isOpen ? 'open' : ''}`} style={{ '--i': i % 3 }}>
                  {isMobile
                    ? <button type="button" className="lw-head" aria-expanded={isOpen} onClick={() => toggle(s.id)}>{head}</button>
                    : <div className="lw-head">{head}</div>}
                  {isOpen && (
                    <ul className="lw-items">
                      {s.items.map((it, k) => (
                        <li key={k}>
                          {BAN_RE.test(textOf(it)) && <span className="lw-pill lw-pill-ban" data-pill>Манъ</span>}
                          {decorate(it, re)}
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )}

        <section className="lw-glass lw-banned lw-rise" data-law-banned>
          <h2>Маъракаҳое, ки манъ шудаанд</h2>
          <Ornament className="lw-orn lw-orn-left" />
          <h3>Вобаста ба тӯй (моддаи 12)</h3>
          <div className="lw-bans">{BANNED_WEDDING.map((b) => <span key={b} data-chip>{b}</span>)}</div>
          <h3>Вобаста ба азодорӣ (моддаи 14)</h3>
          <div className="lw-bans">{BANNED_MOURNING.map((b) => <span key={b} data-chip>{b}</span>)}</div>
          <h3>Дигар</h3>
          <div className="lw-bans"><span data-chip>Ақиқа</span><span data-chip>Шод кардани пул</span><span data-chip>Зиёфат барои мансаб ё мукофот</span></div>
        </section>

        <WeddingCheck />

        <div className="lw-glass lw-cta lw-rise">
          <div>
            <h2>Тӯйи зебо — дар доираи қонун</h2>
            <p>Тӯйхона, мошин ва хизматрасонҳоро ёбед, ки талаботи қонунро риоя мекунанд.</p>
          </div>
          <Link to="/search" className="btn btn-gold btn-lg">Ҷустуҷӯи хизматҳо</Link>
        </div>

        <p className="lw-disclaimer" data-law-disclaimer>
          Ин маълумот барои шиносоӣ аст ва машварати ҳуқуқӣ намебошад. Пеш аз ташкили тӯй бо комиссияи маҳаллии
          танзими ҷашну маросим (мақомоти иҷроияи маҳаллӣ) маслиҳат кунед. Манбаъ: <a href={SOURCE_URL} target="_blank" rel="noreferrer">khovar.tj — матни Қонун</a>.
        </p>
      </div>

      {/* Ба body мебарем: animation-и волидҳо position: fixed-ро вайрон мекунад */}
      {createPortal(
        <button type="button" className={`lw-top ${showTop ? 'show' : ''}`} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Ба боло" tabIndex={showTop ? 0 : -1}>↑</button>,
        document.body,
      )}
    </NightPage>
  )
}

/* ---------- Нишонаҳои тиллоии line-art ---------- */
function Icon({ name }) {
  const p = {
    rings: <><circle cx="9.5" cy="14" r="5.5" /><circle cx="14.5" cy="14" r="5.5" /><path d="M9.5 8.5l1.5-3h2l1.5 3" /></>,
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /><path d="M12 2.5v1M21.5 12h-1M12 21.5v-1M2.5 12h1" /></>,
    building: <><path d="M3 20.5h18M5 20.5V10M19 20.5V10M3.5 10L12 4l8.5 6z" /><path d="M8.5 20.5v-6M12 20.5v-6M15.5 20.5v-6" /></>,
    document: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M9.5 11h6M9.5 14h6M9.5 17h4" /></>,
    cake: <><path d="M4 20.5h16v-7H4zM4 16.5c2 1.3 4 1.3 6 0s4-1.3 6 0 3 1 4 .5" /><path d="M8 13.5v-3M12 13.5v-3M16 13.5v-3" /><path d="M8 8.5c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3zM12 8.5c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3zM16 8.5c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3z" /></>,
    dove: <><path d="M3 13c3 0 5-1 7-3 1.5-1.5 3-5 7-5 1.5 0 3 .8 4 2l-2.5 1c0 5-3.5 9-9 9-2 0-4-.8-5-2z" /><path d="M10 10c-1.5-2-3-3-6-3 .5 3 2 5 4.5 6" /><circle cx="17" cy="7.5" r=".6" /></>,
    kaaba: <><path d="M12 3.5l8 3.5v10l-8 3.5-8-3.5V7z" /><path d="M4 7l8 3.5L20 7M12 10.5V20.5" /><path d="M4 10.5l8 3.5 8-3.5" /></>,
    scales: <><path d="M12 3.5v17M7 20.5h10M5 6.5h14M12 3.5l-1 3h2z" /><path d="M5 6.5l-3 7h6zM19 6.5l-3 7h6z" /><path d="M2 13.5a3 3 0 0 0 6 0M16 13.5a3 3 0 0 0 6 0" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5l5 5" /></>,
  }[name]
  return <svg className={`lw-ico lw-ico-${name}`} viewBox="0 0 24 24" aria-hidden="true">{p}</svg>
}

// Санҷиши тез: оё нақшаи тӯй ба ҳадҳои қонун мувофиқ аст? (мантиқ бетағйир)
function WeddingCheck() {
  const [f, setF] = useState({ feast: '', osh: '', cars: '', place: 'city', day: 'rest', date: '', start: '18:00', hours: '3' })
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const [h, m] = f.start.split(':').map(Number)
  const startMin = h * 60 + m
  const endMin = startMin + Number(f.hours || 0) * 60
  // Барои деҳот соати оғоз аз мавсим вобаста аст — моҳро аз санаи тӯй мегирем
  const month = f.date ? Number(f.date.slice(5, 7)) : new Date().getMonth() + 1
  const opens = f.day === 'work' ? 18 * 60 : f.place === 'village' && month >= 4 && month <= 10 ? 6 * 60 : 8 * 60

  const checks = [
    f.feast !== '' && { ok: Number(f.feast) <= WEDDING_LIMITS.feast, text: `Зиёфат: ${f.feast} нафар (ҳад — ${WEDDING_LIMITS.feast})` },
    f.osh !== '' && { ok: Number(f.osh) <= WEDDING_LIMITS.osh, text: `Оши тӯй: ${f.osh} нафар (ҳад — ${WEDDING_LIMITS.osh})` },
    f.cars !== '' && { ok: Number(f.cars) <= WEDDING_LIMITS.cars, text: `Корвон: ${f.cars} мошин (ҳад — ${WEDDING_LIMITS.cars})` },
    { ok: Number(f.hours) <= WEDDING_LIMITS.hours, text: `Давомнокӣ: ${f.hours} соат (ҳад — ${WEDDING_LIMITS.hours})` },
    { ok: startMin >= opens && endMin <= 22 * 60, text: `Вақт: ${f.start} – ${fmt(endMin)} (иҷозат: ${fmt(opens)} – 22:00)` },
  ].filter(Boolean)
  const allOk = checks.every((c) => c.ok)

  return (
    <section className="lw-glass lw-check lw-rise">
      <div className="lw-check-head">
        <div>
          <p className="lw-label">Санҷиши тез</p>
          <h2>Оё тӯйи шумо ба қонун мувофиқ аст?</h2>
        </div>
        <span className={`lw-verdict ${allOk ? 'ok' : 'no'}`}>{allOk ? '✓ Мувофиқ' : '✕ Мувофиқ нест'}</span>
      </div>
      <div className="lw-check-grid">
        <div className="lw-fields">
          <label className="lw-field"><span>Зиёфат (нафар)</span><input type="number" min="0" value={f.feast} onChange={set('feast')} placeholder="масалан 150" /></label>
          <label className="lw-field"><span>Оши тӯй (нафар)</span><input type="number" min="0" value={f.osh} onChange={set('osh')} placeholder="масалан 200" /></label>
          <label className="lw-field"><span>Мошинҳои корвон</span><input type="number" min="0" value={f.cars} onChange={set('cars')} placeholder="то 4" /></label>
          <label className="lw-field"><span>Давомнокӣ (соат)</span><input type="number" min="1" max="12" value={f.hours} onChange={set('hours')} /></label>
          <label className="lw-field"><span>Ҷой</span>
            <select value={f.place} onChange={set('place')}><option value="city">Шаҳр</option><option value="village">Деҳот</option></select>
          </label>
          <label className="lw-field"><span>Рӯз</span>
            <select value={f.day} onChange={set('day')}><option value="rest">Рӯзи истироҳат</option><option value="work">Рӯзи корӣ</option></select>
          </label>
          <label className="lw-field"><span>Санаи тӯй</span><input type="date" value={f.date} onChange={set('date')} /></label>
          <label className="lw-field"><span>Оғози тӯй</span><input type="time" value={f.start} onChange={set('start')} /></label>
        </div>
        <ul className="lw-results">
          {checks.map((c) => <li key={c.text} className={c.ok ? 'ok' : 'no'}><b>{c.ok ? '✓' : '✕'}</b> {c.text}</li>)}
          {f.place === 'village' && f.day === 'rest' && (
            <li className="info"><b>i</b> Дар деҳот аз 1 апрел то 31 октябр тӯй метавонад аз соати 06:00 оғоз шавад, дар моҳҳои дигар — аз 08:00.</li>
          )}
        </ul>
      </div>
    </section>
  )
}

const fmt = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
