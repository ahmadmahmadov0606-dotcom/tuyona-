// Муштарии API: ҳамаи дархостҳо ба FastAPI аз ин ҷо мегузаранд.
const BASE = import.meta.env.VITE_API_URL || ''
const TOKEN_KEY = 'tuyona_token'

export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY) } catch { return null } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t) } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ } },
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function errorMessage(status, body) {
  const d = body?.detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length) {
    // Хатоҳои санҷиши Pydantic (422)
    return d.map((e) => {
      const field = e.loc?.[e.loc.length - 1]
      const msg = (e.msg || '').replace(/^Value error, /, '')
      return field && typeof field === 'string' ? `${FIELD_NAMES[field] || field}: ${msg}` : msg
    }).join('; ')
  }
  if (status >= 500) return 'Хатои сервер. Лутфан баъдтар кӯшиш кунед.'
  return 'Хатое рух дод'
}

const FIELD_NAMES = {
  email: 'Email', phone: 'Телефон', contact_phone: 'Телефон', password: 'Парол', full_name: 'Ном',
  title: 'Сарлавҳа', price_from: 'Нарх', event_date: 'Сана', guests: 'Меҳмонон',
  capacity: 'Ғунҷоиш', description: 'Тавсиф',
  cars: 'Мошинҳо', start_time: 'Вақт', pickup_address: 'Суроға', note: 'Изҳорот',
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn }

export async function request(path, { method = 'GET', body, params, form } = {}) {
  let url = `${BASE}/api${path}`
  if (params) {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v)
    })
    const s = qs.toString()
    if (s) url += `?${s}`
  }
  const headers = {}
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload
  if (form) payload = form
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res
  try {
    res = await fetch(url, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Пайваст ба сервер нашуд. Интернетро санҷед.')
  }
  if (res.status === 204) return null
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized()
    throw new ApiError(res.status, errorMessage(res.status, data))
  }
  return data
}

/** Ҷавоби ҷараёнии ёрдамчӣ (NDJSON): onDelta(матн) барои ҳар пора; дар охир { listings } */
async function streamAssistant(messages, onDelta) {
  const headers = { 'Content-Type': 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(`${BASE}/api/assistant/stream`, { method: 'POST', headers, body: JSON.stringify({ messages }) })
  } catch {
    throw new ApiError(0, 'Пайваст ба сервер нашуд. Интернетро санҷед.')
  }
  if (!res.ok || !res.body) {
    let data = null
    try { data = await res.json() } catch { /* empty body */ }
    throw new ApiError(res.status, errorMessage(res.status, data))
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let done = null
  const handle = (line) => {
    if (!line.trim()) return
    const e = JSON.parse(line)
    if (e.error) throw new ApiError(503, e.error)
    if (e.delta) onDelta(e.delta)
    if (e.done) done = e
  }
  for (;;) {
    const { value, done: end } = await reader.read()
    if (end) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop()
    lines.forEach(handle)
  }
  handle(buf)
  if (!done) throw new ApiError(0, 'Пайваст қатъ шуд. Боз кӯшиш кунед.')
  return done
}

export const api = {
  // auth
  register: (b) => request('/auth/register', { method: 'POST', body: b }),
  login: (b) => request('/auth/login', { method: 'POST', body: b }),
  googleLogin: (b) => request('/auth/google', { method: 'POST', body: b }),
  authConfig: () => request('/auth/config'),
  me: () => request('/auth/me'),
  updateMe: (b) => request('/auth/me', { method: 'PATCH', body: b }),
  // catalog
  categories: () => request('/categories'),
  cities: () => request('/cities'),
  // listings
  search: (params) => request('/listings', { params }),
  listing: (id) => request(`/listings/${id}`),
  createListing: (b) => request('/listings', { method: 'POST', body: b }),
  updateListing: (id, b) => request(`/listings/${id}`, { method: 'PATCH', body: b }),
  deleteListing: (id) => request(`/listings/${id}`, { method: 'DELETE' }),
  uploadImages: (id, files) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    return request(`/listings/${id}/images`, { method: 'POST', form: fd })
  },
  deleteImage: (id, imgId) => request(`/listings/${id}/images/${imgId}`, { method: 'DELETE' }),
  availability: (id, month) => request(`/listings/${id}/availability`, { params: { month } }),
  blockDays: (id, days) => request(`/listings/${id}/blocked`, { method: 'POST', body: { days } }),
  unblockDays: (id, days) => request(`/listings/${id}/blocked`, { method: 'DELETE', body: { days } }),
  reviews: (id) => request(`/listings/${id}/reviews`),
  addReview: (id, b) => request(`/listings/${id}/reviews`, { method: 'POST', body: b }),
  favorite: (id, on) => request(`/listings/${id}/favorite`, { method: on ? 'POST' : 'DELETE' }),
  // bookings
  book: (b) => request('/bookings', { method: 'POST', body: b }),
  myBookings: () => request('/bookings/my'),
  incoming: (status) => request('/bookings/incoming', { params: { status } }),
  setBookingStatus: (id, status) => request(`/bookings/${id}/status`, { method: 'PATCH', body: { status } }),
  // me
  favorites: () => request('/me/favorites'),
  vendorListings: () => request('/vendor/listings'),
  vendorStats: () => request('/vendor/stats'),
  // фармоиши мошинҳо (галереяи «Мошинҳои бартар»)
  carOrder: (b) => request('/car-orders', { method: 'POST', body: b }),
  myCarOrders: () => request('/car-orders/my'),
  cancelCarOrder: (id) => request(`/car-orders/${id}/cancel`, { method: 'PATCH' }),
  // ёрдамчии AI (Claude)
  assistantStatus: () => request('/assistant/status'),
  assistantAsk: (messages) => request('/assistant', { method: 'POST', body: { messages } }),
  assistantStream: streamAssistant,
  // ороишгоҳи AI
  tryonStatus: () => request('/tryon/status'),
  tryonOutfits: (category, gender) => request('/tryon/outfits', { params: { category, gender } }),
  tryonDetect: (photo) => {
    const fd = new FormData()
    fd.append('photo', photo)
    return request('/tryon/detect', { method: 'POST', form: fd })
  },
  tryonAdvice: (listingId, photo, result) => {
    const fd = new FormData()
    fd.append('listing_id', listingId)
    if (result) fd.append('result', result)
    else if (photo) fd.append('photo', photo)
    return request('/tryon/advice', { method: 'POST', form: fd })
  },
  tryOn: (photo, listingId, gender) => {
    const fd = new FormData()
    fd.append('photo', photo)
    fd.append('listing_id', listingId)
    if (gender) fd.append('gender', gender)
    return request('/tryon', { method: 'POST', form: fd })
  },
  // admin
  adminStats: () => request('/admin/stats'),
  adminUsers: (params) => request('/admin/users', { params }),
  adminSetUserActive: (id, active) => request(`/admin/users/${id}/active`, { method: 'PATCH', params: { active } }),
  adminListings: (params) => request('/admin/listings', { params }),
  adminCarOrders: (params) => request('/admin/car-orders', { params }),
  adminSetCarOrderStatus: (id, status) => request(`/admin/car-orders/${id}/status`, { method: 'PATCH', body: { status } }),
  adminSetListingActive: (id, active) => request(`/admin/listings/${id}/active`, { method: 'PATCH', params: { active } }),
}
