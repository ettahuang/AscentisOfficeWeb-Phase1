# Clean Architecture 專案規則與實作指南

> 本知識庫萃取自 PaymentService 專案重構實作（AAZ-1753），提供團隊 Clean Architecture 實踐的標準規範與指南。

---

## 文件目錄導覽

### Part 1：基礎篇（必讀）

| 編號 | 文件 | 說明 |
|------|------|------|
| 02 | [架構概述](./02-架構概述.md) | 專案架構遷移狀態、舊架構問題分析、新架構設計 |
| 03 | [架構圖表](./03-架構圖表.md) | 同心圓架構圖、完整流程圖、各設計模式架構圖 |
| 04 | [專案目錄結構規範](./04-專案目錄結構規範.md) | 目錄深度規則、命名規範、完整目錄樹範例 |

### Part 2：Clean Architecture 原則篇

| 編號 | 文件 | 說明 |
|------|------|------|
| 05 | [Clean Architecture 核心原則](./05-Clean-Architecture-核心原則.md) | 六大核心原則、依賴反轉、關注點分離 |
| 06 | [層級職責定義](./06-層級職責定義.md) | Domain/Application/Infrastructure 各層職責 |
| 07 | [TDD 與 Tidy First 實踐指南](./07-TDD-與-Tidy-First-實踐指南.md) | Red-Green-Refactor、結構/行為變更分離、Commit 紀律 |

### Part 3：領域設計篇

| 編號 | 文件 | 說明 |
|------|------|------|
| 08 | [Domain Model 設計指南](./08-Domain-Model-設計指南.md) | Rich Model、實體設計、不可變性、CreateDomain 模式、Value Object |
| 09 | [Repository 模式](./09-Repository-模式.md) | Repository 設計、Decorator 快取層、DbModel 分離 |

### Part 4：應用服務篇

| 編號 | 文件 | 說明 |
|------|------|------|
| 10 | [Service 層設計](./10-Service-層設計.md) | Service 職責、協調 Repository、並行查詢優化 |
| 11 | [Decorator 模式設計規範](./11-Decorator-模式設計規範.md) | Decorator 設計原則、Cache Key 設計、DI 註冊 |
| 12 | [Feature Toggle 設計規範](./12-Feature-Toggle-設計規範.md) | Dispatcher Pattern、Handler 設計、V1/V2 比對機制 |

### Part 5：橫切關注點篇

| 編號 | 文件 | 說明 |
|------|------|------|
| 13 | [異常處理與錯誤管理](./13-異常處理與錯誤管理.md) | PaymentServiceException、GlobalExceptionMiddleware、PaymentError |
| 14 | [Middleware 設計規範](./14-Middleware-設計規範.md) | 進入點處理、Request/Response Log、註冊順序 |
| 15 | [DelegatingHandler 設計規範](./15-DelegatingHandler-設計規範.md) | 輸出點處理、Retry/Timeout Handler |

### Part 6：測試篇

| 編號 | 文件 | 說明 |
|------|------|------|
| 16 | [測試規範與指南](./16-測試規範與指南.md) | Given-When-Then、Test Builders、FluentAssertions |
| 17 | [MySQL Testcontainers 快速參考](./17-MySQL-Testcontainers-快速參考.md) | Integration Tests、Docker Compose、Fixture 設計 |

### Part 7：編碼標準篇

| 編號 | 文件 | 說明 |
|------|------|------|
| 18 | [CSharp 程式碼編寫規範](./18-CSharp-程式碼編寫規範.md) | 類別成員排序、Region 使用規範、Namespace 規範 |
| 20 | [Code Review 檢查清單](./20-Code-Review-檢查清單.md) | 實作計劃相符、SOLID/DRY、文件註解、架構邊界 |

> **Note**: Git Commit Message 規範已移至 [git-workflow skill](../../git-workflow/commit-message-conventions.md)。

### 附錄

| 編號 | 文件 | 說明 |
|------|------|------|
| A1 | [GetDepositOptionsAsync API 審查報告](./A1-GetDepositOptionsAsync-API-審查報告.md) | 實際重構範例、架構遵循度評估、標竿案例 |
| A2 | [GetPromotionListV3 重構審查報告](./A2-GetPromotionListV3-重構審查報告.md) | Handler/Dispatcher 模式、漸進式遷移策略、V1/V2 比對機制 |

---

## 快速開始指南

### 新進開發者建議閱讀順序

