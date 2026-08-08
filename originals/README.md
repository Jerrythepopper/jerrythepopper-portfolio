# originals\ — 圖片產線的輸入資料夾

正式照片的**原檔**放這裡，依系列分子資料夾（檔名隨意，`.jpg` / `.jpeg` / `.png`）：

```
originals\hasselblad\   → photos\hb_0.webp, hb_0@800.webp, hb_1.webp, …
originals\portraits\    → pt_*
originals\street\       → st_*
originals\3d\           → td_*
originals\film\         → fm_*
originals\market\       → mk_*
```

序號自 0 起、按檔名字母序（想控制順序就把檔名前面編號，例如 `01_xxx.jpg`）。

跑法：

```
npm install          # 只需第一次（安裝 sharp）
node ingest-photos.js
node build-site.js
```

產線會輸出長邊 1600（quality 82）與長邊 800 兩種 WebP，**剝除全部 EXIF/GPS metadata**，
並自動改寫 `data.js` 的張數與副檔名。

本資料夾的內容不進版控（見 `.gitignore`）——原檔留在本機，網站只發布 `photos\` 的成品。
