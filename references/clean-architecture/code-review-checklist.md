# Code Review 檢查清單

> **目標讀者**: Code Reviewer
> **文件用途**: Code Review 快速檢查清單
> **最後更新**: 2025-01

---

## 審查流程 (Review Process)

### 審查前準備

- [ ] 開啟引用的計劃/規格文件
- [ ] 理解 PR 的目標和範圍
- [ ] 確認 CI 檢查是否通過

### 審查後核准條件

- [ ] 所有檢查項目通過
- [ ] 所有 CI 檢查通過
- [ ] 沒有未解決的評論
- [ ] 測試覆蓋率足夠

### 發現問題時的處理

1. 新增指向問題的具體評論
2. 引用本文件說明標準
3. 要求修改並列出明確的待辦事項
4. 修復後重新 Review

---

## 必要檢查項 (Critical Checks)

### 🔴 安全性 (Security)

- [ ] **無敏感資訊洩漏**
  - 沒有 hardcode 密碼、API Key
  - 沒有將敏感資料寫入 Log
  - 沒有在錯誤訊息中暴露系統資訊

- [ ] **輸入驗證**
  - 所有外部輸入都有驗證
  - 使用參數化查詢，避免 SQL Injection
  - 適當的 XSS 防護

- [ ] **權限檢查**
  - API 端點有適當的授權檢查
  - 資料存取有權限驗證

### 🔴 效能 (Performance)

- [ ] **資料庫查詢**
  - 避免 N+1 查詢問題
  - 大量資料有分頁處理
  - 適當使用快取機制

- [ ] **非同步處理**
  - I/O 操作使用 async/await
  - 多個獨立查詢使用 `Task.WhenAll()`
  - 避免不必要的 `.Result` 或 `.Wait()`

- [ ] **資源管理**
  - 適當使用 `using` 或 `IAsyncDisposable`
  - 沒有記憶體洩漏風險

### 🔴 資料完整性 (Data Integrity)

- [ ] **交易處理**
  - 多步驟操作有適當的交易邊界
  - 錯誤時有適當的 rollback 機制

- [ ] **例外處理**
  - 業務異常使用自定義 Exception
  - 不吞掉異常（empty catch block）
  - 讓 GlobalExceptionMiddleware 統一處理

---

## 程式碼品質檢查 (Code Quality Checks)

### 📖 可讀性 (Readability)

- [ ] **命名規範**
  - 類別、方法、變數命名清晰表達意圖
  - 使用領域語言命名（如 `IsSupported()`）
  - 避免縮寫和不明確的名稱

- [ ] **程式碼結構**
  - 類別成員順序正確（常數 → 欄位 → 建構子 → 屬性 → 方法）
  - 使用 file-scoped namespace
  - Production Code 不使用 `#region`

- [ ] **註解與文件**
  - Public API 有英文 XML 文件註解
  - 註解描述 what 和 why，非僅是 how
  - 避免無意義的註解（只重複程式碼）

### 🔧 可維護性 (Maintainability)

- [ ] **SOLID 原則**
  - **S**: 類別只有一個改變的理由
  - **O**: 透過擴展而非修改新增功能
  - **L**: 子類別可替代基底類別
  - **I**: 介面小而專注
  - **D**: 依賴抽象而非具體實作

- [ ] **DRY 原則**
  - 沒有重複的程式碼區塊
  - 共用邏輯有適當抽取

- [ ] **複雜度控制**
  - 類別不超過 200 行
  - 方法不超過 30 行
  - 建構子參數不超過 5 個

### ✅ 測試覆蓋 (Test Coverage)

- [ ] **測試存在性**
  - 新增的業務邏輯有對應測試
  - 修改的邏輯有更新測試

- [ ] **測試品質**
  - 使用 Given-When-Then 結構
  - 測試命名符合 `[方法]_[場景]_[預期]` 格式
  - 使用 FluentAssertions 進行驗證

- [ ] **覆蓋率**
  - Domain Model: 90%+
  - Service Layer: 80%+
  - Repository: 70%+ (Integration Test)

---

## 架構邊界檢查 (Architecture Boundary)

### 禁止的引用

| 新架構層級 | 不可引用 |
|-----------|---------|
| Domain Models | `*.BLL`, `*.DAL`, `*.DbModel`, `*.Repositories` |
| Services (Application) | `*.BLL`, `*.DAL` |
| Repositories (Infrastructure) | `*.BLL` |
| Handlers | `*.BLL`, `*.DAL` |

### 快速檢查命令

搜尋禁止的 `using` 語句：
```
using BonusService.Service.BLL;
using BonusService.Service.DAL;
```

### 架構警示信號

