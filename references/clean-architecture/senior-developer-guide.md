# 資深開發者與 Team Lead 指南

> **目標讀者**: 資深開發者、Team Lead
> **文件用途**: 架構決策、技術領導、團隊協作參考
> **最後更新**: 2025-01

---

## 架構原則 (Architecture Principles)

### 核心原則速查表

| 原則 | 決策指南 | 警示信號 |
|------|---------|----------|
| **DIP** | 介面定義在 Application Layer | `using Repositories` 出現在 Service |
| **SoC** | 橫切關注點用 Decorator/Middleware | Repository 內有 `_cache` |
| **OCP** | 擴展優於修改 | 為加功能修改核心類別 |
| **SRP** | 一個類別一個改變理由 | 類別超過 200 行 |
| **ISP** | 小而專一的介面 | 介面超過 7 個方法 |
| **YAGNI** | 只建立當前需要的功能 | 「以防萬一」建立的方法 |

### 架構邊界決策

```
新架構程式碼禁止引用：
├── *.BLL（舊版業務邏輯）
├── *.DAL（舊版資料存取）
└── Domain Model 禁止依賴 Infrastructure
```

**決策原則**: 若需要舊架構功能，優先重構為新架構，而非直接引用。

---

## 技術決策指引 (Technical Decision Guidelines)

### Domain Model 設計決策

| 決策點 | 建議方案 | 理由 |
|--------|---------|------|
| 可變性 | `record` 或 `class + init` | 確保不可變性，簡化並行處理 |
| 業務邏輯位置 | Domain Model 內 | Rich Model > Anemic Model |
| 資料轉換 | `CreateDomain()` 方法 | 隔離 DbModel 依賴 |

### Repository 設計決策

| 決策點 | 建議方案 | 理由 |
|--------|---------|------|
| 介面位置 | `Services/` 命名空間 | 依賴反轉原則 |
| 回傳類型 | Domain Model | 隔離資料庫細節 |
| 快取實作 | Decorator 模式 | 關注點分離 |

### Service 層設計決策

| 決策點 | 建議方案 | 理由 |
|--------|---------|------|
| 職責 | 協調多個 Repository | 單一職責原則 |
| 業務邏輯 | 委託給 Domain Model | 避免 Anemic Model |
| 並行查詢 | `Task.WhenAll()` | 效能優化 |

---

## 程式碼品質標準 (Code Quality Standards)

### 類別複雜度控制

| 指標 | 上限 | 處理方式 |
|------|------|---------|
| 類別行數 | 200 行 | 拆分職責 |
| 方法行數 | 30 行 | Extract Method |
| 建構子參數 | 5 個 | 考慮 Facade 或重新設計 |
| 介面方法數 | 7 個 | 介面隔離 |

### 測試覆蓋率要求

| 類型 | 最低覆蓋率 | 重點 |
|------|-----------|------|
| Domain Model | 90%+ | 業務邏輯、不可變性 |
| Service Layer | 80%+ | 協調邏輯、例外處理 |
| Repository | 70%+ | 整合測試為主 |

### Commit 品質標準

```
提交前必須滿足：
├── [ ] 所有測試通過
├── [ ] 無編譯警告
├── [ ] 結構/行為變更分離
└── [ ] Commit message 標示變更類型
```

---

## 團隊協作 (Team Collaboration)

### Code Review 重點

**架構破口檢查**:
| 檢查項目 | 警示信號 |
|----------|----------|
| Domain 層依賴 | `using PaymentService.Repositories` |
| DbModel 洩漏 | Repository 回傳 `DbModel.XXX` |
| 快取混入 | Repository 內有 `_cacheHelper` |

**職責越界檢查**:
| 層級 | 不應出現 |
|------|----------|
| Controller | 複雜 if-else 業務邏輯 |
| Service | SQL 查詢、快取操作 |
| Repository | 業務規則判斷 |
| Domain Model | `DbContext`、`HttpClient` |

### Review 問題模板

```markdown
## 架構問題
- [ ] 「這個邏輯為什麼不在 Domain Model？」
- [ ] 「為什麼要修改原有的類別？能用 Decorator 嗎？」
- [ ] 「這個介面是不是太大了？需要拆分嗎？」
- [ ] 「這個方法實際有在使用嗎？當前的使用場景是什麼？」

## 品質問題
- [ ] 「測試覆蓋了邊界情況嗎？」
- [ ] 「這個變更是結構性還是行為性的？」
- [ ] 「commit 是否可以更小更頻繁？」
```

---

## 指導與知識分享 (Mentoring & Knowledge Sharing)

### 新人常見踩雷點

1. **介面定義位置錯誤**
   - 問題：介面放在 `Repositories/` 命名空間
   - 解答：介面屬於 Application Layer，應放在 `Services/`

2. **Service 包含過多業務邏輯**
   - 問題：在 Service 中寫 LINQ 過濾邏輯
   - 解答：業務邏輯應委託給 Domain Model

3. **為了加功能而修改原有程式碼**
   - 問題：直接在 Repository 加快取邏輯
   - 解答：使用 Decorator 模式擴展

4. **混合結構與行為變更**
   - 問題：一個 commit 同時重構和加功能
   - 解答：遵循 Tidy First，分開提交

### 知識傳承清單

**新人 Onboarding 路徑**:
```
Week 1: 架構基礎
├── 閱讀架構概述、核心原則
├── 理解專案目錄結構
└── 配對程式練習：簡單的 Domain Model

Week 2: 開發實踐
├── TDD 實踐練習
├── 完成一個完整的 Repository 實作
└── Code Review 參與

Week 3: 獨立開發
├── 獨立完成一個小功能
├── 自行處理 Code Review 回饋
└── 開始理解 Decorator 和 Feature Toggle
```

### 架構決策記錄模板

```markdown
## ADR-XXX: [決策標題]

### 狀態
[提議 | 接受 | 棄用 | 取代]

### 背景
[描述問題背景和需求]

### 決策
[具體的技術決策]

### 理由
[選擇此方案的原因和權衡]

### 後果
[此決策的影響和後續工作]
```

---

## 快速決策參考卡

### 新功能開發

```
1. 需要新增業務邏輯？
   → 在 Domain Model 中實作

2. 需要新增資料查詢？
   → 在 Repository 介面加方法，實作在 Repositories/

3. 需要協調多個查詢？
   → 建立或擴展 Service

4. 需要加快取？
   → 使用 Decorator 模式

5. 需要新增 API？
   → Controller 只處理 HTTP，邏輯在 Service/Domain
```

### 重構決策

```
需要重構時：
1. 先確保有測試覆蓋
2. 結構性變更先提交（refactor:）
3. 行為變更後提交（feat: / fix:）
4. 每個 commit 後都能正常運行
```

---

## 延伸閱讀

| 主題 | 文件 |
|------|------|
| 完整核心原則 | [05-Clean Architecture 核心原則](zh-TW/05-Clean-Architecture-核心原則.md) |
| TDD 與 Tidy First | [07-TDD 與 Tidy First 實踐指南](zh-TW/07-TDD-與-Tidy-First-實踐指南.md) |
| Feature Toggle | [12-Feature Toggle 設計規範](zh-TW/12-Feature-Toggle-設計規範.md) |
| Code Review 清單 | [20-Code Review 檢查清單](zh-TW/20-Code-Review-檢查清單.md) |

---

> **文件版本**: v1.0
> **最後更新**: 2025-01