```
第一週：架構基礎
├── 02-架構概述.md              ← 理解專案整體架構
├── 04-專案目錄結構規範.md      ← 熟悉專案結構
├── 05-核心原則.md              ← 掌握設計原則
└── 06-層級職責定義.md          ← 了解各層職責

第二週：開發方法論與領域設計
├── 07-TDD 與 Tidy First.md     ← 學習 TDD 與提交紀律
├── 08-Domain Model 設計.md     ← 學習 Domain Model 設計
├── 09-Repository 模式.md       ← 理解資料存取模式
└── 10-Service 層設計.md        ← 掌握 Service 協調邏輯

第三週：測試與實作
├── 16-測試規範.md              ← 學習測試寫法
└── A1-審查報告.md              ← 參考實際案例
```

### 資深開發者快速參考

| 任務場景 | 參考文件 |
|----------|----------|
| 新增 Domain Model | [08-Domain Model 設計指南](./08-Domain-Model-設計指南.md) |
| 實作 Repository | [09-Repository 模式](./09-Repository-模式.md) |
| 加入快取機制 | [11-Decorator 模式設計規範](./11-Decorator-模式設計規範.md) |
| 處理異常情境 | [13-異常處理與錯誤管理](./13-異常處理與錯誤管理.md) |
| 撰寫單元測試 | [16-測試規範與指南](./16-測試規範與指南.md) |
| TDD 與 Commit 紀律 | [07-TDD 與 Tidy First 實踐指南](./07-TDD-與-Tidy-First-實踐指南.md) |

---

## 開發檢查清單

### Domain Model 開發檢查

- [ ] 使用 `init` setter 確保不可變性
- [ ] 業務邏輯封裝於 Domain Model 內
- [ ] 不直接依賴 DbModel（透過 `CreateDomain()` 轉換）
- [ ] 驗證邏輯放在 Domain Model 建構時
- [ ] 使用領域語言命名（如 `IsSupported()`、`WithAmountLimit()`）

### Repository 開發檢查

- [ ] 回傳 Domain Model，非 DbModel 或 DTO
- [ ] 介面定義於 `Services/` 命名空間（依賴反轉）
- [ ] 實作位於 `Repositories/` 命名空間
- [ ] 使用 `CreateDomain()` 進行模型轉換
- [ ] 快取透過 Decorator 模式實現，非混入 Repository

### Service 層開發檢查

- [ ] 僅協調多個 Repository 呼叫
- [ ] 業務邏輯委託給 Domain Model
- [ ] 不直接存取資料庫或快取
- [ ] 使用 `Task.WhenAll()` 進行並行查詢優化

### Controller 開發檢查

- [ ] 只負責 HTTP 相關處理（Request/Response）
- [ ] 不包含業務邏輯
- [ ] 輸入驗證使用 Data Annotations
- [ ] 回傳統一的 `ApiResult` 格式

### 異常處理檢查

- [ ] 業務異常繼承 `PaymentServiceException`
- [ ] 使用預定義的 `PaymentError` 常數
- [ ] 不在 catch 中吞掉異常
- [ ] 讓 `GlobalExceptionMiddleware` 統一處理

### 測試開發檢查

- [ ] 使用 Given-When-Then 模式
- [ ] 使用 Test Builder 建立測試資料
- [ ] 使用 FluentAssertions 進行驗證
- [ ] 測試方法命名：`Method_When條件_Should結果`

---

## 專案架構概覽

```
PaymentService/
├── Models/
│   ├── Domain/           ← Domain Models（核心業務邏輯）
│   │   ├── Customer.cs
│   │   ├── DepositChannel.cs
│   │   └── DepositChannels.cs
│   ├── DbModel/          ← Database Models（資料庫映射）
│   │   ├── Customer.cs
│   │   └── DepositChannel.cs
│   ├── Enum/             ← 列舉定義
│   └── Payload/          ← API Request/Response Models
├── Services/             ← Application Layer（介面定義 + Service 實作）
│   ├── ICustomerRepository.cs
│   ├── IDepositRepository.cs
│   ├── IDepositQueryService.cs
│   └── DepositQueryService.cs
├── Repositories/         ← Infrastructure Layer（Repository 實作）
│   ├── CustomerRepository.cs
│   ├── CustomerRepositoryDecorator.cs
│   └── DepositRepository.cs
├── Controllers/          ← Presentation Layer
├── Middlewares/          ← 橫切關注點（進入點）
└── Exceptions/           ← 自定義異常
```

---

## 常見問題 FAQ

### Q1: Domain Model 和 DbModel 為何要分離？

**A:** 分離的目的是讓 Domain Model 專注於業務邏輯，不受資料庫結構影響。DbModel 負責與資料庫互動，透過 `CreateDomain()` 方法轉換為 Domain Model。這樣可以：
- 業務邏輯變更不影響資料庫結構
- 資料庫欄位重命名不影響業務邏輯
- 更容易撰寫單元測試

