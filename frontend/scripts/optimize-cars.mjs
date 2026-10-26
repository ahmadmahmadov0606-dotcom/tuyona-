// Як бор иҷро мешавад: аксҳои public/cars/car-XX.png → public/cars/optimized/car-XX-{600,1200}.webp
// Ҳошияҳои скриншот (хокистарии #1f1f1f, навори торики поён, навори сиёҳ) бурида мешаванд.
// Иҷро: npm i --no-save sharp && node scripts/optimize-cars.mjs
import { mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = path.resolve('public/cars')
const OUT = path.join(SRC, 'optimized')
// Ранги ҳошияҳо: хокистарии скриншот, навори торики поёни телефон, навори сиёҳ
const BARS = [[31, 31, 31], [11, 16, 20], [0, 0, 0]]
const TOL = 14 // фарқи иҷозатдодашуда аз ранги ҳошия
const SHARE = 0.97 // хат ҳошия ҳисоб мешавад, агар 97% пикселҳояш ранги ҳошия бошанд
const WIDTHS = [600, 1200]

// Ҳар сатр/сутунро аз канорҳо тафтиш мекунем ва ҳошияҳоро то расми аслӣ мебурем.
// (sharp.trim() як рамкаи умумӣ меҷӯяд ва як пиксели бегона онро мешиканад.)
async function trimBars(input) {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info
  const isBar = (i) => BARS.some((c) => Math.abs(data[i] - c[0]) <= TOL && Math.abs(data[i + 1] - c[1]) <= TOL && Math.abs(data[i + 2] - c[2]) <= TOL)
  const lineIsBar = (x0, y0, dx, dy, n) => {
    let hits = 0
    for (let k = 0; k < n; k++) if (isBar(((y0 + dy * k) * W + (x0 + dx * k)) * C)) hits++
    return hits / n >= SHARE
  }
  let top = 0, bottom = H - 1, left = 0, right = W - 1
  let changed = true
  while (changed && right - left > 50 && bottom - top > 50) {
    changed = false
    const w = right - left + 1, h = bottom - top + 1
    if (lineIsBar(left, top, 1, 0, w)) { top++; changed = true }
    if (lineIsBar(left, bottom, 1, 0, w)) { bottom--; changed = true }
    if (lineIsBar(left, top, 0, 1, h)) { left++; changed = true }
    if (lineIsBar(right, top, 0, 1, h)) { right--; changed = true }
  }
  // 2px бехатарӣ, то хати нимшаффофи канор намонад
  const pad = 2
  return sharp(input).extract({ left: left + pad, top: top + pad, width: right - left + 1 - pad * 2, height: bottom - top + 1 - pad * 2 }).toBuffer()
}

await mkdir(OUT, { recursive: true })
const files = (await readdir(SRC)).filter((f) => /^car-\d+\.(png|jpe?g)$/i.test(f)).sort()
for (const f of files) {
  const name = f.replace(/\.\w+$/, '')
  const trimmed = await trimBars(path.join(SRC, f))
  const meta = await sharp(trimmed).metadata()
  for (const w of WIDTHS) {
    await sharp(trimmed).resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(OUT, `${name}-${w}.webp`))
  }
  console.log(`${f}: ${meta.width}×${meta.height}`)
}
