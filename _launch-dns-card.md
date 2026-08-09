# 上線日 DNS 操作卡（Cloudflare）— 2026-08-08 預備

> **時機**：等 Fable 說「可以動 DNS 了」再做。提前做＝網域指向空地 404＋舊 Squarespace 頁提前下線。

進入：dash.cloudflare.com → 登入 → jerrythepopper.com → DNS → Records

## 第 1 步：改 4 筆 A 記錄（Name = @ / jerrythepopper.com）
現值 198.185.159.x／198.49.23.x（Squarespace）→ 逐筆 Edit 換成：
- 185.199.108.153
- 185.199.109.153
- 185.199.110.153
- 185.199.111.153

## 第 2 步：改 www 的 CNAME
Target：jerrythepopper.com → **jerrythepopper.github.io**

## 第 3 步：加 1 筆 TXT（防搶掛驗證——此功能無 API,本人網頁操作,約 1 分鐘）
1. 瀏覽器開 `github.com/settings/pages` → Verified domains → **Add a domain** → 輸入 `jerrythepopper.com` → Add
2. GitHub 顯示 TXT 的 Name（`_github-pages-challenge-jerrythepopper`）與 Content（隨機碼）
3. Cloudflare DNS → Add record → Type=**TXT** → Name 貼 `_github-pages-challenge-jerrythepopper`（會自動接上主網域）→ Content 貼隨機碼 → Save
4. 回 GitHub 按 **Verify**（DNS 傳播需幾分鐘,失敗稍等再按）
※ 此筆=防搶掛保險,不卡上線——當天順手做即可,忘了也能事後補。

## 第 4 步：雲朵轉灰（DNS only）
上述所有記錄的橙色雲朵（Proxied）→ 點成灰色。
HTTPS 憑證簽發必要條件；憑證下來後要開 Cloudflare AI 爬蟲防護再切回橙。

## 完成後
回對話說「改好了」→ Fable 接手：驗證網域 → 等憑證 → Enforce HTTPS → Search Console。
DNS 生效幾分鐘～幾小時；Enforce HTTPS 選項最慢 24 小時出現。

## 第 5 步（HTTPS 生效後,擇日 5 分鐘）：橙雲三件套
1. DNS 記錄雲朵切回**橙色**（Proxied）
2. Cloudflare 左選單 Analytics → 開 **Web Analytics**（免費無 cookie,D18 已裁=要）
3. Security → Bots → AI 流量開關:**Training 封鎖、Search 放行**（護圖+SEO 兩全,08-08 已裁）
（前置確認 08-08 已完成：使用者可登入 Cloudflare;舊 Squarespace 站不留念,切換即棄）

## 備註
- jerrythepopper.com 與 www.jerrythepopper.com 都會通,一個自動跳轉到另一個（主網址目前=www 版,想換裸網域跟 Fable 說）
- 每一步可逆（值改回去即還原）
- Squarespace 那邊什麼都不用動（只管網域續費）
