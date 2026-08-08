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

## 順序怎麼決定

序號自 0 起，每個系列資料夾各自照這個順序判定（由上往下，先中先贏）：

1. **資料夾裡有 `order.json`** → 完全照它的 `order` 陣列排。
   沒被列到的檔案排在尾端、列了卻不存在的檔案跳過，兩種情況都會在 console 出警告。
   `order.json` 還可以帶 `cover` 欄位＝封面檔名，產線會換算成它在最終序的位置，
   直接寫進 `data.js` 該系列的 `coverIdx`。
2. **沒有 `order.json`** → 依 EXIF 的拍攝時間（DateTimeOriginal）由舊到新；讀不到時間的排尾端。
3. **兩者皆無** → 檔名字母序（想控制順序就把檔名前面編號，例如 `01_xxx.jpg`）。

`order.json` 本身不是圖片，不會被轉檔，也不會出現在 `photos\`。

## 用 Sort Studio 拖一拖排順序（不必改檔名）

`order.json` 不用手寫——站根目錄的 **`sort-studio.html`** 就是拖曳排序的小工具，
用瀏覽器直接打開它（連按兩下即可，不必開伺服器、不會上傳任何東西）：

1. 按「選擇資料夾」，選要排的系列資料夾（例如 `originals\hasselblad\`）。
2. **拖曳縮圖**排出想要的順序；想指定封面就點該張右上角的**星星**（再點一次取消）。
3. 按「**存成 order.json**」。Chrome / Edge 會直接寫回該資料夾；其他瀏覽器會下載一個
   `order.json`，請把它搬進剛剛那個資料夾。

排好之後回終端機跑 `node ingest-photos.js`，轉檔就會照這個順序編號。
下次再開 Sort Studio 選同一個資料夾，會自動載入既有的 `order.json` 接續調整。

跑法：

```
npm install          # 只需第一次（安裝 sharp）
node ingest-photos.js
node build-site.js
```

產線會輸出長邊 1600（quality 82）與長邊 800 兩種 WebP，**剝除全部 EXIF/GPS metadata**，
並自動改寫 `data.js` 的張數與副檔名。

本資料夾的內容不進版控（見 `.gitignore`）——原檔留在本機，網站只發布 `photos\` 的成品。
