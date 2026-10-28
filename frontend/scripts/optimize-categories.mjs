// Як бор иҷро мешавад: public/categories/<ном>.jpg → public/categories/optimized/<slug>-{600,1200}.webp
// ва src/components/categoryPhotos.gen.js (рӯйхати аксҳои мавҷуда — то браузер ба файлҳои набуда дархост нафиристад).
// Иҷро: npm i --no-save sharp && node scripts/optimize-categories.mjs
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const SRC = path.resolve('public/categories')
const OUT = path.join(SRC, 'optimized')
const GEN = path.resolve('src/components/categoryPhotos.gen.js')
// номи файл → slug-и гурӯҳ дар база
const FILES = {
  venue: 'venue', transport: 'transport', bride: 'bride', groom: 'groom', program: 'program',
  photo: 'media', food: 'food', decor: 'decor', other: 'other',
}

await mkdir(OUT, { recursive: true })
const done = []
for (const [file, slug] of Object.entries(FILES)) {
  const src = ['jpg', 'jpeg', 'png', 'webp'].map((e) => path.join(SRC, `${file}.${e}`)).find(existsSync)
  if (!src) { console.log(`— ${file}: нест (градиент нишон дода мешавад)`); continue }
  for (const w of [600, 1200]) {
    await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 75 }).toFile(path.join(OUT, `${slug}-${w}.webp`))
  }
  done.push(slug)
  console.log(`✓ ${file} → ${slug}`)
}
await writeFile(GEN, `// Худкор аз scripts/optimize-categories.mjs сохта мешавад — дастӣ тағйир надиҳед.\nexport default ${JSON.stringify(done)}\n`)
console.log(`\n${done.length} акс тайёр; рӯйхат: ${path.relative(process.cwd(), GEN)}`)
