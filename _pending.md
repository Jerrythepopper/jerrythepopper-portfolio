# 作品集網站 待辦帳本（2026-08-08 起記；裁決＝要 Jerry 點頭或出材料，解決＝工程照做）

## 待裁決

| # | 事項 | 說明 | 狀態 |
|---|---|---|---|
| D1 | GitHub 連線 | **已完成（08-08）**：gh 2.97.0 zip 版住 `C:\Users\User\Tools\gh\`（winget MSI 卡 UAC 改道）;device flow 手機授權成功（帳號 Jerrythepopper,scopes repo/gist/read:org）;repo `Jerrythepopper/jerrythepopper-portfolio` **PRIVATE** 已推 4 commits | ✅完成 |
| D2 | 網域名稱 | **已答（08-08）：`www.jerrythepopper.com`**。canonical 用 www。**08-08 實查：DNS 已在 Cloudflare 代管**（NS=serenity/clint.ns.cloudflare.com,現指 Squarespace 主機 198.185.159.x）——上線日動 Cloudflare 不動 Squarespace;無 MX 零誤傷;AI 爬蟲三類開關免費可用。**回家先確認 Cloudflare 帳號登入**;舊 Squarespace 站切換即下線,要留念先看 | ✅已裁（帳號存取待確認） |
| D3 | Work 頁 IG 限動連結 | **已裁（08-08）：保留**——那些內容只發在限時,沒有貼文版可換。風險已知悉（未登入訪客可能吃登入牆）,維持原連結 | ✅已裁 |
| D4 | 各系列補中文自述 | 人像/街拍/3D/底片目前只有一句英文 lede。建議各補 2-3 句 Jerry 自己的話（可口述我整理，humanizer 紀律代筆＋Jerry 定稿） | 待答 |
| D5 | 《輪轉》字誤 | **已裁（08-08）：修**——「希希望」→「希望」、「查覺」→「察覺」 | ✅已裁→S9 |
| D6 | About 數據 | **已裁（08-08）**：展覽＝3 檔（本人確認）,「50+ Brands」→「**30+**」,12 Years 不動 | ✅已裁→S9 |
| D7 | About 工作室街址 | **已裁（08-08）：拿掉**（Email/IG 保留） | ✅已裁 |
| D8 | 系列頁尾「下一個系列」導流 | **已裁(08-08）：做** | ✅已裁→S9 |
| D9 | 浮水印 | **已裁（08-08）：不要**。產線腳本不留鉤子,單純轉檔 | ✅已裁 |
| D10 | rot_0~7（rotation 8 張） | data.js 有定義但全站未用。demo 期不急,真照片分類時一併定 | 低急 |
| D11 | v2 候選 | **雙語切換：已裁（08-08）＝要做**,排上線後 v2 第一項。每張照片說明／Fonts 自 host 仍 v2 再議 | 部分已裁 |
| D12 | 正式照片 | 各系列原檔（回家後供圖,長邊 3000px 高品質 JPEG）,連同分類/順序/各系列封面;哈蘇另供高解析檔餵 Deep Zoom;rot_0-7 用途一併定 | 等回家 |
| D15 | Work 磚 13 案例代表圖 | **已裁（08-08）：不抓 IG（登入牆/限流/畫質劣化三重坑）,改本機原檔**——每案例挑一張丟 `originals\work\`,動畫案例挑劇照;僅存在 IG 者本人手動存檔 | ✅已裁,等回家供圖 |
| D13 | 產線升級「高畫質快載」 | **已裁（08-08）：做**。AVIF+WebP 雙格式×800/1600/2560 三尺寸＋燈箱載 2560＋blur-up;原檔永不上網 | ✅已裁→S11 |
| D14 | 燈箱放大看細節 | **已裁（08-08）：做**。①標配縮放（點擊放大/平移/雙指,上限 2560）＝全站 ②Deep Zoom（sharp 切片＋OpenSeadragon 內嵌）＝**限哈蘇系列**,放一億畫素超大檔——本人已知悉磚塊可被拼回,明言「本來就有心都抓得下來」接受 | ✅已裁→S11 |

## 待解決

| # | 事項 | 依賴 | 狀態 |
|---|---|---|---|
| S1 | 靜態化改造＋SEO 包（規格 `_spec-static-v1.md`） | — | **已完成**（commit ebb679f） |
| S2 | 圖片產線腳本（資料夾→WebP 多尺寸→data 更新,demo 照片跑通） | S1 收工（對齊資料格式） | **已完成**：`ingest-photos.js`（sharp,EXIF 全剝,1600/800 雙尺寸）＋build 模板 srcset 偵測分支；demo 6 張實跑後已 revert |
| S3 | favicon＋OG 分享縮圖 | 併入 S1 | favicon **已完成**（手寫 `src-site\favicon.svg`,九頁相對路徑引用）；OG 專用分享圖仍用該頁 cover,待正式照片再議 |
| S4 | fresh verifier 對帳 | S1、S2 各一輪 | **已完成**：S1 棒 PASS（互動類 INCONCLUSIVE,實作者 25 斷言補位）＋S9/S2 棒 11/11 全 PASS（含產線實跑抽驗） |
| S10 | UI/UX 鑒定（使用者點名） | S9 收工 | **已完成**（過程曲折：opus 鑒定員超時兩次遭斬,量測數據+home/street 截圖為其遺產;14 張補拍=sonnet 快手;品味判讀=主對話執筆。報告 `_review-uiux-2026-08-08\report.md`：P0×2/P1×5/P2×3） |
| S11a | UI 修正包＋燈箱縮放（P0×2/P1×5/D14 標配） | 報告出爐 | **已完成**（commit d2a6609,verifier 對帳中）。亮點：nav 斷點實測放寬到 880px（721-880 帶原本也是壞的）;鑒定報告 P1-2 lazy:0 證實**誤測**（模板本就有 lazy）;燈箱鍵盤=Enter 縮放/`+−0`/Shift+方向鍵平移;demo 照片小,放大走 2× 保底,正式檔才走原生解析度 |
| S11b | 高畫質產線＋Deep Zoom（D13+D14 進階） | S11a 過 | **已完成**（commit a84e087,verifier 對帳中含 OpenSeadragon 完整性獨立驗證——安全監控旗標:OSD 內嵌屬 D14 已裁事項,零依賴鐵律是 HUD 的規矩非本站）。全站切 `<picture>` AVIF/WebP＋LQIP blur-up;photos 零 jpg;DZ 測試板 14 層;系列頁首屏 130-335KB。**遺留：work-featured 磚僅 WebP 無 image-set 退路** |
| D16 | Google Fonts 自 host 提前？ | S11b 實測:**字型是目前首屏最大剩餘成本**（Noto Serif JP 每頁 48-91 個子集請求）。三字型皆 OFL 授權可自 host（子集化 WOFF2）;原排 v2,實測數據支持提前。**成本考量留使用者裁**（今日用量已大） | 待答（08-08 數據到位） |
| S5 | portfolio repo 設 local git user.email＝jerrythepopper@gmail.com | D1 | **已完成**（user.name/user.email 皆設） |
| S6 | 上線流程：repo 轉 public → 啟 Pages（Actions 或 branch 發布 dist）→ DNS（D2 值我備妥）→ Enforce HTTPS → Search Console 登記 | 使用者說上線那天 | 排隊（萬事俱備） |
| S7 | humanizer skill 安裝（blader/humanizer v2.9.1, MIT） | — | **已完成**（C:\Users\User\.claude\skills\humanizer\） |
| S12 | 設計 skills 四件套安裝（jakubkrehel/skills, MIT, 3.2k★）：better-ui/typography/colors/accessibility 全檔含參考檔 25 檔 138KB,惡意模式掃描乾淨 | 使用者丟圖研究（20 項篩剩 3）| **已完成**（全域 skills）。另兩項可借概念：component.gallery（輪播/燈箱 a11y pattern）、transitions.dev（載入態手法）→ 併 S11 參考 |
| S8 | 部署後驗收：跨裝置截圖／OG 卡預覽／robots.txt 實測 | S6 | 排隊 |
| S9 | 裁決落地小刀：SITE_ORIGIN=`https://www.jerrythepopper.com`＋字誤二處（D5）＋Brands 30+（D6）＋系列頁尾導流（D8） | S1 收工後 | **已完成**（四項全落地,九頁 grep 驗過） |

## 已裁決存檔
- 2026-08-08：施工範圍「全做」（靜態化+SEO+產線+git init）；派工嚴格度=標準。
- 2026-08-08 批次裁決（本人遠端）：D2 網域=www.jerrythepopper.com／D3 限動連結保留／D5 修字誤／D6 展覽3檔+Brands改30+／D7 街址拿掉／D8 導流做／D9 浮水印不要／D11 雙語=要,排v2。未答：D1（GitHub CLI 裝否）、D4（系列文案材料）、D12（正式照片,等回家）。
- 2026-08-08：dithermobile（HUD 副案）整案不做——與本站無關,記於 HUD 記憶。
