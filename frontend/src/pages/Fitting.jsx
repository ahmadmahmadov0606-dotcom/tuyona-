import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api'
import { useAuth } from '../auth'
import Icon from '../components/Icon'
import NightPage from '../components/NightPage'
import { Reply } from '../components/WeddingAssistant'
import { Ornament } from '../components/fx'
import { Price, Spinner, useToast } from '../components/ui'
import { imgUrl, useAsync, useCatalog } from '../utils'
import './Fitting.css'

const TIPS = ['Қади пурра ё то зону', 'Рӯ ба рӯ, дастҳо дар паҳлу', 'Равшанӣ хуб, замина содда', 'Либоси танг беҳтар аст']
const DRAG_TYPE = 'application/x-listing'

function usePreview(file) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!file) { setUrl(null); return }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}

/** Майдоне, ки ба он сурат ё либос (аз рӯйхат) кашида партофтан мумкин аст */
function useDrop(onDrop) {
  const [over, setOver] = useState(false)
  return [over, {
    onDragOver: (e) => { e.preventDefault(); setOver(true) },
    onDragLeave: () => setOver(false),
    onDrop: (e) => { e.preventDefault(); setOver(false); onDrop(e) },
  }]
}

function PhotoDrop({ onFile, onOutfitDrop }) {
  const input = useRef(null)
  const [over, drop] = useDrop((e) => {
    const file = e.dataTransfer.files?.[0]
    if (file?.type.startsWith('image/')) onFile(file)
    else onOutfitDrop(e)
  })
  return (
    <div className={`ft-drop ${over ? 'over' : ''}`} {...drop} role="button" tabIndex={0}
      onClick={() => input.current.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}>
      <span className="ft-drop-ico"><Icon name="camera" /></span>
      <p className="ft-drop-title">Сурати худро бор кунед</p>
      <p className="ft-drop-sub">Ин ҷо партоед ё пахш кунед (дар телефон — камера)</p>
      <ul className="ft-tips">
        {TIPS.map((t) => <li key={t}><Icon name="check" /> {t}</li>)}
      </ul>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
    </div>
  )
}

