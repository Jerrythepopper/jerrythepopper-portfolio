# 作品集網站 待辦帳本（2026-08-08 起記；裁決＝要 Jerry 點頭或出材料，解決＝工程照做）

## 待裁決

| # | 事項 | 說明 | 狀態 |
|---|---|---|---|
| D1 | GitHub 連線時機與方式 | 機器沒裝 GitHub CLI。可今天連：①我用 winget 裝官方 GitHub CLI（要你點頭）②我啟動 device 授權、給你八位代碼③你手機開 github.com/login/device 輸入＝完成（全程不碰密碼）。或等回家再弄。repo 建議 `jerrythepopper-portfolio`，先開 **private**，上線時才轉 public | 待答 |
| D2 | 網域名稱 | Squarespace 上的網域是哪個？直接打在對話裡即可。DNS 設定屆時由 Jerry 在 Squarespace 後台貼上我給的精確值（4 筆 A ＋ 1 筆 CNAME），或回家後我用瀏覽器帶著做 | 待答 |
| D3 | Work 頁 IG 限動連結 | 多筆連到 story highlight，未登入訪客常打不開。要換成貼文/Reel 連結——替代連結要 Jerry 提供 | 待答 |
| D4 | 各系列補中文自述 | 人像/街拍/3D/底片目前只有一句英文 lede。建議各補 2-3 句 Jerry 自己的話（可口述我整理，humanizer 紀律代筆＋Jerry 定稿） | 待答 |
| D5 | 《輪轉》字誤 | 「希希望」→「希望」？「查覺」→「察覺」？（原文是 Jerry 手筆，修不修尊重本人） | 待答 |
| D6 | About 數據核實 | 「3 Solo shows」vs 展覽清單僅 1 檔；「50+ Brands」「12 Years」——全部核實或調整 | 待答 |
| D7 | About 工作室街址 | 靜態版預設**先拿掉**（Email/IG 保留）。要公開再放回 | 預設已執行,可否決 |
| D8 | 系列頁尾「下一個系列」導流 | 現況看完是死路。建議加（參考站同款動線） | 待答 |
| D9 | 浮水印 | 要不要＋位置/淡度。產線腳本會留鉤子,不啟用 | 待答 |
| D10 | rot_0~7（rotation 8 張） | data.js 有定義但全站未用。demo 期不急,真照片分類時一併定 | 低急 |
| D11 | v2 候選 | 雙語切換／每張照片個別說明／Google Fonts 自 host。全部 v2 再議 | 低急 |
| D12 | 正式照片 | 各系列原檔（回家後供圖）,連同分類與順序 | 等回家 |

## 待解決

| # | 事項 | 依賴 | 狀態 |
|---|---|---|---|
| S1 | 靜態化改造＋SEO 包（規格 `_spec-static-v1.md`） | — | **進行中**（opus） |
| S2 | 圖片產線腳本（資料夾→WebP 多尺寸→data 更新,demo 照片跑通） | S1 收工（對齊資料格式） | 排隊 |
| S3 | favicon＋OG 分享縮圖 | 併入 S1 | 併入 S1 |
| S4 | fresh verifier 對帳 | S1、S2 各一輪 | 排隊 |
| S5 | portfolio repo 設 local git user.email＝jerrythepopper@gmail.com（全域 email 是另一個,commit 歸屬對齊 GitHub 帳號） | D1 | 排隊 |
| S6 | 上線流程：repo 轉 public → 啟 Pages → DNS（D2）→ Enforce HTTPS → Google Search Console 登記 | D1+D2＋S1 | 排隊 |
| S7 | humanizer skill 安裝（blader/humanizer v2.9.1, MIT） | — | **已完成**（C:\Users\User\.claude\skills\humanizer\） |
| S8 | 部署後驗收：跨裝置截圖／OG 卡預覽／robots.txt 實測 | S6 | 排隊 |

## 已裁決存檔
- 2026-08-08：施工範圍「全做」（靜態化+SEO+產線+git init）；派工嚴格度=標準。
- 2026-08-08：dithermobile（HUD 副案）整案不做——與本站無關,記於 HUD 記憶。
