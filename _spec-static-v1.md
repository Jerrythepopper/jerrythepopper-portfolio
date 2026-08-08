# 靜態化改造規格 v1（2026-08-08，主對話定調）

## 目標
把 React SPA 雛形轉成**建置期生成的純靜態多頁網站**，視覺與現有雛形一致，文字真實存在於 HTML（SEO/AI 可爬），內容集中 `data.js` 一處（未來改文案＝改它＋重建）。

## 產出物
- `build-site.js`（Node 零依賴，仿 HUD 專案 build.js 精神）：讀 `data.js`＋內部模板 → 生成 `dist\`。
- `dist\` 結構（GH Pages 可直接發布的根）：
  - `index.html`（首頁：hero 輪播＋intro＋六系列區塊＋work/about teaser＋footer）
  - `hasselblad/index.html`、`portraits/`、`street/`、`3d/`、`film/`、`market/`、`work/`、`about/` 各一頁（乾淨網址，不帶 .html）
  - `styles.css`（沿用現有，可append 少量補丁不改既有規則）、`site.js`（vanilla 互動）、`photos\`（build 時整資料夾複製）
  - `robots.txt`、`sitemap.xml`、`llms.txt`
- 導覽連結全部從 `#/xxx` 改為 `/xxx/`（子頁回首頁用 `/`）。**GH Pages 若掛在專案子路徑會斷根絕對連結——一律用相對路徑**（子頁引用 `../styles.css`、`../photos/...`）。

## DOM/視覺對齊（判準）
- class 名、DOM 層級照抄 `app.jsx` 現有輸出（.hero/.frosted/.section/.gallery/.lb/...），`styles.css` 原樣生效＝視覺自動一致。
- `site.js` 復刻四件互動：①hero 輪播（5s 自動輪播＋圓點可點）②frosted nav（scrollY 超過 55vh 或 480px 淡入）③fade-up（IntersectionObserver threshold 0.18，進視窗加 .in）④lightbox（點圖開、Esc/←/→、計數器 01／25、開啟時 body overflow hidden）。respect `prefers-reduced-motion`（reduce 時輪播不自動輪、fade 直接顯示）。
- 圖片一律 `loading="lazy"`（hero 首張除外）＋有意義的 alt（demo 照片期用「{系列英文名} {編號}」即可，真照片來了再補人寫）。

## SEO 頭部（每頁）
- `<html lang="zh-Hant">`；title 格式：首頁「Jerrythepopper 洪立楷｜攝影作品集 Photography Portfolio」，系列頁「{英文} {中文}｜Jerrythepopper Photography」。
- meta description：從 data.js 的 lede/subtitle 擷取 ≤155 字元。
- OG：og:title/og:description/og:image（該頁 cover 照絕對路徑待網域，先相對）/og:type=website；twitter:card=summary_large_image。
- canonical＋sitemap 的網域：build-site.js 頂部 `const SITE_ORIGIN = 'https://PLACEHOLDER.example'`（網域未定，標 TODO；sitemap/canonical 用它組）。
- JSON-LD：首頁＋about 放 Person（name: Jerrythepopper 洪立楷, jobTitle: Photographer / 3D Creator, address 只到 Taipei 不放街址, sameAs: IG）；系列頁放 ImageGallery（name＋description）。
- robots.txt：`User-agent: GPTBot|ClaudeBot|CCBot|Google-Extended` 各 `Disallow: /`；其餘 `User-agent: * Allow: /`＋`Sitemap:` 行。
- llms.txt：H1＋blockquote 簡介＋各頁一行連結（Markdown）。

## 內容小修（隨手，唯一可動 data.js 的地方）
- market 區 `eyebrow: 'Series · 007'` → `'Series · 006'`（與 number '06' 對齊）。
- `rotation`（rot_0-7）維持原樣不使用不刪除（用途待問使用者）。

## 紅線
- 既有檔案除上述 data.js 一處外**一律不改**（app.jsx/styles.css 原檔/殼 HTML 保持原樣＝對照組）；styles 補丁走 dist 內生成的 styles.css 附加段或獨立 patch.css。
- 零 npm 依賴；React/Babel CDN 從 dist 完全消失；Google Fonts `@import` 保留（唯一外部請求，成文允許）。
- About 頁**工作室街址先拿掉**（Email/IG 保留），等使用者確認要不要公開。
- demo 照片原樣複製，不做壓縮轉檔（產線是下一棒的事）。

## 驗收（實跑證據，不收自述）
1. `node build-site.js` 無錯，回報 dist 檔案清單與尺寸。
2. 本機伺服器起 dist（port 8139，可抄 scratchpad portfolio-serve.js 改 ROOT），9 頁逐頁：HTTP 200、console 零 error、`document.querySelector('h1')` 有真文字（禁 JS 注入後才有）。
3. 靜態驗證：dist 各 html 以 Node 直讀字串，確認 title/description/JSON-LD 存在且非空、無 `unpkg.com`/`text/babel` 殘留。
4. 互動抽查：首頁輪播 dots 數＝8、lightbox 開關、frosted nav 捲動出現（browser 工具或 headless CDP 皆可）。
5. 對照組：舊殼（root 的 Jerrythepopper Portfolio.html）仍可原樣開啟不受影響。