### Q2: 為何 Repository 介面要放在 Services/ 而非 Repositories/？

**A:** 這是**依賴反轉原則（DIP）**的實踐。介面屬於 Application Layer，由 Domain/Application Layer 定義「需要什麼」，Infrastructure Layer 負責「如何實現」。這樣 Application Layer 不依賴 Infrastructure Layer。

### Q3: 何時該用 Service 層？

**A:** 當操作需要**協調多個 Repository** 或需要**跨聚合的業務邏輯**時。例如：
- `DepositQueryService` 協調 `ICustomerRepository` 和 `IDepositRepository`
- 若只是單一 Repository 的 CRUD，Controller 可直接呼叫 Repository

### Q4: 快取邏輯為何不放在 Repository 內？

**A:** 使用 **Decorator 模式**分離關注點。Repository 專注於資料存取，Decorator 負責快取。這樣：
- Repository 保持單一職責
- 快取策略可彈性替換
- 測試時可獨立測試快取邏輯

---

## ✅ Review Checklist

### 閱讀本知識庫後，請確認：

- [ ] 我已閱讀「架構基礎篇」全部內容
- [ ] 我理解 Domain Model 與 DbModel 分離的原因
- [ ] 我知道 Repository 介面應定義在哪個命名空間
- [ ] 我了解 Decorator 模式在專案中的應用
- [ ] 我能區分各層（Domain/Application/Infrastructure）的職責
- [ ] 我知道如何使用 Given-When-Then 模式撰寫測試

---

## ✅ 新人常見踩雷點

### 1. 在 Domain Model 中直接使用 DbModel

```csharp
// ❌ 錯誤：Domain Model 直接依賴 DbModel
public class DepositChannel
{
    public DbModel.DepositChannel DbModel { get; set; } // 錯誤！
}

// ✅ 正確：使用 CreateDomain() 轉換
public class DbModel.DepositChannel
{
    public Domain.DepositChannel CreateDomain()
    {
        return new Domain.DepositChannel
        {
            Currency = (CurrencyEnum)CurrencyId,
            DepositType = (DepositTypeEnum)DepositType,
            // ...
        };
    }
}
```

### 2. 在 Repository 中混入快取邏輯

```csharp
// ❌ 錯誤：Repository 混入快取
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}"); // 錯誤！
        if (cached != null) return cached;
        // ...
    }
}

// ✅ 正確：使用 Decorator 處理快取
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            async () => await _customerRepository.GetCustInfoAsync(custId)
        );
    }
}
```

### 3. Service 層包含過多業務邏輯

```csharp
// ❌ 錯誤：Service 包含業務邏輯
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        // 業務邏輯不應在 Service
        return channels.Where(c =>
            c.VipLevels.Contains(custContext.VipLevel) &&
            c.MinAmount <= limit.MaxAmount).ToList();
    }
}

// ✅ 正確：委託給 Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);
        return depositChannels.GroupByDepositType(custContext); // 委託給 Domain Model
    }
}
```

---

## ✅ TL / Reviewer 檢查重點

### 架構破口檢查

| 檢查項目 | 警示信號 |
|----------|----------|
| Domain 層依賴 | Domain Model 有 `using PaymentService.Repositories` |
| DbModel 洩漏 | Repository 回傳 `DbModel.XXX` 而非 Domain Model |
| 快取混入 | Repository 內有 `_cacheHelper` 或 `_redis` 注入 |

### 職責越界檢查

| 層級 | 不應出現 |
|------|----------|
| Controller | 複雜的 if-else 業務邏輯、直接的資料庫操作 |
| Service | SQL 查詢、快取操作、HTTP Client 呼叫 |
| Repository | 業務規則判斷、跨 Repository 協調 |
| Domain Model | `DbContext`、`HttpClient`、`ILogger` 注入 |

### 耦合度檢查

- [ ] 新增功能時，是否只需修改少數檔案？
- [ ] Repository 介面變更是否影響到 Controller？
- [ ] Domain Model 變更是否需要同步修改 DbModel？

### 可維護性風險

- [ ] 是否有超過 200 行的類別？
- [ ] 是否有超過 5 個參數的方法？
- [ ] 是否有重複的程式碼（複製貼上）？
- [ ] 測試覆蓋率是否低於 80%？

---

> **文件版本**: v1.1
> **萃取來源**: Commit b671f069 ~ 6b5804c1（共 17 commits）
> **最後更新**: 2025-01
> **變更說明**: 重新編排文件順序、新增 TDD 與 Tidy First 實踐指南
