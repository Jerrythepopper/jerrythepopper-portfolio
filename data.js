/* Photography data — references to local photo files. */
(function () {
  const range = (prefix, n, ext = 'jpg') => Array.from({ length: n }, (_, i) => `photos/${prefix}_${i}.${ext}`);

  window.PHOTOS = {
    hasselblad: range('hb', 48, 'webp'),
    portraits:  range('pt', 28, 'webp'),
    street:     range('st', 22, 'webp'),
    nature:     range('na', 26, 'webp'),
    three_d:    range('td', 62, 'webp'),
    film:       range('fm', 30, 'webp'),
    market:     range('mk', 17, 'webp'),
  };

  // Hero carousel — 每個系列各出一張「站主自排的第一張」（sort-studio 的 order.json 首位
  // ＝站主心中該系列的門面），末位補哈蘇第二張湊滿 8 格。
  // 2026-08-09 起 hero 改放雲影片（見下方 HERO_VIDEOS），這份名單不再渲染成輪播；
  // 保留下來的用途：首頁 og:image 仍取 HERO_SLIDES[0]，另備日後版位取用。
  window.HERO_SLIDES = [
    'photos/hb_0.webp',
    'photos/pt_0.webp',
    'photos/st_0.webp',
    'photos/td_0.webp',
    'photos/fm_0.webp',
    'photos/mk_0.webp',
    'photos/na_0.webp',
    'photos/hb_1.webp',
  ];

  // Hero 雲影片 —— 首頁 hero 背景（2026-08-09 起取代照片輪播）
  // 母帶在 網站照片\影片\（唯讀，不進版控），轉檔產物在 video\。
  // 順序＝站主指定（2026-08-09 裁定）：積雲那支打頭陣，首次來訪就是它；
  // 其餘兩支照檔名序跟在後面。陣列順序即輪值順序，cloud-N 編號與它一致。
  //   cloud-1 ← 20260807 13.mov  18.5s  積雲（首次來訪播這支）
  //   cloud-2 ← 20260728 14.mov  10.5s  夕照海面碎光
  //   cloud-3 ← 20260728 8.mov   12.5s  黃昏海面與小船
  // 輪播方式＝每次來訪輪值一支（localStorage heroVidIdx 遞增），支與支之間無轉場；
  // 循環接點吃 <video loop> 的原生硬回切，不做融接。
  // poster 給的是「不含副檔名的基底」，實際檔案是 <base>.avif|.webp 與 <base>@960.avif|.webp。
  // 註：08-09 指定新順序時，實體檔已一併改名（原 cloud-1↔cloud-3 對調），所以這裡照
  // cloud-1→2→3 自然排列就是站主要的播放序，不要再把陣列倒過來寫——那會跟改名相消，
  // 首播變回小船那支（實測過）。要換順序請改檔名或整組一起動，並重跑輪值驗收。
  window.HERO_VIDEOS = [
    { id: 'cloud-1', mp4: 'video/cloud-1.mp4', mp4_720: 'video/cloud-1@720.mp4', poster: 'photos/hero-poster-1' },
    { id: 'cloud-2', mp4: 'video/cloud-2.mp4', mp4_720: 'video/cloud-2@720.mp4', poster: 'photos/hero-poster-2' },
    { id: 'cloud-3', mp4: 'video/cloud-3.mp4', mp4_720: 'video/cloud-3@720.mp4', poster: 'photos/hero-poster-3' },
  ];

  // Deep Zoom — 系列 → 哪幾張掛得起「鑽細節」的切片（node make-deepzoom.js 產出）
  // idx = 該系列 PHOTOS 陣列的索引；dzi = photos\dz\ 下的 .dzi 路徑（相對站根）
  // 2026-08-09 起是真原檔：哈蘇 48 張裡長邊最大者（一億畫素機身，42 張長邊 ≥8000）。
  // 初版三張（idx 1/4/6）之後同日站主親選再加六張擴編到九張（idx 3/10/13/23/34/36），
  // 再擴編十張到二十張（idx 0/8/14/15/17/18/20/24/38/43，站主逐張親審定案）。
  // 切片名 hbNN 的 NN 就是 idx，日後要加片只要照這個對應加就好。
  window.DEEPZOOM = {
    hasselblad: [
      { idx: 0, dzi: 'photos/dz/hb00.dzi', label: 'Deep Zoom · 8686 × 11581' },
      { idx: 1, dzi: 'photos/dz/hb01.dzi', label: 'Deep Zoom · 8619 × 19242' },
      { idx: 3, dzi: 'photos/dz/hb03.dzi', label: 'Deep Zoom · 7850 × 10467' },
      { idx: 4, dzi: 'photos/dz/hb04.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 6, dzi: 'photos/dz/hb06.dzi', label: 'Deep Zoom · 11656 × 8742' },
      { idx: 8, dzi: 'photos/dz/hb08.dzi', label: 'Deep Zoom · 10945 × 4041' },
      { idx: 10, dzi: 'photos/dz/hb10.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 13, dzi: 'photos/dz/hb13.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 14, dzi: 'photos/dz/hb14.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 15, dzi: 'photos/dz/hb15.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 17, dzi: 'photos/dz/hb17.dzi', label: 'Deep Zoom · 11656 × 8742' },
      { idx: 18, dzi: 'photos/dz/hb18.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 20, dzi: 'photos/dz/hb20.dzi', label: 'Deep Zoom · 11656 × 8742' },
      { idx: 23, dzi: 'photos/dz/hb23.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 24, dzi: 'photos/dz/hb24.dzi', label: 'Deep Zoom · 8742 × 11656' },
      { idx: 29, dzi: 'photos/dz/hb29.dzi', label: 'Deep Zoom · 10302 × 7727' },
      { idx: 34, dzi: 'photos/dz/hb34.dzi', label: 'Deep Zoom · 9907 × 7430' },
      { idx: 36, dzi: 'photos/dz/hb36.dzi', label: 'Deep Zoom · 11656 × 8742' },
      { idx: 38, dzi: 'photos/dz/hb38.dzi', label: 'Deep Zoom · 11656 × 4304' },
      { idx: 43, dzi: 'photos/dz/hb43.dzi', label: 'Deep Zoom · 8742 × 11656' },
    ],
  };

  // Section meta — drives the homepage scroll-stack AND the subpages
  window.SECTIONS = [
    {
      id: 'hasselblad', hash: '#/hasselblad',
      en: 'Hasselblad', zh: '哈蘇',
      eyebrow: 'Series · 001',
      number: '01',
      lede: '這兩次與哈蘇合作，我想挑戰更多可能。',
      subtitle: '這兩次與哈蘇合作，我想挑戰更多可能\n\n當我拿到哈蘇相機時，並不想只用它來做一件事，而是想看看它能如何回應不同的拍攝主題。這次的創作，涵蓋了人像、街景、風景，以及一些更個人、更私密的視角。\n\n每一種題材，都讓我重新理解這台相機的語言，它的細節，它的動態範圍，它如何詮釋光影，以及它如何影響我的觀看方式。',
      meta: [],
      coverIdx: 0, layout: 'single',
    },
    {
      id: 'portraits', hash: '#/portraits',
      en: 'Portraits', zh: '人像',
      eyebrow: 'Series · 002',
      number: '02',
      lede: '喜歡幫朋友們，還有重要的人，記錄他們的樣子。',
      subtitle: '喜歡幫朋友們，還有重要的人，記錄他們的樣子。',
      meta: [],
      coverIdx: 0, layout: 'masonry',
    },
    {
      id: '3d', hash: '#/3d',
      en: '3D', zh: '',
      eyebrow: 'Series · 003',
      number: '03',
      lede: '探索攝影與 3D 領域的邊界。',
      subtitle: '我喜歡探索攝影與 3D 領域的邊界，也喜歡在虛擬世界裡探索各式的可能性。',
      meta: [],
      coverIdx: 0, layout: 'single',
    },
    {
      id: 'street', hash: '#/street',
      en: 'Street', zh: '街拍',
      eyebrow: 'Series · 004',
      number: '04',
      lede: '街拍，就是我解讀各座城市的方式。',
      subtitle: '從接觸攝影以來，我一直喜歡在街頭捕捉各式人文風景。我相信每個人解讀這個世界的方式都不同，而街拍，就是我解讀各座城市的方式。',
      meta: [],
      coverIdx: 0, layout: 'masonry',
    },
    {
      id: 'nature', hash: '#/nature',
      en: 'Nature', zh: '自然',
      eyebrow: 'Series · 005',
      number: '05',
      lede: '我時常被大自然震懾，所以努力記下他們的樣貌。',
      subtitle: '我時常被大自然震懾——從高聳的雲到無邊際的海，從佇立百年千年的樹木到孕育眾多生命的山脈。我喜歡一窺他們的美，記下他們的樣子。',
      meta: [],
      coverIdx: 0, layout: 'masonry',
    },
    {
      id: 'film', hash: '#/film',
      en: 'Film', zh: '底片',
      eyebrow: 'Series · 006',
      number: '06',
      lede: '底片的驚喜，在於拍完時常會忘記當下的畫面。',
      subtitle: '底片的驚喜，在於拍完時常會忘記當下的畫面。化學的顯影，解讀出與數位不同的相片樣貌，也為拍攝增添些不同的氛圍。',
      meta: [],
      coverIdx: 0, layout: 'masonry',
    },
    {
      id: 'market', hash: '#/market',
      en: 'Taipei Wholesale Market', zh: '果菜市場',
      eyebrow: 'Series · 007',
      number: '07',
      lede: '輪轉（liàn-tńg）— 台北第一果菜批發市場紀實計畫。',
      subtitle: '輪轉一詞，取自於台語的「輪轉」（liàn-tńg）。一是認為，輪子在第一果菜批發市場擔任要角，舉凡當地會出現的大貨車、小貨車、人力拖車、電動拖車以及摩托車無不需要它的存在，彷彿它在某層面上也構成了此處。二是，輪子的轉圈就如同果菜市場般，日復一日地轉動著、運行著。最後，在果菜市場的人們不論聊天、買／賣菜、拍賣、廣播都是說著流利的台語，而「輪轉」（liàn-tńg）即為「流利」的意思。\n\n這計畫致力於將果菜市場內的點點滴滴記錄下來，並希望觀看的人能初步了解這地方，理解這裡的人們、文化、建築，畢竟此處即將改建。再來，我也希望觀者能透過我的眼睛、作品，看到我在此處察覺的議題。並透過我微薄的能力、匪淺知識觀察到的議題，透過照片，表達給觀眾。或是拋磚引玉，引起更有能力的人再更深心地探討這些蘊藏在其中的議題。',
      meta: [],
      coverIdx: 0, layout: 'masonry',
    },
  ];
})();
