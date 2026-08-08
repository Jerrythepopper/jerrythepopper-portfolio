# 作品集網站 待辦帳本（2026-08-08 起記；裁決＝要 Jerry 點頭或出材料，解決＝工程照做）

## 待裁決

| # | 事項 | 說明 | 狀態 |
|---|---|---|---|
| D1 | GitHub 連線時機與方式 | 機器沒裝 GitHub CLI。可今天連：①我用 winget 裝官方 GitHub CLI（要你點頭）②我啟動 device 授權、給你八位代碼③你手機開 github.com/login/device 輸入＝完成（全程不碰密碼）。或等回家再弄。repo 建議 `jerrythepopper-portfolio`，先開 **private**，上線時才轉 public | 待答 |
| D2 | 網域名稱 | **已答（08-08）：`www.jerrythepopper.com`**。canonical 用 www 版,apex 301 導 www。DNS 屆時 Jerry 在 Squarespace 後台貼我給的值 | ✅已裁 |
| D3 | Work 頁 IG 限動連結 | **已裁（08-08）：保留**——那些內容只發在限時,沒有貼文版可換。風險已知悉（未登入訪客可能吃登入牆）,維持原連結 | ✅已裁 |
| D4 | 各系列補中文自述 | 人像/街拍/3D/底片目前只有一句英文 lede。建議各補 2-3 句 Jerry 自己的話（可口述我整理，humanizer 紀律代筆＋Jerry 定稿） | 待答 |
| D5 | 《輪轉》字誤 | **已裁（08-08）：修**——「希希望」→「希望」、「查覺」→「察覺」 | ✅已裁→S9 |
| D6 | About 數據 | **已裁（08-08）**：展覽＝3 檔（本人確認）,「50+ Brands」→「**30+**」,12 Years 不動 | ✅已裁→S9 |
| D7 | About 工作室街址 | **已裁（08-08）：拿掉**（Email/IG 保留） | ✅已裁 |
| D8 | 系列頁尾「下一個系列」導流 | **已裁(08-08）：做** | ✅已裁→S9 |
| D9 | 浮水印 | **已裁（08-08）：不要**。產線腳本不留鉤子,單純轉檔 | ✅已裁 |
| D10 | rot_0~7（rotation 8 張） | data.js 有定義但全站未用。demo 期不急,真照片分類時一併定 | 低急 |
| D11 | v2 候選 | **雙語切換：已裁（08-08）＝要做**,排上線後 v2 第一項。每張照片說明／Fonts 自 host 仍 v2 再議 | 部分已裁 |
| D12 | 正式照片 | 各系列原檔（回家後供圖）,連同分類與順序 | 等回家 |

## 待解決

| # | 事項 | 依賴 | 狀態 |
|---|---|---|---|
| S1 | 靜態化改造＋SEO 包（規格 `_spec-static-v1.md`） | — | **已完成**（commit ebb679f） |
| S2 | 圖片產線腳本（資料夾→WebP 多尺寸→data 更新,demo 照片跑通） | S1 收工（對齊資料格式） | **已完成**：`ingest-photos.js`（sharp,EXIF 全剝,1600/800 雙尺寸）＋build 模板 srcset 偵測分支；demo 6 張實跑後已 revert |
| S3 | favicon＋OG 分享縮圖 | 併入 S1 | favicon **已完成**（手寫 `src-site\favicon.svg`,九頁相對路徑引用）；OG 專用分享圖仍用該頁 cover,待正式照片再議 |
| S4 | fresh verifier 對帳 | S1、S2 各一輪 | 排隊 |
| S5 | portfolio repo 設 local git user.email＝jerrythepopper@gmail.com（全域 email 是另一個,commit 歸屬對齊 GitHub 帳號） | D1 | 排隊 |
| S6 | 上線流程：repo 轉 public → 啟 Pages → DNS（D2）→ Enforce HTTPS → Google Search Console 登記 | D1+D2＋S1 | 排隊 |
| S7 | humanizer skill 安裝（blader/humanizer v2.9.1, MIT） | — | **已完成**（C:\Users\User\.claude\skills\humanizer\） |
| S8 | 部署後驗收：跨裝置截圖／OG 卡預覽／robots.txt 實測 | S6 | 排隊 |
| S9 | 裁決落地小刀：SITE_ORIGIN=`https://www.jerrythepopper.com`＋字誤二處（D5）＋Brands 30+（D6）＋系列頁尾導流（D8） | S1 收工後 | **已完成**（四項全落地,九頁 grep 驗過） |

## 已裁決存檔
- 2026-08-08：施工範圍「全做」（靜態化+SEO+產線+git init）；派工嚴格度=標準。
- 2026-08-08 批次裁決（本人遠端）：D2 網域=www.jerrythepopper.com／D3 限動連結保留／D5 修字誤／D6 展覽3檔+Brands改30+／D7 街址拿掉／D8 導流做／D9 浮水印不要／D11 雙語=要,排v2。未答：D1（GitHub CLI 裝否）、D4（系列文案材料）、D12（正式照片,等回家）。
- 2026-08-08：dithermobile（HUD 副案）整案不做——與本站無關,記於 HUD 記憶。
