# UI/UX 鑒定報告（2026-08-08）

鑒定方式：18 張截圖（9 頁 × 桌機 1440/手機 390 雙視角）＋ 4 頁 DOM 量測數據。
量測數據來自鑒定員（後因超時斬單），截圖由補拍手完成，品味判讀由主對話（Fable）執筆。
判準：業界攝影作品集高標＋貴船神社參考站氣質＋better-ui/typography/colors/accessibility 四顆 skill 的工程標準。

## 總體評價

氣質守住了——襯線大字、留白節奏、交錯排版、克制動效，日系基準沒有跑掉，Hasselblad 系列頁首屏和 About 雙欄尤其漂亮。
問題集中在「手機版沒被認真對待過」：斷字、導覽溢出都是 390px 下的破綻；桌機版大致只有細節分。
demo 照片不評；以下全部針對版面與工程。

## P0（上線前必修）

| # | 問題 | 證據 | 修法方向 |
|---|---|---|---|
| P0-1 | 手機版 hero 大標「Jerrythepopper」斷字成「Jerrythepopp / er」——門面第一眼破功 | home-mobile.png 首屏 | 標題字級改 `clamp()` 隨視窗縮放；或手機檔縮 letter-spacing＋字級,確保 14 字元一行放得下 |
| P0-2 | 手機版 frosted 導覽列水平溢出 234px（內容 451px > 容器 217px）,8 個項目擠爆、項目高 68px＝已折兩行、整條 89px 高 | _m-home.json nav 實測 | 手機檔重新設計：精簡為「選單」抽屜,或改為可水平滑動的單行（滑動要有視覺暗示）;桌機不動 |

## P1（該修）

| # | 問題 | 證據 | 修法方向 |
|---|---|---|---|
| P1-1 | 子頁首屏零導覽零品牌——分享連結直達系列頁時,訪客第一屏看不到站名、也沒有任何返回路徑（frosted nav 要捲動後才出現） | hasselblad-desktop.png 上緣全空 | 子頁給常駐極簡頂欄（wordmark＋返回首頁）,或子頁讓 frosted nav 初始即顯示 |
| P1-2 | 首頁 8 張系列封面圖全部即時載入（lazy=0）,首屏權重過重 | _m-home.json lazy:0/8（對照 street 頁 25/25 正常） | 首頁 hero 外的 `<img>` 補 `loading="lazy"`（build 模板漏了首頁區塊） |
| P1-3 | 全站 `<img>` 無 width/height 屬性 → 圖片載入時版面跳動（CLS） | _m-*.json noDims 全數 | build 時讀圖寫入尺寸屬性（sharp 可得）,CSS 維持響應式 |
| P1-4 | hero 輪播圓點觸控目標 32×12px,遠低於 44px 標準 | _m-home.json dot | 視覺不變,padding 擴大點擊熱區至 ≥44px（better-accessibility hit-areas 手法） |
| P1-5 | 首頁雙 `<h1>`（hero 標題＋intro 句）,標題層級語意錯亂,傷 SEO | _m-home.json h1 陣列 2 筆 | intro 句降為 `<p class="intro-lede">` 或 h2,全站維持每頁單一 h1 |

## P2（品味加分,可等 v2）

| # | 問題 | 證據 | 修法方向 |
|---|---|---|---|
| P2-1 | 內文 14px 偏小,桌機段落行寬 ~77 拉丁字元微超 ~70 舒適線 | _m-home.json para | 內文升 15–16px,段落 max-width 微縮;中文行高可再放 |
| P2-2 | 桌機系列頁首屏右半整片空白（1440 寬,page-head 只佔左欄） | hasselblad-desktop.png | 日系可辯護,不強修;若要,meta 資訊或首圖可上提補右側視覺重量 |
| P2-3 | Work 精選磚黑色 overlay 偏重,照片幾乎看不見 | work-desktop.png | overlay 透明度調輕 10–15%,hover 時再加深保字可讀 |

## 該保護的資產（別動壞）

- hero 襯線大字壓照片＋逐字浮現（桌機版）
- 系列頁 page-head 的字階層次（號碼/eyebrow/大標/中文副標/lede/meta 六層乾淨）
- About 雙欄與縱向節奏、Work 磚牆的 overlay 字體感
- 全站 alt 文字已齊（noAlt=0）、street 等系列頁 lazy loading 正常、手機版 gallery 正確降單欄

## 施工建議

P0×2＋P1×5 全部併入 S11 高畫質燈箱棒一次做（都在 build-site.js 模板與 01 CSS 層,同一刀範圍）;P2 記帳等 v2。
