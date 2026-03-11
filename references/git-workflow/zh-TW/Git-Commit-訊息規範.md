# Git Commit 訊息規範

本文件定義本專案的 Git commit 訊息格式與規範，基於 [Conventional Commits](https://www.conventionalcommits.org/) 規範。

---

## Commit 訊息結構

```
<type>: <subject>

<body>

<footer>
```

### 結構概覽

| 部分 | 必要性 | 說明 |
|------|--------|------|
| Type | ✅ 是 | 變更類別 |
| Subject | ✅ 是 | 簡短描述（祈使語氣） |
| Body | ⚠️ 建議 | 變更的詳細說明 |
| Footer | ❌ 選用 | 破壞性變更、issue 參照 |

---

## Type 前綴

| Type | 說明 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat: add promotion eligibility check` |
| `fix` | 錯誤修復 | `fix: correct VIP level calculation` |
| `refactor` | 程式碼重構（無行為變更） | `refactor: implement Phase 3 Domain Models` |
| `docs` | 文件變更 | `docs: add Phase 9 implementation plan` |
| `test` | 新增或更新測試 | `test: add CustomerRepository unit tests` |
| `chore` | 維護任務 | `chore: update NuGet packages` |
| `style` | 程式碼風格變更（格式化，無邏輯變更） | `style: fix indentation in Handler classes` |
| `perf` | 效能改善 | `perf: optimize database query with index` |
| `ci` | CI/CD 設定變更 | `ci: add integration test workflow` |

---

## Subject 行規則

### 格式

```
<type>: <祈使動詞> <做了什麼>
```

### 規則

| 規則 | ✅ 好 | ❌ 壞 |
|------|-------|-------|
| 使用祈使語氣 | `add customer validation` | `added customer validation` |
| 首字母不大寫 | `add new feature` | `Add new feature` |
| 結尾不加句號 | `fix null reference` | `fix null reference.` |
| 保持在 72 字元以內 | 簡短扼要 | 冗長囉嗦的描述... |
| 具體明確 | `add VIP level check to eligibility` | `update code` |

### 範例

```
✅ refactor: implement Phase 9F Customer domain model and repository
✅ feat: add promotion amount type to bonus terms
✅ fix: correct IPv6 resolution issue with localhost
✅ docs: add migration scripts documentation

❌ Refactor: Implemented Phase 9F Customer domain model and repository.
❌ refactor: changes
❌ updated stuff
```

---

## Body 格式

Body 提供**做了什麼**和**為什麼**的詳細說明（而非如何做 - 程式碼會說明）。

### Feature/Refactor Commit 的結構

```
<Phase/Feature 名稱>:
- <變更 1>
- <變更 2>
- <變更 3>

<額外章節（如有需要）>:
- <變更 4>
- <變更 5>
```

### 範例

```
refactor: implement Phase 9G ResultMapper and Phase 9H V2 Handler

Phase 9G - ResultMapper:
- Add ToLocalUnixTimeSeconds() method to MarketDateTime for legacy API conversion
- Add PromotionAmountType to BonusTerms for bonus calculation type
- Add IResultMapper interface for V2 to legacy model conversion
- Add ResultMapper implementation with enum and reference mapping
- Add ResultMapperTests with comprehensive coverage

Phase 9H - GetSpecialPromotionListV2Handler:
- Add V2 Handler integrating all Clean Architecture components
- Implement BuildViewerContext, GetVisiblePromotions, CheckEligibility, MapToLegacy flow
- Support guest and authenticated user flows with proper eligibility handling
- Register IResultMapper and V2 Handler in Startup.cs DI container

Supporting changes:
- Update PromotionData DbModel with PeriodType field
- Update PromotionList and FreeBetPromotion tests
```

### Body 指引

| 指引 | 說明 |
|------|------|
| 使用項目符號 | 每個項目以 `-` 開頭以提高可讀性 |
| 將相關變更分組 | 使用章節標題如 `Phase X:`、`Supporting changes:` |
| 具體明確 | 提及檔案名稱、類別名稱、方法名稱 |
| 說明原因 | 如果原因不明顯，說明動機 |
| 每行 72 字元換行 | 以便在終端機中閱讀 |

---

## 多階段 Commit

在單一 commit 中實作多個階段時：

```
refactor: implement Phase 9G ResultMapper and Phase 9H V2 Handler

Phase 9G - ResultMapper:
- <Phase 9G 的變更>

Phase 9H - GetSpecialPromotionListV2Handler:
- <Phase 9H 的變更>

Supporting changes:
- <共用或基礎建設的變更>
```

---

## 文件 Commit

```
docs: add Phase 9 implementation plan with sub-phases 9A-9J
```

或帶有 body：

```
docs: restructure refactoring plan with TDD + Tidy First methodology

- Reorganize phases for incremental delivery
- Add sub-phase breakdown for complex phases
- Include test strategy for each phase
- Add rollback procedures
```

---

## 快速參考

### Commit 訊息範本

```
<type>: <祈使語氣的簡短描述>

<章節名稱>:
- <包含類別/方法名稱的具體變更>
- <另一個具體變更>

<另一個章節（如有需要）>:
- <變更>
```

### Commit 前檢查清單

- [ ] Type 前綴正確（`feat`、`fix`、`refactor`、`docs` 等）
- [ ] Subject 使用祈使語氣（"add" 而非 "added"）
- [ ] Subject 少於 72 字元
- [ ] Subject 結尾沒有句號
- [ ] Body 說明變更內容（包含具體名稱）
- [ ] 相關變更以章節標題分組

---

## 本專案範例

### 重構 Commit（單一階段）

```
refactor: implement Phase 9F Customer domain model and repository

- Add Customer domain model with WalletBalance, VipLevel, AffiliateCode properties
- Add Customer DbModel for database mapping (stored procedure result)
- Add ICustomerRepository interface for customer data retrieval
- Add CustomerRepository implementation using Report DB
- Add Bonus_Customer_Get SP script for customer retrieval
- Register ICustomerRepository in Startup.cs DI container
- Add CustomerTests unit tests for domain model validation
- Update phase9 implementation plan documentation
```

### 重構 Commit（多階段）

```
refactor: implement Phase 9G ResultMapper and Phase 9H V2 Handler

Phase 9G - ResultMapper:
- Add ToLocalUnixTimeSeconds() method to MarketDateTime
- Add IResultMapper interface for V2 to legacy model conversion
- Add ResultMapper implementation with enum and reference mapping
- Add ResultMapperTests with comprehensive coverage

Phase 9H - GetSpecialPromotionListV2Handler:
- Add V2 Handler integrating all Clean Architecture components
- Register IResultMapper and V2 Handler in Startup.cs DI container
- Add GetSpecialPromotionListV2HandlerTests

Supporting changes:
- Update PromotionData DbModel with PeriodType field
```

### 文件 Commit

```
docs: add Phase 9 implementation plan with sub-phases 9A-9J
```

### 基礎建設 Commit

```
refactor: implement Phase 0A integration test container management

Phase 0A - Container Reuse Infrastructure:
- Add ContainerMetadata class for persisting container state to disk
- Add MigrationRunner class for branch-specific SQL migration execution
- Update MySqlContainerFixture with container reuse logic (12-hour validity)
- Support FORCE_RECREATE_CONTAINER, CONTAINER_MAX_AGE_HOURS env vars

Migration Scripts:
- Add 001_Bonus_Customer_Get.sql for customer data retrieval
- Add 002_Bonus_PromotionList_Get.sql for promotion list queries

Supporting changes:
- Update .csproj to copy migration SQL files to output directory
- Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues
```

---

> **文件版本**: v1.0
> **最後更新**: 2024-12
