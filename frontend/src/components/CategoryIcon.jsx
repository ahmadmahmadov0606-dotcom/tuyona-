import './CategoryIcon.css'

// Нишонаҳои тиллоии line-art барои гурӯҳҳои хизмат (бар ивази emoji).
// pathLength="1" — то CSS хатро «кашида» тавонад (stroke-dashoffset 1 → 0).
const ICONS = {
  // Ҷой — сутунҳо ва толор
  venue: <><path pathLength="1" d="M3 9l9-5 9 5" /><path pathLength="1" d="M4 9h16" /><path pathLength="1" d="M6 9v9M10 9v9M14 9v9M18 9v9" /><path pathLength="1" d="M4 18h16M3 20.5h18" /></>,
  // Нақлиёт — силуэти мошин
  transport: <><path pathLength="1" d="M3 16v-3.5l2.2-4.6A2 2 0 0 1 7 7h10a2 2 0 0 1 1.8 1.1L21 12.5V16" /><path pathLength="1" d="M2.5 16h19M5.5 12h13" /><circle pathLength="1" cx="7.5" cy="17" r="1.8" /><circle pathLength="1" cx="16.5" cy="17" r="1.8" /></>,
  // Арӯс — либос ва парда
  bride: <><path pathLength="1" d="M9.5 3h5l-1 4.5 4.5 13h-12l4.5-13z" /><path pathLength="1" d="M10.2 7.5h3.6" /><path pathLength="1" d="M12 3c-4.5 2-6.5 6.5-6.5 12" /></>,
  // Домод — галстуки камон
  groom: <><path pathLength="1" d="M10.5 12L4 8.5v7z" /><path pathLength="1" d="M13.5 12L20 8.5v7z" /><rect pathLength="1" x="10.5" y="10.5" width="3" height="3" rx=".8" /><path pathLength="1" d="M8.5 4.5L12 7l3.5-2.5" /></>,
  // Барнома — микрофон
  program: <><path pathLength="1" d="M9 3.5h6V12a3 3 0 0 1-6 0z" /><path pathLength="1" d="M6 11.5a6 6 0 0 0 12 0" /><path pathLength="1" d="M12 17.5v3M9 20.5h6" /></>,
  // Сурат ва видео — диафрагмаи камера
  media: <><circle pathLength="1" cx="12" cy="12" r="9" /><path pathLength="1" d="M14.3 8l5.7 9.9M9.7 8h11.5M7.4 12l5.7-9.9M9.7 16L4 6.1M14.3 16H2.8M16.6 12l-5.7 9.9" /></>,
  // Хӯрок — сарпӯши табақ
  food: <><path pathLength="1" d="M4.5 16.5a7.5 7.5 0 0 1 15 0" /><path pathLength="1" d="M3 16.5h18M4 19.5h16" /><path pathLength="1" d="M12 9V6.5M10.5 6.5h3" /></>,
  // Ороиш — гул
  decor: <><circle pathLength="1" cx="12" cy="5.6" r="2.3" /><circle pathLength="1" cx="15.4" cy="9" r="2.3" /><circle pathLength="1" cx="12" cy="12.4" r="2.3" /><circle pathLength="1" cx="8.6" cy="9" r="2.3" /><path pathLength="1" d="M12 14.7v6.8M12 18c-2-2-4-2.2-5.2-1.2 1.2 2 3.2 2.2 5.2 1.2zM12 17c2-2 4-2.2 5.2-1.2-1.2 2-3.2 2.2-5.2 1.2z" /></>,
  // Дигар — лифофа бо мӯҳр
  other: <><path pathLength="1" d="M3 6h18v12H3z" /><path pathLength="1" d="M3 6l9 7 9-7" /><circle pathLength="1" cx="12" cy="14.5" r="2.2" /></>,
  // Ҳамаи хизматҳо — ду ангуштарин
  all: <><circle pathLength="1" cx="9.5" cy="13" r="5.5" /><circle pathLength="1" cx="14.5" cy="13" r="5.5" /><path pathLength="1" d="M10.5 7.5l1.5-2.5 1.5 2.5" /></>,
}

export default function CategoryIcon({ slug, className = '' }) {
  return <svg className={`cat-ico ${className}`} viewBox="0 0 24 24" aria-hidden="true">{ICONS[slug] || ICONS.all}</svg>
}
