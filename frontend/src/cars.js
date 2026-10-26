// Аксҳо: public/cars/optimized/car-XX-{600,1200}.webp (аз scripts/optimize-cars.mjs).
// area — ҷойи корт дар шабакаи bento (desktop), pos — object-position, то мошин дар марказ бошад;
// focus — (ихтиёрӣ) object-position барои корти калони шоурум, агар аз pos фарқ кунад.
export const CARS = [
  { id: '01', name: 'BMW 7 Series', note: 'Шаб, Душанбе', plates: ['1111 WU 10'], area: 'a', pos: '50% 62%' },
  { id: '02', name: 'BMW 7 Series', note: 'Нақби чароғҳо', plates: [], area: 'b', pos: '50% 60%' },
  { id: '03', name: 'Mercedes-Maybach S-Class', plates: ['9070 WQ 01'], area: 'c', pos: '50% 72%' },
  { id: '04', name: 'BMW 7 Series', plates: ['9000 NN 07'], area: 'd', pos: '45% 30%', focus: '60% 42%' },
  { id: '05', name: 'Rolls-Royce Phantom', plates: ['9999 RF 01'], area: 'e', pos: '40% 45%' },
  { id: '06', name: 'Rolls-Royce Ghost Black Badge', plates: ['2026 AA 10'], area: 'f', pos: '55% 62%' },
  { id: '07', name: 'Toyota Land Cruiser 300', note: 'Ғуруб дар кӯҳҳо', plates: ['0101 BJ 01'], area: 'g', pos: '50% 60%' },
  { id: '08', name: 'Mercedes-Benz S-Class', plates: ['2222 NN 10'], area: 'h', pos: '45% 62%' },
  { id: '09', name: 'Range Rover Sport', plates: ['1000 CJ 10'], area: 'i', pos: '50% 70%' },
  { id: '10', name: 'Lexus LX ва Cadillac Escalade', plates: ['0100 DD 10', '0777 DD 07'], area: 'j', pos: '50% 60%' },
  { id: '11', name: 'Toyota Camry', note: 'Шаб, нуқтаи сӯзишворӣ', plates: ['0010 CN 01'], area: 'k', pos: '50% 75%' },
]

export const carSrc = (id, w) => `/cars/optimized/car-${id}-${w}.webp`
export const carById = (id) => CARS.find((c) => c.id === id)
// Тибқи Қонуни ҶТ №2048, моддаи 12: корвони тӯй — на бештар аз 4 мошин
export const MAX_CARS = 4
