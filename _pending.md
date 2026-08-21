# 作品集網站 待辦帳本（2026-08-08 起記；裁決＝要 Jerry 點頭或出材料，解決＝工程照做）

## 待裁決

| # | 事項 | 說明 | 狀態 |
|---|---|---|---|
| D1 | GitHub 連線 | **已完成（08-08）**：gh 2.97.0 zip 版住 `C:\Users\User\Tools\gh\`（winget MSI 卡 UAC 改道）;device flow 手機授權成功（帳號 Jerrythepopper,scopes repo/gist/read:org）;repo `Jerrythepopper/jerrythepopper-portfolio` **PRIVATE** 已推 4 commits | ✅完成 |
| D2 | 網域名稱 | **已答（08-08）：`www.jerrythepopper.com`**。canonical 用 www。**08-08 實查：DNS 已在 Cloudflare 代管**（NS=serenity/clint.ns.cloudflare.com,現指 Squarespace 主機 198.185.159.x）——上線日動 Cloudflare 不動 Squarespace;無 MX 零誤傷;AI 爬蟲三類開關免費可用。**回家先確認 Cloudflare 帳號登入**;舊 Squarespace 站切換即下線,要留念先看 | ✅已裁（帳號存取待確認） |
| D3 | Work 頁 IG 限動連結 | **已裁（08-08）：保留**——那些內容只發在限時,沒有貼文版可換。風險已知悉（未登入訪客可能吃登入牆）,維持原連結 | ✅已裁 |
| D4 | 各系列補中文自述 | **08-08 晚材料到位**：街拍/自然/底片/3D 四段使用者親筆已收,原文+輕修版存 `_content-draft.md`（⚠自然段「幾乎→記下」待確認原意）;**缺人像一段**;定稿後主對話親自套 data.js（等 S15 收工） | 材料 4/5,待定稿 |
| D22 | Work 加線上課程磚 | **URL 到手（08-08）**：`https://www.yottau.com.tw/course/intro/1421#intro`——Yotta 磚連結由 IG reel 改連課程頁 | ✅已裁→套用中 |
| D23 | 照片 alt 描述由 AI 代筆 | **已裁（08-08）**：alt 隱形描述正式照片進站時逐張寫;**hover「No. 001」編號小標=使用者裁拆** | ✅已裁→拆除中 |
| D5 | 《輪轉》字誤 | **已裁（08-08）：修**——「希希望」→「希望」、「查覺」→「察覺」 | ✅已裁→S9 |
| D6 | About 數據 | **已裁（08-08）**：展覽＝3 檔（本人確認）,「50+ Brands」→「**30+**」,12 Years 不動 | ✅已裁→S9 |
| D7 | About 工作室街址 | **已裁（08-08）：拿掉**（Email/IG 保留） | ✅已裁 |
| D8 | 系列頁尾「下一個系列」導流 | **已裁(08-08）：做** | ✅已裁→S9 |
| D9 | 浮水印 | **已裁（08-08）：不要**。產線腳本不留鉤子,單純轉檔 | ✅已裁 |
| D10 | rot_0~7（rotation 8 張） | data.js 有定義但全站未用。demo 期不急,真照片分類時一併定 | 低急 |
| D11 | v2 候選 | **雙語切換：已裁（08-08）＝要做**。**深色模式：08-09 使用者提問,Fable 評=可做且對攝影站加分,排 v2（比雙語便宜可排前）**。每張照片說明／Fonts 自 host 仍 v2 再議 | 部分已裁 |
| D25 | 背景漸層 vs 純色 | **已裁（08-09）：純色**（「好那不要漸層XD」）。零改動,現狀即終稿 | ✅已裁=維持現狀 |
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
| D16 | Google Fonts 自 host？ | **已裁（08-08）：保持現狀不自 host**。Google Fonts 維持全站唯一外部請求;若日後嫌慢再翻案 | ✅已裁=不做 |
| S5 | portfolio repo 設 local git user.email＝jerrythepopper@gmail.com | D1 | **已完成**（user.name/user.email 皆設） |
| S6 | 上線流程：repo 轉 public → 啟 Pages（Actions 或 branch 發布 dist）→ DNS（D2 值我備妥）→ Enforce HTTPS → Search Console 登記 | 使用者說上線那天 | 排隊（萬事俱備） |
| S7 | humanizer skill 安裝（blader/humanizer v2.9.1, MIT） | — | **已完成**（C:\Users\User\.claude\skills\humanizer\） |
| S12 | 設計 skills 四件套安裝（jakubkrehel/skills, MIT, 3.2k★）：better-ui/typography/colors/accessibility 全檔含參考檔 25 檔 138KB,惡意模式掃描乾淨 | 使用者丟圖研究（20 項篩剩 3）| **已完成**（全域 skills）。另兩項可借概念：component.gallery（輪播/燈箱 a11y pattern）、transitions.dev（載入態手法）→ 併 S11 參考 |
| S8 | 部署後驗收：跨裝置截圖／OG 卡預覽／robots.txt 實測 | S6 | 排隊 |
| S9 | 裁決落地小刀：SITE_ORIGIN=`https://www.jerrythepopper.com`＋字誤二處（D5）＋Brands 30+（D6）＋系列頁尾導流（D8） | S1 收工後 | **已完成**（四項全落地,九頁 grep 驗過） |

| D19 | 大自然分頁（第 7 系列） | **已裁（08-08）：做**——S15 棒進行中（Nature 自然,插 street 後,demo 佔位 10 張,編號全站順移）。**待使用者：真照片＋名稱確認＋2-3 句介紹（D4 併）** | ✅已裁→S15 |
| D20 | 首頁 hero 換雲影片循環 | **已裁（08-08）：做**。工程方案定案（首幀 AVIF 秒開→首屏後串流→手機 720p→reduced-motion 靜圖）。**卡在材料：10-20 秒最高畫質原片**,到位即動工 | ✅已裁,等原片 |
| D17 | 聯絡動線（接案 CTA） | footer 或系列頁尾加低調「Available for commissions」——涉及站主要不要主動招客 | 待答（08-08 提案） |
| D18 | 隱私友善流量統計 | **已裁（08-08）：要**。方案：上線 HTTPS 憑證發下後,Cloudflare DNS 切橙雲（proxied）→ 免費 Web Analytics（無 cookie 零程式碼）＋**同一步順手開 AI 爬蟲 Training 封鎖**（護圖進階版）——一次設定兩願望。已寫進上線卡 | ✅已裁,排上線後 |
| S13 | 自訂 404 頁（同站氣質,GitHub Pages 支援 404.html） | 上線前後皆可 | 排隊（小工） |
| S16 | **產線色彩管理** | S15 後 | **已完成**（fade008,verifier 獨立複跑 5/5）。**實測反轉：真病灶=16-bit 帶 profile 輸入**（引擎內部繞 P3 再剝檔→ΔE 2.1-3.9 可辨偏色）,8-bit 本來就會自動轉;修後 0.4/1.2 達標;demo 重跑逐位元組不變;AVIF 2560 升 4:4:4（拷問圖 ΔE 4.6→0.26,檔僅+0.6%）;`verify-color.js`=可重複比色儀（每批照片轉完可跑）。**上稿須知：匯出必勾「嵌入色彩描述檔」**（無 profile 的檔案無從判別色彩空間）;WebP smartSubsample +11% 檔案,在意流量可單獨回退 |
| D21 | hero 影片輪播方式 | **已裁（08-08）：A＝每次來訪輪值一支**（localStorage 計數器,無轉場,單支循環到底）。**08-09 補裁：循環接點＝硬回切**（使用者:「錄像帶循環的誠實感」,否決片內融接）。原片已到：三支 4K H.264 **BT.709 SDR ✓** 10.5/12.5/18.5s（規格教科書級） | ✅全裁,S21 排隊 |
| S14 | 專用 OG 分享圖 1200×630 | D12 正式照片定案後 | 排隊 |
| S18 | 照片排序工作台 `sort-studio.html`＋產線三層順序決定鏈＋cover→coverIdx | 使用者 08-09 凌晨提需求 | **已完成**（a9bb03f,verifier 6/6） |
| S19 | 排序台效能優化（320px 縮圖化＋transform 拖曳） | 使用者實用回報卡頓 | **已完成**（03f35d7,掉幀 8→0;**事故記錄:實作者 taskkill /IM node 全域轟炸誤殺預覽伺服器,已入教訓**） |
| S20 | **真照片全量入站**（233 張七系列+Work15磚+About肖像+哈蘇DZ×3真檔） | 使用者交付母帶 | **已完成**（a31527c,verifier 9/9 含像素級順序比對;.gitignore Big5 編碼雷實錘修復;photos 464MB/.git 549MB;4 張 Work 磚原圖偏小待換） |
| S21 | 雲影片 hero | S20 過驗 | **已完成**（99b4a16+ae29d24）。三支 ≤7MB/色準逐幀驗（cloud-2 碎光顆粒項誠實 FAIL=顆粒保留度非色偏,盲測無感,已收）;輪值四連開/reduced-motion 零請求/390 走 720 版全實測;**首播=積雲**（站主指定,實作者用檔名對調法落地——主對話一度反轉陣列險相消,實體 duration+海報比對實證後收官）;LCP 海報 preload 進 head |
| D26 | 233 張照片豪華版 alt | **已裁（08-09）：做**——四路看圖隊平行中（hb+st/td/pt+na/fm+mk）,寫法紀律=只寫看得見/不編地名/人像不具名/禁AI腔;回齊後主對話合併接線 | ✅已裁,進行中 |
| D27 | 哈蘇 DZ 擴編 | **已裁（08-09）：加入模式共 9 張**（現役 3+親選 6:idx 3/10/13/23/34/36,全 ≥7430px 驗格）——S22 切磚中 | ✅已裁→S22 |
| S23 | 燈箱 DZ 轉乘鈕＋**瀑布流閱讀順序修正** | 使用者實測抓兩洞（08-09）：①燈箱翻到 DZ 照片無入口→計數器旁浮 DEEP ZOOM ↗ 鈕 ②masonry 用 CSS columns=先填滿左欄,前 5 張全在左=違反策展順序→改左右交錯發牌（1左2右3左...,五個 masonry 系列頁全修,手機單欄零影響） | S22 收工後 |
| S24 | 深色模式 | **選色定案（08-09）：#1F1D1A 暖墨黑**（兩輪對照後回歸 1 號「還是1好了XD」——米白紙感的暗房版,近中性護色準）。prefers-color-scheme 自動跟隨;完整深色系統（襯線/細線/毛玻璃/LQIP 底色全重調） | S23 收工後即開工 |
| S23+ | DZ viewer 左右導航（08-09 使用者抓洞#3） | ←→=切換 DZ 作品＋‹› 鈕＋提示更新 | ✅併 S23 完成 |
| S25 | **iOS 真機修正包**（08-09 使用者 iPhone 實測四洞）：①hero 影片 iOS 不自動播（屬性三件套+顯式 play+首觸補救;低電量模式=海報降級屬預期）②燈箱加左右滑手勢（未放大=換張,放大=平移）③**DZ/燈箱攔截 iOS 頁面級雙指縮放**（「螢幕噴飛回不來」重症）④About Email/IG 真連結 ⑤手機海報升檔 @1440 ⑥DZ 說明行 ⑦DZ 第 10 張 hb_29 ⑧**建置期中文分詞斷行**（Intl.Segmenter＋.nb spans,朱銘美術館/紀實計畫/畫面的重量等永不腰斬;About+七系列 subtitle+首頁宣言;justify 限內文）⑨刪 Stairs Space 三處 | 施工中追加至九合一 | **已完成**（8cfc3f9,九項全 PASS,已推;真機待複測:影片自動播/手勢鎖/滑動手感） |
| S26 | **SEO 關鍵字植入包**（08-09 定稿待施工）：A.首頁 title=「Jerrythepopper 洪立楷｜台北攝影師・3D 創作者｜攝影作品集」B.首頁 description=「台北攝影師、3D 創作者洪立楷（Jerrythepopper）的個人作品集——人像、街拍、底片、自然攝影與 3D 視覺創作，曾與 Hasselblad、Leica、Sony 等品牌合作。」C.About 加句（版本三）=「以台北為基地，接受台灣與世界各地的攝影與 3D 視覺委託。」D.3D 頁 title=「3D 視覺創作 CGI｜Jerrythepopper」+描述含 台灣 3D 視覺/CGI/場景設計;JSON-LD knowsAbout+areaServed TW+國際 | S24 收工後 | 排隊（文字全定稿） |
| S24 | **深色模式史詩棒**（施工中吸收熱插至 21 工項） | S25 收工 | **已完成**（853981c,verifier 對帳中）。深色 #1F1D1A 全站/主文對比 13.39:1/零白閃;切換鈕（雙位置+localStorage+350ms 過渡+防閃腳本）;亮場逐像素 0.00000 零回歸;DZ 慣性約束（拒收主對話的 0.85=實讀 vendor 判 1 更嚴,自主裁量正確）;brands 疊字真因=分詞 span 被 grid 當格子,包容器修;七處文案+刪立體+404 絕對路徑（順手修的**正式站真 bug**）;Range+信標。**用量 32 萬=單棒紀錄** |
| D24 | 真照片首批 270 張的三個問題 | ①travel（NY16/tokyo18）開新系列或併入？②底片 120/135 子資料夾合流或分組？③street 1000px/人像 750px 是小圖匯出——原檔重出長邊 3000？（travel 2500 可用;ICC 全有嵌=色準 OK）;缺哈蘇/3D/自然/雲影片 | 待答（08-09 00:40 提問） |
| B1 | 《輪轉》敘事頁擴充（過程/出版/募資故事）＝v2 內容資產最大機會 | 使用者供材料 | v2 構想 |

| S27 | SEO 微調（SEOptimer 報告有理項）：title 47 字（站主定版）+desc 122 字 | 報告審讀 | **已完成**（668f723） |
| S28 | OG 分享圖方形化：1200×1200 智慧裁切×10 頁+絕對網址（S14 落地） | 站主要求 | **已完成**（b34c099,直幅裁切目視驗證） |
| S29 | **英文版全站** | 站主「一鼓作氣」 | **已完成上線**（eb1f840）：/en/ 11 頁,57 句零偏差,hreflang 80 斷言全中,中文版零刪除;施工自抓一蟲（EN 首頁圖 404 路徑）;**留裁×2：①About 品牌清單中文 vs 段落英譯不一致 ②燈箱/DZ 操作提示仍中文**（v1 取捨） |
| S30 | 字型載入鏈（@import→head preconnect+link,dist 轉換源檔凍結） | Cloudflare 報告有理項 | **已完成**（ff03fe5）：像素差 0.0-0.4/255=字體分毫未動實證;FCP 首頁 -176ms/哈蘇持平（誠實回報） |
| — | Cloudflare 快取規則（/photos/+/video/ 邊緣+瀏覽器 TTL 1 個月） | Cloudflare 報告有理項 | **已完成**（使用者部署,配置逐項核對） |
| — | SPF/DMARC 防冒名 TXT ×2 | SEOptimer 有理項 | **已完成**（使用者貼,1.1.1.1 實查生效） |

| S31 | 資產快取指紋 ?v=雜湊（根治新 HTML+舊 CSS 時間差;Safari 切換鈕漂移案結案） | 使用者 Safari 抓洞 | **已完成**（9d9a103） |
| S32 | 觸控板縮放手感（Mac 實測）＋Android 360 重疊 | 使用者 Mac/Android 抓洞 | **已完成**（5ecbb8f）：捏合接住（ctrlKey wheel+Safari gesture）/滾動改 deltaY 比例式（暴衝→平滑,幾何比率與公式精確吻合）/滑鼠零波及/wordmark 尾段 ≤385px 讓位。**真機待複測:Mac 捏合手感/Safari 手勢/Android 重疊** |

## 已裁決存檔
- 2026-08-09 15:09 **影片懸案破案**：iPhone hero 影片不播的兇手=preview-server.js 無 HTTP Range 支援（iOS AVFoundation 對不回 206 的伺服器拒播;桌機寬容故未露餡）。S24 補上 Range 後真機實證播放 ✓。**正式站 GitHub Pages 原生支援 Range=此蟲不存在於產線**。站主 iOS 設定/影片編碼/播放程式碼全數無辜。
- 2026-08-09 文案終審（全站定稿）：Rolls-Royce 磚分類「品牌形象拍攝」確認✓;人像句「喜歡」保留（情感本體非冗字）;哈蘇「這兩次」保留（第三次合作時再改）;大自然人稱全站統一「他們」;S24 十八工項含全部文字更正。
- 2026-08-08：施工範圍「全做」（靜態化+SEO+產線+git init）；派工嚴格度=標準。
- 2026-08-08 批次裁決（本人遠端）：D2 網域=www.jerrythepopper.com／D3 限動連結保留／D5 修字誤／D6 展覽3檔+Brands改30+／D7 街址拿掉／D8 導流做／D9 浮水印不要／D11 雙語=要,排v2。未答：D1（GitHub CLI 裝否）、D4（系列文案材料）、D12（正式照片,等回家）。
- 2026-08-08：dithermobile（HUD 副案）整案不做——與本站無關,記於 HUD 記憶。

---
# 🚀 2026-08-09 16:08 正式上線
https://www.jerrythepopper.com — Pages 部署 1m8s 成功;www/apex/子頁全 200;HTTPS 憑證即時簽發+強制導向已開。DNS 三項使用者自力完成一次到位（含 TXT 防搶掛）。
## 上線後清單（擇日,不急）
1. Cloudflare 橙雲三件套（第 5 步:proxied+Web Analytics+AI Training 封鎖）——建議明天後（讓憑證/快取穩一天）
2. Google Search Console 登記+提交 sitemap
3. Google 商家檔案（台北攝影師地圖區側門）
4. IG bio 連結確認（原本就指 jerrythepopper.com=自動繼承 ✓）
5. 真機最後巡禮:正式網域上的影片/DZ/深色（理論上與區網同,Range 在 Pages 原生支援）

## 上線後清單執行記錄（2026-08-09 16:25 全數完成）
1. ✅ 橙雲三件套：proxied 生效（cf-ray KHH 高雄節點）+SSL Full strict+Web Analytics 啟用+AI 爬蟲（Search/Agent 放行,Training 全頁封鎖——預設「僅廣告頁」已改「全部」）
2. ✅ Search Console：沿用既有已驗證資源;備援驗證=google-site-verification meta 入全站 head（c802900,60 秒部署;舊 HTML 檔案憑證綁 Squarespace 已死,雙憑證保險成立）;sitemap.xml 重新提交（紅字「無法擷取」=五月舊殘影,等 Google 重抓翻綠）
3. 餘:Google 商家檔案（使用者擇日,Fable 陪跑）;IG bio 已天然指向網域 ✓

---
# ✅ 2026-08-09 18:21 跨裝置終驗全過（站主親測）
Mac 觸控板捏合+平滑縮放 ✓／Safari 手勢 ✓／Android 360 重疊修復 ✓——iPhone/Mac/Android 三裝置品保循環全數綠燈。S1-S32 全數收官。

# ⚠️ 2026-08-09 18:50 重大事故與救援（傳世教訓）
**Cloudflare AI Training 全頁封鎖會連 Googlebot 一起擋（403）**——Googlebot 是「搜尋+訓練雙重身分」爬蟲,UI 警語有寫但被輕看;上線兩小時即被站主的網址審查抓到。修復=Training 改回「Block on pages with ads」（零廣告站=實質放行）;訓練防線本來就由 robots.txt 承擔（GPTBot/ClaudeBot/CCBot/Google-Extended,正規管道不傷搜尋）。18:53 測試線上網址=綠色「可建立索引」+影片探索偵測到影片。**教訓：動 AI 爬蟲開關後必須立刻用 Search Console 實測 Googlebot 通行。**

| S33 | DZ 擴編 10→20 張（站主逐張親審:換將三張後定案 idx 0/8/14/15/17/18/20/24/38/43 新增） | 站主「心很癢」 | **已完成**（5a1f464）:切片 +169MB,dist 總量 813MB（<950 停手線）;中英各 20 角標/←→ 環狀切換 20 張實測;**再擴編需先開 R2 逃生梯**（帳本備忘） |

| S34 | 手機導覽空間工學（JTP 縮寫=站主慣用/鈕群靠邊/垂直 0px 對齊） | 站主 iPhone 抓洞 | **已完成**（3ad9601）:可滑動窗 101→282px（2.8×）;+200 指標差 19px=實作者拒犧牲 44px 熱區,裁量正確 |
| S35 | 橫向瀏海滿版（viewport-fit=cover+29 條 env() 安全區退讓,全帶 fallback） | 站主橫向抓白邊 | **已完成**（3efee78）:一般環境逐位元組零回歸;真機瀏海效果待站主複測 |
| S36 | 導覽三層墨色（工具層 0.65+hairline 分隔「ABOUT│EN」）＋Android 橫滑護欄（overflow-x clip+長字串兜底） | 站主設計提問+Android 抓洞 | **已完成**（6fd567c）:fixed 定位零副作用實證;可滑窗僅縮 8px;Android 實效待真機複測 |
| D28 | 訪客自選 gallery 欄數（1/2/3） | **已裁（08-10）：不做,維持現狀**——客觀評估:技術可行不反直覺,但使用率預估 <5%/策展主權讓渡/手機無意義=價值密度低;「特定系列調預設欄數」備選也暫不動。v2 冷凍庫,待流量數據翻案 | ✅已裁=現狀 |
| S37 | 區塊間生長細線（貴船語彙:1px×56px 40% 墨,捲入時由上而下畫出;首頁 8 條+系列頁 Next Series 前各 1;中英明暗全套） | 站主核准（回到參考站初心） | **已完成**（87ee90b）:頁高前後差 0px=負 margin 精準吸收;reduced-motion 靜態;CSSOM 規則序驗證 |
| S37b | 細線四連裁（08-10 站主截圖迭代）：呼吸掃落動畫（201235e）→72px+貼下一區塊（b2db690）→z-index:1 修被區塊背景蓋掉（db9989b）→整條垂進下一格 0/-72（c8558c5）→分尺寸長度桌機72/手機48=單一 --flow-len 變數（f33f472） | 站主逐輪真機複裁 | **已完成**:每輪頁高零位移實測;keyframes 吃 var() 分斷點解析 |
| S38 | 3D 前移到人像後（首頁區塊+NAV+導流鏈同步,重編號 3D→03/街拍→04/自然→05;網址不動 SEO 零影響） | 站主裁:標題寫 3D 創作者,內容第三格就要兌現 | **已完成**（3079b6d）:中英首頁實渲染序+系列頁導流鏈逐頁核對 |
| S39 | CTA+EN 小收尾三件套：①foot-hire 改雙語版（中文頁講中文,Open for commissions—攝影・3D 委託合作）②Work 頁尾新 CTA 塊（有案子想聊？/Have a project in mind?）③site.js 燈箱/DZ 提示 21 條 T() 字典在地化（zh 零回歸=結構保證:T 第二引數即中文原字）④About 品牌英文頁改官方英名（Juming Museum/GOOPiMADE/Shopee/Giant/TAPMC=研究員逐一附一手來源;名發/三發/晶悅查無官方英名→保留中文寧可留白不猜譯） | 站主 08-11 核准（品牌名「怕錯」→只收官方自稱） | **已完成**:fresh verifier 八項全 PASS（含 vm 實跑 T() 雙分支+dist diff 對帳） |

| S40 | Mac DZ lag 修正：呼吸線動畫 top→transform（top=版面屬性,8+1 條無限循環每格逼主執行緒重算 layout;Safari+觸控板高頻 wheel 雙重夾擊先跪,Chrome/手機扛得住=只 Mac 卡的解釋）——flow-rule 與 hero hint-line 同罪同修,translateY ±100% 自高解析=行程逐像素同舊版,keyframes 不再需要 var() | 站主 08-11 Mac 實測回報 | **已完成**:9 條動畫 running+top 固定 0 實證;待站主 Mac 回測確認 lag 消失 |

| S41 | 深色白線+預設淺色（站主 08-11 iPhone 回報+裁定）：①白線元兇=LQIP 佔位圖鋪容器背景,高 DPR 次像素縫透出亮邊,深色底現形→照片載完拆背景圖（只拆有 img 子元素的盒,work-tile .ph 背景本體自然跳過;載入失敗留殘影）②預設主題改淺色不跟系統（防閃腳本一律蓋 data-theme,無存偏好=light;theme-color meta 去 media 隨主題動態設） | 站主：淺色是本站的臉 | **已完成**:預設 light/theme-color/切換往返/LQIP 載完拆除四路實證;待站主 iPhone 深色回測白線消失 |

| S42 | 深色換膚：暖墨→鉄御納戸 #15161D（站主看四案日本傳統色仿真比較頁後裁定案2「美到不行」;砂鼠 #28292D 夾層/冷紙白 #E4E6EA/muted 4.90:1 faint 2.79:1 忠實對映舊層級,燈箱/DZ/frosted/hero 全家族同步轉冷;theme-color 兩處 #15161d）；字面值只住 patch.css 一區塊=換膚只動 17 行+2 hex | 站主 08-11 案2 定案 | **已完成**:preview 切深色實測牆/alt/文字/CTA 四值逐一命中;比較頁 dark-variants.html 留 scratchpad |

| S43 | Mac DZ 縮放卡頓三刀（站主分兩輪回報:一般縮放卡→修後只剩深放大卡）：①wheel/捏合 rAF 合流（每秒近百發逐發 zoom→每幀至多一次,20:1 實測,倍率 ulp 級等價）②blendTime 0.25→0（tile 淡入混合每幀成本歸零）③immediateRender true（深放大先用低解析撐畫面,不再等高解析=停滯感來源;OSD navigator 內建就是這組合）;spring 0.9/7 經論證守住站主手感不動 | 站主 Mac 實測回報+核准 tile 級旋鈕（知情「先糊再清」代價） | **②③二刀已退回**（站主三裝置回測:Mac 無感=瓶頸不在混合層,且「一格一格」裸露各裝置皆見=淡入是遮參差的功臣）;①rAF 合流保留（有效無代價）;深放大殘卡=已知現況,追加優化前先做 drawer 型別診斷;若仍卡→下下層診斷卡:先查 drawer 型別（OSD 6.1 auto 預設優先 WebGL）,canvas→smoothTileEdgesMinZoom:Infinity（觸發條件正好=「放大較大時」）,webgl→maxZoomPixelRatio 2→1/minPixelRatio 0.8/maxTilesPerFrame 調大（分開試）;fmtZoom 每幀 DOM 寫入可加「值沒變不寫」零風險順手刀 |

| S44 | 233 張照片英文 alt 全補（v1「EN 沿用中文」取捨清償）：五隊看圖 agent 平行逐張實看撰寫（非盲翻,60-125 字元,禁 A photo of 開頭）→photo-alts-en.json 同鍵結構,altOf 英文頁優先查 EN→退中文→退系列名;順帶抓出並修正中文 alt 兩處錯置（pt_17 實為河岸拱橋非櫻花/pt_21 實為櫻花白衣非山間外套,親眼複核）+多處小出入以畫面為準 | 站主 08-14 核准燒剩餘扣打 | **已完成**:中英各 233 句抽驗全中,唯一殘留中文=輪轉書名合理保留 |
| S45 | 字型子集化＋亮場 muted 對比（08-21,外部評論對照稽核引出）：①Noto Serif JP 原走 Google 預設 unicode-range 切片,線上實測 /street/ 一頁 400/500 各 34 片＝3,048KB＋339KB 字型 CSS＝全站第一大資源（比 hero 影片重）→build 期收集全站實際字元走 css2 `text=`（**實測規則：text= 只對單一家族請求生效；超過 800 字被靜默忽略、回全量切片而非錯誤**）→Noto 獨立 link、可見文字 600 字 1 段（首屏拉,本機實測 458KB/2 檔）＋僅屬性 830 字 2 段（按需;燈箱 alt 進 img 屬性不渲染＝平時 0 byte）;剝零使用的 Jost 300/Noto 600（全站 font-weight 只有 400/500,線上 loaded=0）;`verify-fonts.js`＝build 後實抓驗證器（每條 faces=2／unicode-range 聯集涵蓋 1430 字漏 0／≤750 字）②`--color-text-muted` #95979c→#6a6c74（patch.css 檔尾覆寫,styles.css 零觸及;#f7f7f7 4.89:1／_alt 4.63:1,與暗場 4.90 對稱;faint 不動同暗場取捨）。D16「不自 host」維持,Google Fonts 仍是唯一外部資源 | 站主讀外部 vibe-coding 評論後點名修 | **已完成**（commit 見 git log S45;fresh verifier 對帳） |
| S46 | 安全標頭（08-21,同日資安自查：程式面零不可信輸入/innerHTML 三處皆自家資料過 attr()/外連全 noopener/照片 EXIF 全剝/零 cookie/repo 零機敏,唯一缺口＝回應標頭全缺）：站主在 **Cloudflare → Rules → Overview → Response Header Transform Rule**（規則名 security-headers,All incoming requests,Set static）加五條：HSTS max-age=31536000;includeSubDomains／X-Content-Type-Options nosniff／X-Frame-Options DENY／Referrer-Policy strict-origin-when-cross-origin／Permissions-Policy camera=(),microphone=(),geolocation=(),payment=()。**標頭住 Cloudflare 不在 repo**（GitHub Pages 不能設標頭）;第一次誤建 Request 型已刪、Add static 曾讓每條重複兩份已改 Set。CSP 刻意未設（2 段 inline script＋42 inline style,需 build 期算 hash,另開棒） | 站主問「資安都還好？」 | **已完成**（curl 實證五條各一份,首頁/系列頁/CSS 皆回） |

**S39 待辦尾巴**：①`_content-en-draft.md` 未同步 Work CTA 兩句新英文（data-en.js 已加註解記錄例外,回頭補檔保持「兩邊一致」紀律）②~~淺色模式 muted 小字對比 2.73:1~~ → **S45 已修**（#6a6c74,4.89:1）③repo 根目錄 01.pdf（7MB,08-09 SEOptimer 報告誤留）未追蹤未進版控,問站主要不要刪。