function Stage({ photoUrl, result, loading, onOutfitDrop, onReset, onRetry }) {
  const [before, setBefore] = useState(false)
  const [over, drop] = useDrop(onOutfitDrop)
  useEffect(() => setBefore(false), [result])
  const showResult = result && !before
  const shown = showResult ? imgUrl(result.image) : photoUrl

  return (
    <div>
      <div className={`ft-stage ${over ? 'over' : ''}`} {...drop}>
        <img key={shown} src={shown} alt={showResult ? 'Натиҷаи ороишгоҳ' : 'Сурати шумо'} className={showResult ? 'ft-reveal' : ''} />
        <span className="ft-stage-frame" aria-hidden="true" />
        {loading && (
          <div className="ft-stage-busy" role="status">
            <span className="ft-scan" aria-hidden="true" />
            <Icon name="sparkle" className="ft-busy-ico" />
            <p>Либос пӯшонда мешавад… (то 1 дақиқа)</p>
            <small>Лутфан саҳифаро напӯшед</small>
          </div>
        )}
        {over && !loading && <div className="ft-stage-hint"><span>Ин либосро интихоб кунед</span></div>}
        {result && !loading && (
          <div className="ft-toggle" role="group" aria-label="Муқоиса">
            {[[true, 'Пеш'], [false, 'Пас']].map(([b, label]) => (
              <button key={label} type="button" className={before === b ? 'on' : ''} onClick={() => setBefore(b)}>{label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="ft-stage-actions">
        <button type="button" className="btn btn-sm ft-btn-line" onClick={onReset} disabled={loading}><Icon name="camera" /> Сурати дигар</button>
        {result && !loading && (
          <>
            <a href={imgUrl(result.image)} download="tuyona-oroishgoh.jpg" className="btn btn-sm ft-btn-line"><Icon name="download" /> Боргирӣ</a>
            <button type="button" className="btn btn-sm ft-btn-line" onClick={onRetry}><Icon name="refresh" /> Боз кӯшиш</button>
          </>
        )}
      </div>
    </div>
  )
}

function OutfitCard({ l, selected, blocked, onSelect }) {
  return (
    <button type="button" draggable className={`ft-card ${selected ? 'on' : ''} ${blocked ? 'blocked' : ''}`}
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, String(l.id))} onClick={() => onSelect(l)} aria-pressed={selected}>
      {selected && <span className="ft-card-check"><Icon name="check" /></span>}
      <span className="ft-card-img"><img src={imgUrl(l.cover)} alt="" loading="lazy" /></span>
      <span className="ft-card-body">
        <b>{l.title}</b>
        <small>{l.category.name}</small>
        <Price value={l.price_from} unit={l.price_unit} />
      </span>
    </button>
  )
}

/** /oroishgoh — ороишгоҳи AI: либоси каталогро дар тани худ бинед */
export default function Fitting() {
  const { user } = useAuth()
  const toast = useToast()
  const catalog = useCatalog()
  const [photo, setPhoto] = useState(null)
  const [outfit, setOutfit] = useState(null)
  const [category, setCategory] = useState('')
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  // Мард ё зан дар сурат: AI муайян мекунад, корбар метавонад иваз кунад. Либоси занона ба мард пӯшонда намешавад ва баръакс.
  const [who, setWho] = useState(null) // { gender: 'male' | 'female' | null, confidence, byUser }
  const [detecting, setDetecting] = useState(false)
  const photoUrl = usePreview(photo)

  const service = useAsync(() => api.tryonStatus(), [])
  const outfits = useAsync(() => api.tryonOutfits(category, who?.gender || undefined), [category, who?.gender])
  const items = outfits.data || []
  const parts = service.data?.categories || {}
  const genders = service.data?.genders || {}
  const fits = (slug) => !who?.gender || !genders[slug] || genders[slug] === who.gender
  const supports = service.data?.supports || []
  const enabled = Boolean(service.data?.active)
  const catName = (slug) => catalog?.groups.flatMap((g) => g.categories).find((c) => c.slug === slug)?.name || slug
  const canWear = (l) => supports.includes(parts[l.category.slug])
  const unsupported = outfit && service.data && !canWear(outfit)
  const nav = useNavigate()

  // Стилисти AI: маслиҳат барои либоси интихобшуда (бо натиҷаи ороишгоҳ, агар бошад)
  const ai = useAsync(() => api.assistantStatus(), [])
  const [advice, setAdvice] = useState(null)
  const [advising, setAdvising] = useState(false)
  useEffect(() => setAdvice(null), [outfit?.id])
  const askStylist = async () => {
    setAdvising(true)
    try {
      const withResult = result?.outfit?.id === outfit.id ? result.image : null
      setAdvice({ ...(await api.tryonAdvice(outfit.id, photo, withResult)), withResult: Boolean(withResult) })
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setAdvising(false)
    }
  }

  // Ҷинс иваз шуд — либос ва категорияи номувофиқ интихоб намемонад
  useEffect(() => {
    if (outfit && !fits(outfit.category.slug)) setOutfit(null)
    if (category && !fits(category)) setCategory('')
  }, [who?.gender]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    // Тугма ҳамеша фаъол аст — агар чизе намерасад, мегӯем чӣ кор кардан лозим
    if (!user) {
      toast('Барои пӯшондани либос аввал ворид шавед', 'err')
      return nav('/login?next=/oroishgoh')
    }
    if (!photo) return toast('Аввал сурати худро бор кунед', 'err')
    if (!outfit) return toast('Либосро аз каталог интихоб кунед', 'err')
    if (detecting) return toast('AI суратро месанҷад, як лаҳза…', 'err')
    if (!who?.gender) return toast('Мард ё зан будани худро интихоб кунед', 'err')
    if (!fits(outfit.category.slug)) return toast(`Ин либос ${genders[outfit.category.slug] === 'male' ? 'мардона' : 'занона'} аст`, 'err')
    if (!enabled) return toast('Хизмати AI ҳоло кор намекунад. Баъдтар кӯшиш кунед.', 'err')
    if (unsupported) return toast('Ин либосро ҳоло пӯшонда наметавонем', 'err')
    setBusy(true)
    try {
      // 1) сервер санҷида тайёр мекунад; 2) браузер ба Leffa мефиристад (квотаи худи корбар); 3) сервер рӯйро барқарор мекунад.
      // Агар роҳи браузер нашуд — пӯшондан тавассути сервер (бо ҳамон токен, кӯшиш дубора ҳисоб намешавад).
      const prep = await api.tryonPrepare(photo, outfit.id, who.gender)
      let data
      try {
        const { leffaInBrowser } = await import('../tryonBrowser')
        data = await api.tryonFinish(photo, outfit.id, prep.token, await leffaInBrowser(prep))
      } catch (browserError) {
        if (browserError instanceof ApiError && browserError.status >= 400 && browserError.status < 500) throw browserError
        console.warn('Ороишгоҳ: роҳи браузер нашуд, тавассути сервер', browserError)
        data = await api.tryOn(photo, outfit.id, who.gender, prep.token)
      }
      const entry = { ...data, outfit }
      setResult(entry)
      setHistory((h) => [entry, ...h].slice(0, 8))
    } catch (e) {
      toast(e.message, 'err')
    } finally {
      setBusy(false)
    }
  }
  const choosePhoto = (file) => {
    setPhoto(file); setResult(null); setWho(null)
    if (!file) return
    setDetecting(true)
    api.tryonDetect(file)
      .then((r) => setWho({ gender: r.gender, confidence: r.confidence, byUser: false }))
      .catch(() => setWho({ gender: null, confidence: 0, byUser: false }))
      .finally(() => setDetecting(false))
  }
  const onOutfitDrop = (e) => {
    const item = items.find((l) => l.id === Number(e.dataTransfer.getData(DRAG_TYPE)))
    if (item) setOutfit(item)
  }

  const steps = [
    ['camera', 'Сурати худро бор кунед', Boolean(photo)],
    ['hanger', 'Либосро интихоб кунед', Boolean(outfit)],
    ['sparkle', '«Пӯшондан»-ро пахш кунед', Boolean(result)],
  ]

  return (
    <NightPage className="ft">
      <div className="container ft-wrap">
        <header className="hp-head ft-head">
          <span className="ft-seal" aria-hidden="true"><Icon name="sparkle" /></span>
          <p className="hp-kicker"><span aria-hidden="true" />Ороишгоҳ · AI<span aria-hidden="true" /></p>
          <h1>Либосро дар тани худ бинед</h1>
          <p className="hp-sub">Сурати худро бор кунед, либоси воқеиро аз каталог интихоб кунед — AI онро дар тани шумо мепӯшонад.</p>
        </header>

        <ol className="ft-steps">
          {steps.map(([icon, text, done], i) => (
            <li key={text} className={done ? 'done' : ''}>
              <span className="ft-step-ico"><Icon name={done ? 'check' : icon} /></span>
              <span><em>{i + 1}.</em> {text}</span>
            </li>
          ))}
        </ol>

        {!user && (
          <div className="ft-note">
            <Icon name="lock" className="ft-note-ico" />
            <p>Барои пӯшондани либос бо AI ворид шавед. Либосҳоро ҳоло ҳам дидан мумкин аст.</p>
            <Link to="/login?next=/oroishgoh" className="btn btn-gold btn-sm">Ворид</Link>
          </div>
        )}
        {service.data && !enabled && (
          <p className="ft-warn">Хизмати AI ҳоло кор намекунад. Либосҳоро дидан мумкин аст — пӯшонданро баъдтар кӯшиш кунед.</p>
        )}

        <div className="ft-grid">
          <section className="ft-left">
            {photoUrl
              ? <Stage photoUrl={photoUrl} result={result} loading={busy} onOutfitDrop={onOutfitDrop} onReset={() => choosePhoto(null)} onRetry={run} />
              : <PhotoDrop onFile={choosePhoto} onOutfitDrop={onOutfitDrop} />}

            {photo && (
              <div className="ft-gender" role="group" aria-label="Мард ё зан">
                <span className="ft-gender-label">
                  {detecting ? 'AI суратро месанҷад…'
                    : who?.byUser ? 'Шумо интихоб кардед:'
                    : who?.gender ? `AI муайян кард (${Math.round(who.confidence * 100)}%):`
                    : 'AI муайян карда натавонист — интихоб кунед:'}
                </span>
                {[['male', 'Мард'], ['female', 'Зан']].map(([g, label]) => (
                  <button key={g} type="button" className={`ft-chip ${who?.gender === g ? 'on' : ''}`} disabled={detecting}
                    aria-pressed={who?.gender === g} onClick={() => setWho({ gender: g, confidence: 1, byUser: true })}>{label}</button>
                ))}
              </div>
            )}
            <button type="button" className="btn btn-gold btn-lg btn-block ft-run" disabled={busy} onClick={run}>
              <Icon name="sparkle" /> {busy ? 'Интизор шавед… (то 1 дақиқа)' : !user ? 'Ворид шавед ва пӯшонед' : outfit ? `«${outfit.title}»-ро пӯшондан` : 'Пӯшондан'}
            </button>
            {unsupported && <p className="ft-warn ft-warn-sm">Ин либосро ҳоло пӯшонда наметавонем (хизмати AI ин навъи либосро дастгирӣ намекунад).</p>}
            {ai.data?.enabled && (
              <div className="ft-stylist">
                <button type="button" className="btn btn-sm ft-btn-line ft-stylist-btn" disabled={!outfit || advising} onClick={askStylist}>
                  <Icon name="sparkle" /> {advising ? 'Стилист фикр мекунад… (то 1 дақиқа)' : 'Маслиҳати стилисти AI'}
                </button>
                {!outfit && <small>Аввал либосро интихоб кунед{photo ? '' : '; бо сурати худ маслиҳат дақиқтар мешавад'}.</small>}
                {advice && (
                  <div className="ft-advice">
                    <p className="ft-advice-head"><Icon name="sparkle" /> Стилисти AI · {advice.withResult ? 'аз рӯи натиҷа' : photo ? 'аз рӯи сурати шумо' : 'бе сурат'}</p>
                    <div className="ft-advice-body"><Reply text={advice.advice} /></div>
                    {advice.listings.length > 0 && (
                      <div className="ft-advice-cards">
                        {advice.listings.map((l) => (
                          <button key={l.id} type="button" onClick={() => { const it = items.find((x) => x.id === l.id); if (it) setOutfit(it) }}>
                            <img src={imgUrl(l.cover)} alt="" loading="lazy" /><span><b>{l.title}</b><small>{l.price}</small></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="ft-privacy">
              <Icon name="shield" />
              Сурати шумо танҳо барои сохтани натиҷа ба хизмати AI фиристода мешавад ва дар сервери мо нигоҳ дошта намешавад.
            </p>

            {result?.outfit && (
              <Link to={`/listing/${result.outfit.id}`} className="ft-buy">
                <img src={imgUrl(result.outfit.cover)} alt="" />
                <span><b>{result.outfit.title}</b><Price value={result.outfit.price_from} unit={result.outfit.price_unit} /></span>
                <span className="btn btn-gold btn-sm">Брон</span>
              </Link>
            )}
          </section>

          <section className="ft-right">
            <div className="ft-right-head">
              <h2>Либосҳои каталог</h2>
              <span>{items.length} либос</span>
            </div>
            <Ornament className="ft-orn" />

            <div className="ft-chips">
              {[['', who?.gender === 'male' ? 'Ҳамаи мардона' : who?.gender === 'female' ? 'Ҳамаи занона' : 'Ҳама'],
                ...Object.keys(parts).filter(fits).map((s) => [s, catName(s)])].map(([value, label]) => (
                <button key={value} type="button" className={`ft-chip ${category === value ? 'on' : ''}`} onClick={() => setCategory(value)}>{label}</button>
              ))}
            </div>
            <p className="ft-hint"><Icon name="move" /> Либосро пахш кунед ё ба сурати худ кашида партоед.</p>

            {outfits.loading ? <Spinner /> : items.length ? (
              <div className="ft-cards">
                {items.map((l) => (
                  <OutfitCard key={l.id} l={l} selected={outfit?.id === l.id} blocked={service.data && !canWear(l)} onSelect={setOutfit} />
                ))}
              </div>
            ) : (
              <div className="ft-empty">
                <Icon name="hanger" className="ft-empty-ico" />
                <p>Ҳоло дар ин категория либос бо сурат нест.</p>
                <Link to="/register?role=vendor" className="link">Либоси худро ҷойгир кунед →</Link>
              </div>
            )}

            {history.length > 0 && (
              <div className="ft-history">
                <h3>Кӯшишҳои шумо</h3>
                <div>
                  {history.map((h) => (
                    <button key={h.image} type="button" className={result?.image === h.image ? 'on' : ''} onClick={() => setResult(h)} title={h.outfit.title}>
                      <img src={imgUrl(h.image)} alt={h.outfit.title} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </NightPage>
  )
}
