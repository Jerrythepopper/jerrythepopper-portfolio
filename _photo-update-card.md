# 換照片操作卡（2026-11-04 整理，沿用 08-09 S20 那次的流程）

## 你今晚要做的（只有這三步）

1. **匯出照片**：Lightroom／PS 匯出 JPG，**一定要勾「嵌入色彩描述檔」**（沒 profile 的檔產線分不出色域，顏色會跑）。長邊越大越好，產線只縮不放大（最大用到 2560）。
2. **放進對應資料夾**（`E:\HUD project\portfolio-site\網站照片\`，跟上次一樣用中文資料夾就好）：

   | 網站照片\ | 對應系列 |
   |---|---|
   | 哈蘇 | hasselblad（hb） |
   | 人像 | portraits（pt） |
   | street | street（st） |
   | Nature | nature（na） |
   | 3D | 3d（td） |
   | 底片 | film（fm） |
   | 果菜市場 | market（mk） |
   | Work | Work 頁磚圖 |
   | 自我介紹照片 | About 肖像（只用第一張） |

   要刪的照片直接從資料夾拿掉；要新增的丟進去。
3. **排順序（選做）**：雙擊開 `sort-studio.html` → 選資料夾 → 拖曳排序、點星星指定封面 → 「存成 order.json」。不排的話，新照片會被排到最後面（有 order.json 時）或依拍攝時間排（沒有時）。

做完跟我說「照片放好了」，剩下的我來。

## 我這邊接手的步驟（你不用操作）

1. 備份 `photos\`、`data.js`、`photo-alts*.json`、`originals\` 現況。
2. 把 `網站照片\` 同步到 `originals\<系列>\`。
3. `node ingest-photos.js` → 轉 AVIF/WebP 三尺寸（800/1600/2560）＋模糊佔位圖，**剝光 EXIF/GPS**，自動改寫 `data.js` 張數。
4. `node verify-color.js` 比色（ΔE mean<1.0 / max<2.0）。
5. **補 alt 文字**：`photo-alts.json`／`photo-alts-en.json` 是照「系列_序號」（如 `hb_12`）對應的，**順序一變，舊的描述就會對到別張照片**——新增或重排的照片要重新看圖寫中英 alt。
6. **哈蘇系列要特別處理 Deep Zoom**：`data.js` 的 `DEEPZOOM` 跟 `originals\deepzoom\hbNN.jpg` 都用序號對應。哈蘇順序一動，20 張 Deep Zoom 的角標會掛錯照片，要重新對號、必要時重切片（切片很大，會吃容量，見下方）。
7. `node build-site.js` → 本機預覽 → 截圖給你看 → 你點頭後 commit＋push，GitHub Actions 約 1 分鐘自動部署。
8. 上線後 Cloudflare 的 HTML 快取 10 分鐘，看不到新照片就 Ctrl+Shift+R。

## 容量提醒

- GitHub repo 目前 **約 931 MB**（2026-11-04 查詢）。GitHub 建議 repo 小於 1 GB，5 GB 以內都能用；**git 會永久保留舊照片**，所以換掉的照片不會讓 repo 變小，只會越來越大。
- **真正會先碰到的是 GitHub Pages 網站本體（dist）上限 1 GB**：2026-11-04 實測 dist＝**851 MB**（8 月 813 MB，後來加了 3D add-on 頁），剩約 **150 MB**；帳本寫的停手線是 950 MB＝還能淨增約 **60 張**一般照片。
- 實測（2026-11-04）：一般照片 237 張共 383 MB，**平均每張約 1.6 MB**（三尺寸 × 兩格式）。換 30 張＝repo 多約 50 MB、網站本體幾乎持平（舊的被取代）。
- **Deep Zoom 切片 20 張共 391 MB，平均每張約 20 MB**——這才是大戶。要再增加 Deep Zoom 之前，得先把切片搬去 Cloudflare R2。
