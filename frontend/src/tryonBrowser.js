// Пӯшондани либос бевосита аз браузер ба Leffa (Hugging Face).
// Квотаи ройгони GPU ба IP-и ҳар корбар ҳисоб мешавад — на ба IP-и сервер, ки барои ҳама як аст.
// @gradio/client танҳо дар ҳамин ҷо бор мешавад (чанки алоҳида), на дар ҳамаи саҳифаҳо.

const TIMEOUT_MS = 150_000

const blob = (b64) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' })

/** prep — ҷавоби /api/tryon/prepare. Blob-и натиҷа (3:4) ё хато бармегардонад. */
export async function leffaInBrowser(prep) {
  const { Client } = await import('@gradio/client')
  const client = await Client.connect(prep.space)
  const job = client.predict('/leffa_predict_vt', [
    blob(prep.person), blob(prep.garment),
    false, // ref_acceleration
    30, // қадамҳо (ҳадди ақали Leffa)
    2.5, // guidance scale
    42, // seed-и собит
    prep.model, prep.garment_type,
    false, // repaint
  ])
  let timer
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Leffa timeout')), TIMEOUT_MS) })
  try {
    const result = await Promise.race([job, timeout])
    const url = result?.data?.[0]?.url
    if (!url) throw new Error('Leffa: натиҷа нест')
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Leffa: ${res.status}`)
    return await res.blob()
  } finally {
    clearTimeout(timer)
  }
}
