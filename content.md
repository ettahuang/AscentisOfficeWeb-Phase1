AscentisTech 企業形象官網 - 產品需求文件 (PRD)
# AscentisTech 企業形象官網 - 產品需求文件 (PRD)
---
## 1. 產品概述
### 1.1 產品名稱
**AscentisTech 昇新科技企業形象官網**
### 1.2 產品目標
為新加坡商昇新科技股份有限公司台灣分公司建立專業的企業形象網站，展示公司服務、成就與企業文化，吸引潛在客戶與人才。
### 1.3 目標用戶
- 潛在企業客戶（尋求軟體開發服務）
- 求職者（了解公司文化與福利）
- 合作夥伴
- 現有客戶
---
## 2. 功能規格
### 2.1 網站架構
```
首頁 (index.html)
├── 導航列 (Navigation)
├── 首頁橫幅 (Hero Section)
├── 關於我們 (About Us)
├── 產品服務 (Services)
├── 榮耀成就 (Awards)
├── 員工福利 (Benefits)
├── 聯絡我們 (Contact)
└── 頁尾 (Footer)
```
### 2.2 核心功能
| 功能 | 說明 | 狀態 |
|------|------|------|
| 響應式設計 | 支援桌面、平板、手機 | ✅ |
| 雙語系統 | 英文（預設）/ 繁體中文 | ✅ |
| 語言切換器 | 一鍵切換語言，localStorage 記憶 | ✅ |
| 平滑捲動 | 錨點導航平滑捲動 | ✅ |
| Google Maps 嵌入 | 顯示公司地點 | ✅ |
| 社群連結 | Facebook、Instagram | ✅ |
---
## 3. 技術規格
### 3.1 技術架構
| 項目 | 技術 |
|------|------|
| 前端框架 | 純 HTML5 / CSS3 / JavaScript |
| 設計系統 | 自由發揮 |
| 字型 | 自由發揮 |
| 動畫 | 自由發揮 |
| 國際化 |  i18n.js 中英文雙語系 |
### 3.2 檔案結構
```
/專案資料夾/
├── index.html      # 主頁面結構
├── styles.css      # CSS 設計系統
├── script.js       # JavaScript 互動功能
├── i18n.js         # 多語系翻譯系統
```
---
## 4. 設計規格
- 設計自由發揮
---
## 5. 中英文內容對照表
### 5.1 導航列 (Navigation)
| Key | English | 繁體中文 |
|-----|---------|----------|
| nav.about | About Us | 關於我們 |
| nav.services | Services | 產品服務 |
| nav.awards | Awards | 榮耀成就 |
| nav.benefits | Benefits | 員工福利 |
| nav.contact | Contact | 聯絡我們 |
### 5.2 首頁橫幅 (Hero Section)
| Key | English | 繁體中文 |
|-----|---------|----------|
| hero.title.line1 | Leading Innovation | 引領創新 |
| hero.title.line2 | Building the Future | 打造未來 |
| hero.subtitle | Focused on building world-leading online software development platforms. Driving digital transformation through technological innovation | 專注打造全球領先的線上軟體開發平台。以技術創新驅動企業數位轉型 |
| hero.cta.explore | Explore Services | 探索服務 |
| hero.cta.contact | Contact Us | 聯繫我們 |
| hero.stat.experts | Professionals | 專業菁英 |
| hero.stat.awards | Agile Awards | 敏捷大獎 |
| hero.stat.support | Tech Support | 技術支援 |
### 5.3 關於我們 (About Section)
| Key | English | 繁體中文 |
|-----|---------|----------|
| about.title | About AscentisTech | 關於昇新科技 |
| about.desc | A team of elite talents with technical and data backgrounds, dedicated to creating exceptional software solutions | 匯集技術與數據背景的菁英團隊，致力於打造卓越的軟體解決方案 |
| about.card1.title | Professional Team | 專業團隊 |
| about.card1.desc | Elite talents with technical and data backgrounds, capable of high-performance architecture design and multi-language support | 匯集技術與數據背景的菁英，具備高效能架構設計與多語系支援能力 |
| about.card2.title | Self-Organizing Culture | 自組織文化 |
| about.card2.desc | Valuing teamwork, encouraging open communication, proactive participation, and cross-domain training | 重視團隊合作，鼓勵開放溝通、主動參與及跨域訓練 |
| about.card3.title | Pursuit of Excellence | 追求卓越 |
| about.card3.desc | Embracing AI technologies and innovative development methods, pursuing efficiency and flexibility | 樂於嘗試各類 AI 技術與創新開發方法，追求效率與彈性 |
| about.mission.title | Our Mission | 我們的使命 |
| about.mission.desc | AscentisTech focuses on developing and maintaining large-scale multinational websites. Through excellent technical capabilities and agile organizational culture, we provide the highest quality software development services to global clients. We believe that innovation and collaboration are the keys to driving business success. | AscentisTech 專注於開發及維護大型跨國網站，透過卓越的技術能力與敏捷的組織文化，為全球客戶提供最優質的軟體開發服務。我們相信，創新與協作是驅動企業成功的關鍵。 |
### 5.4 產品服務 (Services Section)
| Key | English | 繁體中文 |
|-----|---------|----------|
| services.title | Products & Services | 產品服務 |
| services.desc | Providing integrated one-stop solutions to help clients expand into global markets | 提供整合性一站式解決方案，助力客戶拓展全球市場 |
#### 服務 1：系統開發與技術支援
| Key | English | 繁體中文 |
|-----|---------|----------|
| services.card1.title | System Development & Technical Support | 系統開發與技術支援 |
| services.card1.desc | Providing 24/7 technical support, high-quality system planning and deployment to ensure your business continuity | 提供全天候技術支援、高品質系統規劃與部署，確保您的業務永續運營 |
| services.card1.feature1 | 24/7 Support | 24/7 全天候支援 |
| services.card1.feature2 | High-Performance Architecture | 高效能架構設計 |
| services.card1.feature3 | Rapid Deployment | 快速部署方案 |
#### 服務 2：資料分析與支援
| Key | English | 繁體中文 |
|-----|---------|----------|
| services.card2.title | Data Analytics & Support | 資料分析與支援 |
| services.card2.desc | Optimizing product experience and driving business decisions through data integration and modular analysis tools | 透過數據整合與模組化分析工具，優化產品體驗並驅動商業決策 |
| services.card2.feature1 | Data Visualization | 數據視覺化 |
| services.card2.feature2 | Business Intelligence Reports | 商業智慧報表 |
| services.card2.feature3 | Predictive Analytics | 預測分析模型 |
#### 服務 3：AI 技術導入
| Key | English | 繁體中文 |
|-----|---------|----------|
| services.card3.title | AI Technology Integration | AI 技術導入 |
| services.card3.desc | Developing recommendation systems and anomaly detection to enhance platform intelligence and user experience | 研發推薦系統與異常偵測，提升平台智慧化程度與用戶體驗 |
| services.card3.feature1 | Smart Recommendation Engine | 智慧推薦引擎 |
| services.card3.feature2 | Anomaly Detection | 異常行為偵測 |
| services.card3.feature3 | Process Automation | 自動化流程 |
#### 服務 4：全方位平台策略
| Key | English | 繁體中文 |
|-----|---------|----------|
| services.card4.title | Comprehensive Platform Strategy | 全方位平台策略 |
| services.card4.desc | Custom-built global software development platforms aligned with local operations to expand international markets | 量身打造符合在地營運的全球化軟體開發平台，拓展國際市場 |
| services.card4.feature1 | Multi-Language Support | 多語系支援 |
| services.card4.feature2 | Localization Strategy | 在地化策略 |
| services.card4.feature3 | Global Deployment | 全球部署 |
### 5.5 榮耀成就 (Awards Section)
| Key | English | 繁體中文 |
|-----|---------|----------|
| awards.title | Honors & Achievements | 榮耀成就 |
| awards.desc | Multiple honors at the 2025 Taiwan Agile Awards | 2025《台灣敏捷大賞》多項殊榮肯定 |
| awards.item1.title | Agile Organization of the Year | 年度敏捷組織 |
| awards.item1.desc | Recognizing outstanding achievements in organizational agile transformation | 表彰組織整體敏捷轉型的卓越成果 |
| awards.item2.title | Agile Team of the Year | 年度敏捷團隊 |
| awards.item2.desc | Acknowledging team collaboration efficiency and delivery quality | 肯定團隊的協作效率與交付品質 |
| awards.item3.title | Change Leader of the Year | 年度變革引導者 |
| awards.item3.desc | Praising leadership in driving organizational change | 讚揚推動組織變革的領導力量 |
| awards.item4.title | Agile Evangelist of the Year | 年度敏捷傳教士 |
| awards.item4.desc | Honoring contributions to spreading agile principles | 表揚推廣敏捷理念的傳播貢獻 |
| awards.banner.title | Continuous Innovation, Pursuit of Excellence | 持續創新，追求卓越 |
| awards.banner.desc | With agile culture at our core, we continuously break through boundaries to create maximum value for our clients | 我們以敏捷文化為核心，不斷突破自我，為客戶創造最大價值 |
### 5.6 員工福利 (Benefits Section)
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.title | Employee Benefits | 員工福利 |
| benefits.desc | Comprehensive benefits system for a happy workplace | 優渥完善的福利制度，打造幸福職場 |
#### 獎金禮品
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.cat1.title | Bonuses & Gifts | 獎金禮品 |
| benefits.cat1.item1 | Year-End Bonus | 年終獎金 |
| benefits.cat1.item2 | Festival Bonuses/Gifts | 三節獎金/禮品 |
#### 休假制度
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.cat2.title | Leave Policy | 休假制度 |
| benefits.cat2.item1 | Weekends Off | 週休二日 |
| benefits.cat2.item2 | Birthday Leave | 生日假 |
| benefits.cat2.item3 | Paid Sick Leave | 不扣薪病假 |
| benefits.cat2.item4 | Extra Annual Leave | 優於勞基法特休 |
#### 生活機能
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.cat3.title | Office Perks | 生活機能 |
| benefits.cat3.item1 | Snack Bar | 零食櫃 |
| benefits.cat3.item2 | Coffee Bar | 咖啡吧 |
| benefits.cat3.item3 | Free Afternoon Tea | 免費下午茶 |
| benefits.cat3.item4 | Employee Massage | 員工舒壓按摩 |
#### 補助聚會
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.cat4.title | Events & Subsidies | 補助聚會 |
| benefits.cat4.item1 | Travel Subsidy | 旅遊補助 |
| benefits.cat4.item2 | International Travel | 國外旅遊 |
| benefits.cat4.item3 | Team Dinners | 部門聚餐 |
| benefits.cat4.item4 | Birthday Parties | 慶生會 |
#### 關懷禮金
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.cat5.title | Care Allowances | 關懷禮金 |
| benefits.cat5.item1 | Wedding Gift | 結婚禮金 |
| benefits.cat5.item2 | Birth Allowance | 生育津貼 |
| benefits.cat5.item3 | Hospitalization Allowance | 住院慰問金 |
#### 保險保障
| Key | English | 繁體中文 |
|-----|---------|----------|
| benefits.cat6.title | Insurance | 保險保障 |
| benefits.cat6.item1 | Labor & Health Insurance | 勞健保 |
| benefits.cat6.item2 | Group Insurance | 員工團體保險 |
| benefits.cat6.item3 | Health Checkup | 員工體檢 |
### 5.7 聯絡我們 (Contact Section)
| Key | English | 繁體中文 |
|-----|---------|----------|
| contact.title | Contact Us | 聯絡我們 |
| contact.desc | Get in touch with us to explore endless possibilities | 歡迎與我們聯繫，開啟合作的無限可能 |
| contact.address.title | Office Address | 公司地址 |
| contact.address.value | 7F, No. 103, Ruihu St., Neihu Dist., Taipei City, Taiwan | 台北市內湖區湖元里瑞湖街103號7樓 |
| contact.industry.title | Industry | 產業類別 |
| contact.industry.value | Computer Software Services | 電腦軟體服務業 |
| contact.team.title | Team Size | 團隊規模 |
| contact.team.value | 65 Professional Partners | 65 位專業夥伴 |
| contact.social.title | Follow Us | 追蹤我們 |
### 5.8 頁尾 (Footer)
| Key | English | 繁體中文 |
|-----|---------|----------|
| footer.slogan | Leading Innovation, Building the Future | 引領創新，打造未來 |
| footer.copyright | © 2026 AscentisTech. All Rights Reserved. | © 2026 AscentisTech 昇新科技. All Rights Reserved. |
---
## 6. SEO 與 Meta 資訊
### 6.1 英文版
```html
<html lang="en">
<title>AscentisTech | Leading Innovation in Software Development</title>
<meta name="description" content="AscentisTech - Building world-leading online software development platforms, providing system development, data analytics, and AI technology solutions">
<meta name="keywords" content="AscentisTech, software development, AI, system development, data analytics">
```
### 6.2 中文版
```html
<html lang="zh-Hant-TW">
<title>AscentisTech 昇新科技 | 引領創新的軟體開發夥伴</title>
<meta name="description" content="AscentisTech 昇新科技 - 專注打造全球領先的線上軟體開發平台，提供系統開發、資料分析、AI 技術導入等一站式解決方案">
<meta name="keywords" content="AscentisTech, 昇新科技, 軟體開發, AI, 系統開發, 資料分析">
```
---
## 7. 公司資訊
| 項目 | 內容 |
|------|------|
| 公司名稱 | 新加坡商昇新科技股份有限公司台灣分公司 |
| 英文名稱 | AscentisTech Pte. Ltd. Taiwan Branch |
| 產業類別 | 電腦軟體服務業 |
| 員工人數 | 約 65 人 |
| 公司地址 | 台北市內湖區湖元里瑞湖街103號7樓 |
| Facebook | <https://www.facebook.com/AscentisTech> |
| Instagram | <https://www.instagram.com/ascentistech> |
---
**文件結束**

