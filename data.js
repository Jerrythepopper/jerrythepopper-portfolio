/* Photography data — references to local photo files. */
(function () {
  const range = (prefix, n) => Array.from({ length: n }, (_, i) => `photos/${prefix}_${i}.jpg`);

  window.PHOTOS = {
    hasselblad: range('hb', 25),
    portraits:  range('pt', 25),
    street:     range('st', 25),
    three_d:    range('td', 25),
    film:       range('fm', 25),
    market:     range('mk', 25),
    rotation:   range('rot', 8),
  };

  // Hero carousel — curated mix
  window.HERO_SLIDES = [
    'photos/hb_0.jpg',
    'photos/pt_0.jpg',
    'photos/mk_0.jpg',
    'photos/st_4.jpg',
    'photos/fm_2.jpg',
    'photos/hb_7.jpg',
    'photos/pt_5.jpg',
    'photos/td_0.jpg',
  ];

  // Section meta — drives the homepage scroll-stack AND the subpages
  window.SECTIONS = [
    {
      id: 'hasselblad', hash: '#/hasselblad',
      en: 'Hasselblad', zh: '哈蘇',
      eyebrow: 'Series · 001',
      number: '01',
      lede: '這兩次與哈蘇合作，我想挑戰更多可能。',
      subtitle: '這兩次與哈蘇合作，我想挑戰更多可能\n\n當我拿到哈蘇相機時，並不想只用它來做一件事，而是想看看它能如何回應不同的拍攝主題。這次的創作，涵蓋了人像、街景、風景，以及一些更個人、更私密的視角。\n\n每一種題材，都讓我重新理解這台相機的語言，它的細節，它的動態範圍，它如何詮釋光影，以及它如何影響我的觀看方式。',
      meta: ['X2Dii 45mm, 35-100mm', 'Taiwan'],
      coverIdx: 2, layout: 'single',
    },
    {
      id: 'portraits', hash: '#/portraits',
      en: 'Portraits', zh: '人像',
      eyebrow: 'Series · 002',
      number: '02',
      lede: 'A study of presence — natural light, slow rapport.',
      subtitle: '',
      meta: ['Natural light', '2018 — 2026'],
      coverIdx: 3, layout: 'masonry',
    },
    {
      id: 'street', hash: '#/street',
      en: 'Street', zh: '街拍',
      eyebrow: 'Series · 003',
      number: '03',
      lede: 'Found light, the inhale before things happen.',
      subtitle: '',
      meta: ['Available light', '2018 — 2026'],
      coverIdx: 0, layout: 'masonry',
    },
    {
      id: '3d', hash: '#/3d',
      en: '3D', zh: '立體',
      eyebrow: 'Series · 004',
      number: '04',
      lede: 'CGI hybrid pieces — captured photograph meets rendered scene.',
      subtitle: 'CGI hybrid pieces — exploring the boundary between captured photograph and rendered scene.\n3D作品，探索攝影跟3D的邊界。',
      meta: ['Blender', 'Mixed media'],
      coverIdx: 1, layout: 'single',
    },
    {
      id: 'film', hash: '#/film',
      en: 'Film', zh: '底片',
      eyebrow: 'Series · 005',
      number: '05',
      lede: 'The slower medium — scanned from negatives, 2022–2026.',
      subtitle: '35mm contact sheets — the slower medium, scanned and selected from negatives shot 2022 — 2026.',
      meta: ['135 format and 120 format'],
      coverIdx: 4, layout: 'masonry',
    },
    {
      id: 'market', hash: '#/market',
      en: 'Taipei Wholesale Market', zh: '果菜市場',
      eyebrow: 'Series · 007',
      number: '06',
      lede: '輪轉（liàn-tńg）— 台北第一果菜批發市場紀實計畫。',
      subtitle: '輪轉一詞，取自於台語的「輪轉」（liàn-tńg）。一是認為，輪子在第一果菜批發市場擔任要角，舉凡當地會出現的大貨車、小貨車、人力拖車、電動拖車以及摩托車無不需要它的存在，彷彿它在某層面上也構成了此處。二是，輪子的轉圈就如同果菜市場般，日復一日地轉動著、運行著。最後，在果菜市場的人們不論聊天、買／賣菜、拍賣、廣播都是說著流利的台語，而「輪轉」（liàn-tńg）即為「流利」的意思。\n\n這計畫致力於將果菜市場內的點點滴滴記錄下來，並希希望觀看的人能初步了解這地方，理解這裡的人們、文化、建築，畢竟此處即將改建。再來，我也希望觀者能透過我的眼睛、作品，看到我在此處查覺的議題。並透過我微薄的能力、匪淺知識觀察到的議題，透過照片，表達給觀眾。或是拋磚引玉，引起更有能力的人再更深心地探討這些蘊藏在其中的議題。',
      meta: ['Documentary', 'Available light', '2018 — 2020'],
      coverIdx: 0, layout: 'masonry',
    },
  ];
})();
