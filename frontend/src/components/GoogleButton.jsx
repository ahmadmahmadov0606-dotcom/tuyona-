import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox } from './ui'

const GIS_SRC = 'https://accounts.google.com/gsi/client'
let gisPromise = null

// Скрипти Google Identity Services як бор бор мешавад
function loadGis() {
  if (window.google?.accounts?.id) return Promise.resolve()
  gisPromise ||= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = resolve
    s.onerror = () => { gisPromise = null; reject(new Error('Google дастрас нест. Интернетро санҷед.')) }
    document.head.appendChild(s)
  })
  return gisPromise
}

/** «Бо Google ворид шудан». Танҳо агар дар сервер GOOGLE_CLIENT_ID бошад; role — барои ҳисоби нав. */
export default function GoogleButton({ role = 'client', onDone }) {
  const { googleLogin } = useAuth()
  const box = useRef(null)
  const [clientId, setClientId] = useState(null)
  const [err, setErr] = useState(null)
  // Callback-и Google як бор сабт мешавад — нақш ва onDone-и охиринро аз ref мегирем
  const latest = useRef({ role, onDone })
  latest.current = { role, onDone }

  useEffect(() => { api.authConfig().then((c) => setClientId(c.google_client_id)).catch(() => {}) }, [])

  useEffect(() => {
    if (!clientId) return
    let alive = true
    loadGis().then(() => {
      if (!alive || !box.current) return
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setErr(null)
          try {
            const user = await googleLogin(credential, latest.current.role)
            latest.current.onDone?.(user)
          } catch (e) { setErr(e) }
        },
      })
      window.google.accounts.id.renderButton(box.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'ru',
        width: Math.min(400, box.current.offsetWidth || 320),
      })
    }).catch(setErr)
    return () => { alive = false }
  }, [clientId, googleLogin])

  if (!clientId) return null
  return (
    <>
      <div className="auth-or"><span>ё</span></div>
      <div ref={box} className="google-btn" />
      <ErrorBox error={err} />
    </>
  )
}
