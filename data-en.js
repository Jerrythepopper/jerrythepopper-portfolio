/* =============================================================================
   data-en.js — 英文版全站文案（唯一內容來源：_content-en-draft.md 站主終審版）
   -----------------------------------------------------------------------------
   紀律：本檔的每一句都逐字照抄 _content-en-draft.md，禁止在這裡潤飾或改寫。
   要改文案 → 先改 _content-en-draft.md，再同步過來，兩邊永遠一致。

   哪些「不譯」是刻意的（照文案檔的裁示，不是漏譯）：
     · 照片 alt（233 句）沿用中文 —— v1 取捨。
     · hero 直排「洪 立 楷 ／ 影 像 作 品」保留 —— 它是設計元素（如同參考站保留日文）。
     · 合作品牌清單的品牌名本身不譯（文案檔第 68 行明寫）—— 所以名發建設／朱銘美術館
       這類中文品牌名在英文頁照樣是中文；Hasselblad/Leica 這種本來就是英文。
     · Work 磚的專案標題（新光攝影展講座／晶悅建設…）同理不譯，只譯「分類標籤」。
   結構對照：window.SECTIONS（data.js）的 id → sections[id]，欄位名 lede/subtitle 同名。
   ============================================================================= */
(function () {
  window.EN = {

    // ---------- 首頁 ----------
    home: {
      // intro 宣言：中文版是兩行（<br> 分隔），英文照同一個節奏拆兩句
      /* 08-12 隨中文版重譯（站主自改宣言:除矯情+涵蓋 3D——喜歡×2 的句式照搬） */
      introLede: [
        'I love capturing people, streets and spaces through images.',
        'And I love searching the many possibilities of the image for the look I love.',
      ],
      // Work 區塊 lede（首頁 08 那塊）
      workLede: 'Selected brand collaborations and commissioned work.',
      // About 區塊 lede：取 About 內文第一段（文案檔沒有另立首頁版）
      aboutLede: 'Born in Taipei in 1996. Photographer and 3D artist.',
    },

    // ---------- 七個系列：lede（首頁區塊）＋ subtitle（系列頁版頭） ----------
    // subtitle 的 \n\n＝段落分隔（吃 white-space:pre-line，與中文版同機制）
    sections: {
      hasselblad: {
        lede: 'For my two collaborations with Hasselblad, I wanted to push what the camera could do.',
        subtitle: "When I got my hands on a Hasselblad, I did not want to use it for just one thing. I wanted to see how it would answer to different subjects. This body of work covers portraits, street scenes, landscapes, and some more personal, more private views.\n\nEach subject taught me the camera's language again: its detail, its dynamic range, how it renders light and shadow, and how it changes the way I see.",
      },
      portraits: {
        lede: 'Pictures of my friends, and the people who matter, the way they are.',
        subtitle: 'I like working with natural light, and with the light and shadow found on the street and out in nature, to capture beautiful moments of my friends and the people who matter to me.',
      },
      street: {
        lede: 'Street photography is how I read a city.',
        subtitle: 'Since I first picked up a camera, I have loved catching scenes of people on the street: light and shadow between buildings, the way people interact with each other and their surroundings, even the corners most people walk past. Everyone reads the world their own way. Street photography is how I record and read each city, and perhaps a way to keep a record of what this era looks like.',
      },
      nature: {
        lede: 'Nature keeps stunning me, so I do my best to keep a record of them.',
        subtitle: 'Nature keeps stunning me: towering clouds, the open sea, trees that have stood for hundreds of years, mountains that hold countless lives. I like heading into the mountains and waiting for the moment light falls on a ridge, a sea of clouds or a forest, then keeping a record of how it looks.',
      },
      '3d': {
        lede: 'Exploring the edge between photography and 3D.',
        subtitle: 'I like exploring the border between photography and 3D, and trying out what virtual worlds make possible: placing 3D objects into my photographs, blending photographs with 3D environments, or building the worlds I love in 3D and capturing them through a photographer\'s eye. Most of this work is made in Blender.',
      },
      film: {
        lede: 'The surprise of film is that I often forget the frame by the time it comes back.',
        subtitle: 'The surprise of film is that I often forget what I shot until the roll comes back. Chemical development reads a picture differently than digital, and it gives the whole process a different mood.',
      },
      // 市場 lede＝站主 08-09 補的最終版（要有輪子轉動的感覺）：含 the turning of wheels
      market: {
        lede: 'Lian-tng, the turning of wheels: a documentary project inside the Taipei First Wholesale Fruit and Vegetable Market.',
        subtitle: 'The name comes from the Taiwanese word lian-tng. First, wheels play a leading role at the First Wholesale Market: the big trucks, small trucks, hand carts, electric carts and scooters all depend on them, as if wheels themselves make up part of this place. Second, a turning wheel is like the market itself, spinning and running day after day. And everyone here, whether chatting, buying and selling, auctioning or on the loudspeaker, speaks fluent Taiwanese. Lian-tng also means "fluent."\n\nThis project sets out to record the everyday details of the market, so that viewers can begin to know this place, its people, culture and buildings, before the coming reconstruction. I also hope viewers can see, through my eyes and my work, the questions I noticed here, and that the photographs pass them on. Or, better, that they invite people more capable than me to dig deeper into what this place holds.',
      },
    },

    // ---------- 導覽列：只有果菜市場那一項中文版是中文，英文版換 Market ----------
    nav: { market: 'Market' },

    // ---------- 系列頁 Deep Zoom 說明行 ----------
    dzNote: 'Works marked DEEP ZOOM can be opened and explored at full resolution.',

    // ---------- Work ----------
    work: {
      // 中文版 subtitle 是「英文一行＋中文一行」，英文版只留英文那行
      /* 11-04 站主改寫 Work 開頭與每格說明（中文為站主定稿），以下英文是本次新譯，
         與 ctaTitle 同屬「文案檔尚未收錄」的記錄有案例外。 */
      subtitle: 'A collection of my brand work, from image shoots, interior photography and 3D product animation to photography talks, online courses and social media collaborations. Each tile links to the original post or video.',
      featuredSub: 'Selected collaborations and personal work',
      featuredNote: 'Opens the full Instagram highlight',
      // 磚上「我做了什麼」那行：key＝build-site.js WORK_TILES 的中文 d
      descs: {
        '新機形象與社群合作': 'Launch imagery and social campaign',
        '品牌社群合作': 'Social media collaboration',
        '品牌周年 3D 動畫製作': 'Anniversary 3D animation',
        '品牌新品 3D 動畫製作': 'New product 3D animation',
        '新光攝影獎講師': 'Speaker, Shin Kong Photography Award',
        '品牌新車巡迴攝影': 'New model roadshow photography',
        '講者': 'Speaker',
        'Sony 台灣 YouTube 頻道合作攝影師': 'Featured photographer, Sony Taiwan YouTube',
        '線上底片攝影課程': 'Online film photography course',
        '建案室內空間攝影': 'Interior photography for a residential development',
      },
      /* 磚牆後的「找我合作」出口（站主 2026-08-11 核准新增）。
         這兩句是本次新寫的 CTA 文案，不是 _content-en-draft.md 的既有句
         ——本檔「逐字照抄文案檔」的紀律在此開一個記錄有案的例外，
         等文案檔補上同一段之後，兩邊即回到一致。
         email 本身不進表：mailto 連結由 build-site.js 組，中英共用同一個地址。 */
      ctaTitle: 'Have a project in mind?',
      ctaLead: 'Get in touch',
      // 磚的分類標籤（中文 → 英文）；查無對照就原樣輸出，不會漏字
      cats: {
        '品牌形象拍攝': 'Brand photography',
        '品牌合作計畫': 'Brand partnership',
        '品牌形象動畫': 'Brand animation',
        '品牌形象合作': 'Brand collaboration',
        '攝影展覽講座': 'Exhibition talk',
        '產品動畫製作': 'Product animation',
        '品牌演講活動': 'Speaking engagement',
        '品牌影片內容': 'Brand video',
        '線上攝影課程': 'Online photography course',
        '攝影教學講師': 'Photography instructor',
      },
    },

    // ---------- About ----------
    about: {
      paras: [
        'Born in Taipei in 1996. Photographer and 3D artist.',
        'I love capturing people, streets and spaces through images, and I love searching the many possibilities of the image for the look I love. Alongside photography, I keep exploring where 3D visuals and real scenes cross over, pushing still images toward a more dimensional kind of storytelling.',
        'I have worked with Hasselblad, Leica, Sony, Oppo, Giant, the Shin Kong Photography Exhibition, the Juming Museum, Shopee and others, on brand photography, teaching and creative projects. My documentary project Lian-tng followed the people and stories of the Taipei First Wholesale Fruit and Vegetable Market for over a year, and was published as a photobook through crowdfunding.',
        'Based in Taipei. Available for photography and 3D commissions in Taiwan and worldwide.',
      ],
      togetherHead: 'What we can do together',
      together: [
        'Photography | brand imagery, portraits, street, spaces, events, documentary',
        '3D | scene design, visual concepts, mixed reality',
        'Creative projects | visual storytelling, brand collaborations, installations',
        'Education | photography teaching, course production',
      ],
      brandsHead: 'Collaborations',
      // 群組標籤譯；品牌名本身不譯（文案檔明寫），所以值直接沿用 build-site.js 的中文版清單
      brandLabels: {
        '相機品牌': 'Camera brands',
        '建築 / 商業': 'Architecture and business',
        '文化 / 藝術': 'Culture and art',
        '商業平台': 'Platforms',
      },
      exhibitsHead: 'Exhibitions, publications and courses',
      exhibits: [
        'Lian-tng: photobook and exhibition (a documentary project on the Taipei First Wholesale Market)',
        'Online film photography course (with an online course platform)',
        'Sony × Jerrythepopper tutorial films (street photography on YouTube)',
      ],
    },

    // ---------- 404 ----------
    notFound: {
      h1: 'Whoa, how did you end up here?!',
      p: 'There is no such page.',
      cta: 'Back to home',
    },

    // ---------- Meta（文案檔「Meta（英文版 SEO）」節） ----------
    meta: {
      homeTitle: 'Jerrythepopper | Taipei Photographer & 3D Artist Portfolio',
      homeDesc: 'Portfolio of Taipei photographer and 3D artist Jerry Hong (Jerrythepopper): portraits, street, film and nature photography alongside 3D visual work. Collaborations with Hasselblad, Leica and Sony. Based in Taipei, available worldwide.',
      threeDTitle: '3D & CGI Visual Work | Jerrythepopper',
      threeDDesc: 'Experiments on the border of photography and 3D: CGI scene design and mixed-reality visual work from Taipei.',
      // 以下三條沒有站主指定版，照中文版的組字規則轉英文（全形｜換半形 |）
      workDesc: 'Selected brand collaborations and commissioned work. Image shoots, interior photography, 3D product animation, talks and online courses. Hasselblad, OPPO, Sony, GIANT, Goopi, Reto, 2022 — 2026.',
      notFoundDesc: 'There is no such page.',
      siteSuffix: 'Jerrythepopper Photography',
    },

    // ---------- 語言切換鈕（英文頁上那顆：切回中文版） ----------
    langToggle: { text: '中', label: 'Switch to Chinese 中文版' },
  };

  // 中文頁上那顆切到英文版的鈕（放這裡是為了「兩邊的鈕文字集中一處」）
  window.EN_SWITCH_ZH = { text: 'EN', label: '切換至英文版 English' };
})();
