// Муаллифон ва иҷозатномаҳои аксҳои категорияҳо (Wikimedia Commons). Ниг. public/categories/CREDITS.md
export const CATEGORY_CREDITS = [
  {
    "slug": "venue",
    "category": "Ҷой",
    "title": "Dushanbe, Tajikistan - panoramio (60).jpg",
    "author": "Hansjoerg Eberle",
    "license": "CC BY 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
    "page": "https://commons.wikimedia.org/wiki/File:Dushanbe,_Tajikistan_-_panoramio_(60).jpg"
  },
  {
    "slug": "bride",
    "category": "Арӯс",
    "title": "Tajik wedding ceremony (bride).jpg",
    "author": "Ilhoms",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Tajik_wedding_ceremony_(bride).jpg"
  },
  {
    "slug": "groom",
    "category": "Домод",
    "title": "Свадебные наряды таджиков.jpg",
    "author": "Шухрат Саъдиев",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:%D0%A1%D0%B2%D0%B0%D0%B4%D0%B5%D0%B1%D0%BD%D1%8B%D0%B5_%D0%BD%D0%B0%D1%80%D1%8F%D0%B4%D1%8B_%D1%82%D0%B0%D0%B4%D0%B6%D0%B8%D0%BA%D0%BE%D0%B2.jpg"
  },
  {
    "slug": "program",
    "category": "Барнома",
    "title": "Wedding ceremonies in Tajikistan 06.jpg",
    "author": "Шухрат Саъдиев",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Wedding_ceremonies_in_Tajikistan_06.jpg"
  },
  {
    "slug": "media",
    "category": "Сурат ва видео",
    "title": "Wedding ceremonies in Tajikistan 05.jpg",
    "author": "Шухрат Саъдиев",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Wedding_ceremonies_in_Tajikistan_05.jpg"
  },
  {
    "slug": "food",
    "category": "Хӯрок",
    "title": "Oshi palov tajik.jpg",
    "author": "Ibrahimjon",
    "license": "CC BY 2.5",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.5",
    "page": "https://commons.wikimedia.org/wiki/File:Oshi_palov_tajik.jpg"
  },
  {
    "slug": "decor",
    "category": "Ороиш",
    "title": "Wedding ceremonies in Tajikistan 10.jpg",
    "author": "Шухрат Саъдиев",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Wedding_ceremonies_in_Tajikistan_10.jpg"
  },
  {
    "slug": "dowry",
    "category": "Ҷаҳиз ва тӯҳфа",
    "title": "Suzane in Tajikistan.jpg",
    "author": "Ilhoms",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:Suzane_in_Tajikistan.jpg"
  },
  {
    "slug": "other",
    "category": "Дигар",
    "title": "Ресторан \"Шохсарой\" в г. Душанбе 9.jpg",
    "author": "Шухрат Саъдиев",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
    "page": "https://commons.wikimedia.org/wiki/File:%D0%A0%D0%B5%D1%81%D1%82%D0%BE%D1%80%D0%B0%D0%BD_%22%D0%A8%D0%BE%D1%85%D1%81%D0%B0%D1%80%D0%BE%D0%B9%22_%D0%B2_%D0%B3._%D0%94%D1%83%D1%88%D0%B0%D0%BD%D0%B1%D0%B5_9.jpg"
  }
]

export const creditFor = (slug) => CATEGORY_CREDITS.find((c) => c.slug === slug)