| 檢查項目 | 警示信號 |
|----------|----------|
| Domain 層依賴 | Domain Model 有 `using PaymentService.Repositories` |
| DbModel 洩漏 | Repository 回傳 `DbModel.XXX` 而非 Domain Model |
| 快取混入 | Repository 內有 `_cacheHelper` 或 `_redis` 注入 |
| 職責混亂 | Service 有 SQL 查詢或快取操作 |

---

## 常見問題與解決方案 (Common Issues & Solutions)

### Issue 1: 介面定義位置錯誤

```csharp
// ❌ 問題：介面在 Repositories 命名空間
namespace PaymentService.Repositories
{
    public interface ICustomerRepository { }
}

// ✅ 解決：介面應在 Services 命名空間
namespace PaymentService.Services
{
    public interface ICustomerRepository { }
}
```

**Review 評論**: 「依賴反轉原則要求介面定義在 Application Layer。請將介面移至 `Services/` 命名空間。」

---

### Issue 2: Repository 混入快取邏輯

```csharp
// ❌ 問題：Repository 直接處理快取
public class CustomerRepository : ICustomerRepository
{
    private readonly ICacheHelper _cache;

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;
        // ...
    }
}

// ✅ 解決：使用 Decorator 模式
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;
    private readonly ICacheHelper _cacheHelper;

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            () => _inner.GetCustInfoAsync(custId)
        );
    }
}
```

**Review 評論**: 「關注點分離原則建議快取邏輯使用 Decorator 模式實現。請建立 `CustomerRepositoryDecorator` 處理快取。」

---

### Issue 3: Service 包含業務邏輯

```csharp
// ❌ 問題：業務邏輯在 Service
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        // 這些邏輯應該在 Domain Model
        return channels.Where(c =>
            c.VipLevels.Contains(custContext.VipLevel) &&
            c.Currency == custContext.Currency
        ).ToList();
    }
}

// ✅ 解決：委託給 Domain Model
public async Task<DepositChannelsByDepositType> GetChannels(int custId)
{
    var channels = await _repo.GetChannels();
    return channels.GroupByDepositType(custContext);
}
```

**Review 評論**: 「業務邏輯應封裝於 Domain Model。請將過濾邏輯移至 `DepositChannels.GroupByDepositType()` 方法。」

---

### Issue 4: 混合結構與行為變更

```bash
# ❌ 問題：一個 commit 混合變更
git commit -m "feat: add deposit validation and refactor service"

# ✅ 解決：分開提交
git commit -m "refactor: extract validation logic to separate method"
git commit -m "feat: add deposit amount validation"
```

**Review 評論**: 「Tidy First 原則要求結構性變更與行為變更分開提交。請拆分此 commit。」

---

### Issue 5: 缺少 XML 文件註解

```csharp
// ❌ 問題：Public 方法沒有文件
public async Task<Customer?> GetCustomerAsync(int customerId)

// ✅ 解決：加上完整的 XML 註解
/// <summary>
/// Gets the customer information by customer ID.
/// </summary>
/// <param name="customerId">The unique identifier of the customer.</param>
/// <returns>The customer domain model, or null if not found.</returns>
public async Task<Customer?> GetCustomerAsync(int customerId)
```

**Review 評論**: 「Public API 需要英文 XML 文件註解。請加上 `<summary>`, `<param>`, `<returns>` 標籤。」

---

## 審查意見範本 (Review Comments Templates)

### 架構問題

```
🏗️ **架構邊界**: [描述問題]

根據 Clean Architecture 原則，[解釋正確做法]。

建議：
- [具體修改建議]

參考：[文件連結]
```

### 程式碼品質

```
📝 **程式碼品質**: [描述問題]

這違反了 [原則名稱]。

建議：
- [具體修改建議]

範例：
```csharp
// 正確的寫法
```
```

### 測試問題

```
🧪 **測試覆蓋**: [描述問題]

建議新增以下測試案例：
- [ ] [測試案例 1]
- [ ] [測試案例 2]

測試應遵循 Given-When-Then 結構。
```

---

## 快速參考卡

```
□ 實作與計劃文件相符
□ 遵循 SOLID/DRY 原則
□ Public API 有英文 XML 註解
□ 新程式碼沒有引用舊架構（BLL/DAL）
□ 程式碼排版符合規範
□ 結構與行為變更分離提交
□ 測試覆蓋率足夠
□ 無安全性問題
```

---

## 延伸閱讀

| 主題 | 文件 |
|------|------|
| 完整 Code Review 清單 | [20-Code Review 檢查清單](zh-TW/20-Code-Review-檢查清單.md) |
| 核心原則詳解 | [05-Clean Architecture 核心原則](zh-TW/05-Clean-Architecture-核心原則.md) |
| 測試規範 | [16-測試規範與指南](zh-TW/16-測試規範與指南.md) |
| CSharp 編碼規範 | [18-CSharp 程式碼編寫規範](zh-TW/18-CSharp-程式碼編寫規範.md) |

---

> **文件版本**: v1.0
> **最後更新**: 2025-01
