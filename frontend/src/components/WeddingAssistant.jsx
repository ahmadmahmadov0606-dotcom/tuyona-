import { Fragment, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { imgUrl } from '../utils'
import Icon from './Icon'
import './WeddingAssistant.css'

const SUGGESTIONS = [
  'Барои тӯйи 150 нафар чӣ қадар пул лозим?',
  'Нақшаи тӯйро аз 3 моҳ пеш тартиб деҳ',
  'Мошини арӯс дар Душанбе то 1500 сомонӣ',
  'Тӯйхона барои 150 нафар дар Душанбе',
]
const STORAGE = 'tuyona-assistant'
const load = () => { try { return JSON.parse(sessionStorage.getItem(STORAGE)) || [] } catch { return [] } }

// Танҳо роҳҳое, ки дар сайт воқеан ҳастанд — пайванди бофтаи AI матни оддӣ мемонад
const ROUTES = /^\/(listing\/\d+|moshin\/\d+|search(\?[^\s]*)?|qonun|harita|oroishgoh)$/

/** **ғафс** ва [матн](/роҳ) — танҳо пайвандҳои дохилии сайт (бе HTML, бехатар) */
export function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/[^)\s]*\))/g)
  return parts.map((p, i) => {
    const bold = p.match(/^\*\*([^*]+)\*\*$/)
    if (bold) return <b key={i}>{bold[1]}</b>
    const link = p.match(/^\[([^\]]+)\]\((\/[^)\s]*)\)$/)
    if (link) return ROUTES.test(link[2]) ? <Link key={i} to={link[2]}>{link[1]}</Link> : <b key={i}>{link[1]}</b>
    return <Fragment key={i}>{p}</Fragment>
  })
}

/** Ҷавоби AI: сатрҳо ва рӯйхатҳои «- » */
export function Reply({ text }) {
  const blocks = []
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/)
    const last = blocks[blocks.length - 1]
    if (item) {
      if (last?.type === 'ul') last.items.push(item[1])
      else blocks.push({ type: 'ul', items: [item[1]] })
    } else if (line.trim()) blocks.push({ type: 'p', text: line })
  }
  return blocks.map((b, i) => b.type === 'ul'
    ? <ul key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul>
    : <p key={i}><Inline text={b.text} /></p>)
}

/** «Тӯёна AI» — чат дар ҳамаи саҳифаҳо (Claude; хизматҳоро танҳо аз базаи сайт тавсия медиҳад) */
export default function WeddingAssistant() {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState(load)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const list = useRef(null)
  const input = useRef(null)

  useEffect(() => { api.assistantStatus().then((s) => setEnabled(s.enabled)).catch(() => {}) }, [])
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(messages.slice(-30))) } catch { /* ҳеҷ */ }
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy, open])
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!enabled) return null

  const send = async (question) => {
    const content = question.trim()
    if (!content || busy) return
    // Паёмҳои корбар, ки ҷавоб нагирифтаанд (масалан хатои пештара), ба AI як паём мешаванд
    const next = [...messages, { role: 'user', content }]
    setMessages(next); setText(''); setError(''); setBusy(true)
    let reply = ''
    try {
      // Ҷавоб пора-пора меояд — матн пас аз чанд сония пайдо мешавад, на баъд аз як дақиқа
      const res = await api.assistantStream(next.map(({ role, content: c }) => ({ role, content: c })), (delta) => {
        reply += delta
        setMessages([...next, { role: 'assistant', content: reply }])
      })
      setMessages([...next, { role: 'assistant', content: reply, listings: res.listings }])
    } catch (e) {
      // Ҷавоби нопурра намемонад; саволро бори дигар фиристодан мумкин
      setMessages(next)
      setError(e.message)
    } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" className={`wa-fab ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Ёрдамчии тӯй">
        <Icon name={open ? 'close' : 'sparkle'} />
        {!open && <span>Ёрдамчии тӯй</span>}
      </button>

      {open && (
        <section className="wa" role="dialog" aria-label="Тӯёна AI">
          <header className="wa-head">
            <span className="wa-seal" aria-hidden="true"><Icon name="sparkle" /></span>
            <div><b>Тӯёна AI</b><small>Ёрдамчӣ дар ташкили тӯй</small></div>
            {messages.length > 0 && (
              <button type="button" onClick={() => { setMessages([]); setError('') }} aria-label="Сӯҳбати нав" title="Сӯҳбати нав"><Icon name="refresh" /></button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Пӯшидан"><Icon name="close" /></button>
          </header>

          <div className="wa-list" ref={list} aria-live="polite">
            {messages.length === 0 && (
              <div className="wa-hello">
                <p>Салом! Дар буҷа, нақша, анъанаҳо ва интихоби хизматҳо ёрӣ медиҳам. Хизматҳоро танҳо аз каталоги сайт тавсия медиҳам.</p>
                {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`wa-msg ${m.role}`}>
                <div className="wa-bubble">{m.role === 'user' ? m.content : <Reply text={m.content} />}</div>
                {m.listings?.length > 0 && (
                  <div className="wa-cards">
                    {m.listings.map((l) => (
                      <Link key={l.id} to={`/listing/${l.id}`} className="wa-card">
                        {l.cover ? <img src={imgUrl(l.cover)} alt="" loading="lazy" /> : <span className="wa-card-ph"><Icon name="flower" /></span>}
                        <span><b>{l.title}</b><small>{l.city} · {l.price}</small></span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && messages[messages.length - 1]?.role === 'user' && (
              <div className="wa-typing" role="status"><i /><i /><i /><span>Фикр мекунад…</span></div>
            )}
            {error && <p className="wa-error">{error}</p>}
          </div>

          <form className="wa-form" onSubmit={(e) => { e.preventDefault(); send(text) }}>
            <textarea ref={input} value={text} rows={1} maxLength={2000} placeholder="Саволатонро нависед…" aria-label="Савол"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text) } }} />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Фиристодан"><Icon name="send" /></button>
          </form>
          <p className="wa-foot">AI метавонад хато кунад — нарх ва санаро бо хизматрасон аниқ кунед.</p>
        </section>
      )}
    </>
  )
}
