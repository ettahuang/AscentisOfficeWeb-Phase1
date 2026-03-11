# 開發者指南 (Developer Guide)

> **目標讀者**: 初中階開發者
> **文件用途**: 日常開發參考，循序漸進學習 Clean Architecture 實踐
> **最後更新**: 2025-01

---

## 快速開始 (Quick Start)

### 必讀文件

按照以下順序閱讀，建立基礎知識：

```
Week 1: 架構基礎
├── 02-架構概述.md              ← 理解專案整體架構
├── 04-專案目錄結構規範.md      ← 熟悉專案結構
├── 05-核心原則.md              ← 掌握設計原則
└── 06-層級職責定義.md          ← 了解各層職責

Week 2: 開發方法論與領域設計
├── 07-TDD 與 Tidy First.md     ← 學習 TDD 與提交紀律
├── 08-Domain Model 設計.md     ← 學習 Domain Model 設計
├── 09-Repository 模式.md       ← 理解資料存取模式
└── 10-Service 層設計.md        ← 掌握 Service 協調邏輯

Week 3: 測試與實作
├── 16-測試規範.md              ← 學習測試寫法
└── A1-審查報告.md              ← 參考實際案例
```

### 專案結構速覽

```
PaymentService/
├── Models/
│   ├── Domain/           ← Domain Models（核心業務邏輯）
│   ├── DbModel/          ← Database Models（資料庫映射）
│   ├── Enum/             ← 列舉定義
│   └── Payload/          ← API Request/Response Models
├── Services/             ← Application Layer（介面定義 + Service 實作）
├── Repositories/         ← Infrastructure Layer（Repository 實作）
├── Controllers/          ← Presentation Layer
├── Middlewares/          ← 橫切關注點（進入點）
└── Exceptions/           ← 自定義異常
```

---

## 核心原則精要 (Core Principles)

### 1. 依賴反轉原則 (DIP)

**規則**: 介面定義在 Application Layer (`Services/`)，實作在 Infrastructure Layer (`Repositories/`)

```csharp
// ✅ 正確：介面在 Services/ 命名空間
namespace PaymentService.Services
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
    }
}

// ✅ 正確：實作在 Repositories/ 命名空間
namespace PaymentService.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        // 實作
    }
}
```

### 2. Domain Model 與 DbModel 分離

**規則**: Domain Model 專注業務邏輯，DbModel 負責資料庫映射，透過 `CreateDomain()` 轉換

```csharp
// DbModel 負責資料庫映射
public class DbModel.DepositChannel
{
    // 透過 CreateDomain() 轉換為 Domain Model
    public Domain.DepositChannel CreateDomain()
    {
        return new Domain.DepositChannel
        {
            Currency = (CurrencyEnum)CurrencyId,
            DepositType = (DepositTypeEnum)DepositType,
        };
    }
}

// Domain Model 負責業務邏輯
public class Domain.DepositChannel
{
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsVipLevelInScope(VipLevels);
    }
}
```

### 3. 快取使用 Decorator 模式

**規則**: Repository 專注資料存取，快取邏輯放在 Decorator

```csharp
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

### 4. Service 層只做協調

**規則**: Service 協調多個 Repository，業務邏輯委託給 Domain Model

```csharp
// ✅ 正確：Service 只協調，業務邏輯在 Domain Model
public class DepositQueryService : IDepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

        // 業務邏輯委託給 Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}
```

---

## 開發流程 (Development Workflow)

### TDD 循環：Red → Green → Refactor

```
1. 撰寫一個會失敗的測試 (Red)
    ↓
2. 撰寫剛好讓測試通過的程式碼 (Green)
    ↓
3. 改善程式碼結構，保持測試通過 (Refactor)
    ↓
4. 重複循環
```

### Tidy First：分離結構與行為變更

**黃金規則**: 結構性變更與行為變更**絕不混合**在同一個 commit

```bash
# ❌ 錯誤做法：混合提交
git commit -m "feat: add deposit validation and refactor service"

# ✅ 正確做法：分開提交
git commit -m "refactor: extract validation logic to separate method"
git commit -m "feat: add deposit amount validation"
```

### Commit 類型對照

| 變更類型 | Commit Prefix | 範例 |
|---------|---------------|------|
| 結構性變更 | `refactor:` | `refactor: rename GetCustInfo to GetCustomerById` |
| 結構性變更 | `style:` | `style: format code according to guidelines` |
| 行為變更 | `feat:` | `feat: add VIP level validation` |
| 行為變更 | `fix:` | `fix: correct deposit limit calculation` |

---

## 常見模式 (Common Patterns)

### Domain Model 設計模式

```csharp
public class DepositChannel
{
    // 使用 init setter 確保不可變性
    public CurrencyEnum Currency { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }

    // 業務邏輯方法
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsVipLevelInScope(VipLevels);
    }

    // 不可變性：回傳新實例
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return new DepositChannel
        {
            Currency = this.Currency,
            VipLevels = this.VipLevels,
            MinAmount = Math.Max(MinAmount, limitInfo.MinAmount),
            MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount)
        };
    }
}
```

### 測試：Given-When-Then 模式

```csharp
[Test]
public void IsSupported_WhenAllConditionsMet_ShouldReturnTrue()
{
    // Given - 準備測試資料
    var channel = GivenDepositChannel(
        currency: CurrencyEnum.CNY,
        vipLevels: new List<int> { 1, 2, 3 });

    var custContext = GivenCustomerContext(
        currency: CurrencyEnum.CNY,
        vipLevel: 2);

    // When - 執行待測方法
    var result = channel.IsSupported(custContext);

    // Then - 驗證結果
    result.Should().BeTrue();
}
```

### 測試命名規範

```
[被測方法]_[測試場景]_[預期結果]
```

範例：
- `IsSupported_WhenAllConditionsMet_ShouldReturnTrue`
- `GetAsync_WhenCustomerNotFound_ThrowsCustomerNotFoundException`

---

## 開發檢查清單 (Development Checklist)

### Domain Model 開發

- [ ] 使用 `init` setter 確保不可變性
- [ ] 業務邏輯封裝於 Domain Model 內
- [ ] 不直接依賴 DbModel（透過 `CreateDomain()` 轉換）
- [ ] 使用領域語言命名（如 `IsSupported()`、`WithAmountLimit()`）

### Repository 開發

- [ ] 回傳 Domain Model，非 DbModel 或 DTO
- [ ] 介面定義於 `Services/` 命名空間（依賴反轉）
- [ ] 實作位於 `Repositories/` 命名空間
- [ ] 使用 `CreateDomain()` 進行模型轉換
- [ ] 快取透過 Decorator 模式實現

### Service 層開發

- [ ] 僅協調多個 Repository 呼叫
- [ ] 業務邏輯委託給 Domain Model
- [ ] 不直接存取資料庫或快取
- [ ] 使用 `Task.WhenAll()` 進行並行查詢優化

### 測試開發

- [ ] 使用 Given-When-Then 模式
- [ ] 使用 Test Builder 建立測試資料
- [ ] 使用 FluentAssertions 進行驗證
- [ ] 測試方法命名：`Method_When條件_Should結果`

---

## 疑難排解 (Troubleshooting)

### Q1: Domain Model 和 DbModel 為何要分離？

**A:** 分離的目的是讓 Domain Model 專注於業務邏輯，不受資料庫結構影響。這樣可以：
- 業務邏輯變更不影響資料庫結構
- 資料庫欄位重命名不影響業務邏輯
- 更容易撰寫單元測試

### Q2: 為何 Repository 介面要放在 Services/ 而非 Repositories/？

**A:** 這是**依賴反轉原則（DIP）**的實踐。介面屬於 Application Layer，由 Domain/Application Layer 定義「需要什麼」，Infrastructure Layer 負責「如何實現」。

### Q3: 何時該用 Service 層？

**A:** 當操作需要**協調多個 Repository** 或需要**跨聚合的業務邏輯**時。若只是單一 Repository 的 CRUD，Controller 可直接呼叫 Repository。

### Q4: 快取邏輯為何不放在 Repository 內？

**A:** 使用 **Decorator 模式**分離關注點。Repository 專注於資料存取，Decorator 負責快取。這樣：
- Repository 保持單一職責
- 快取策略可彈性替換
- 測試時可獨立測試快取邏輯

---

## 常見錯誤與修正 (Common Mistakes)

### 錯誤 1: Domain Model 直接依賴 DbModel

```csharp
// ❌ 錯誤
public class DepositChannel
{
    public DbModel.DepositChannel DbModel { get; set; }
}

// ✅ 正確：使用 CreateDomain() 轉換
public class DbModel.DepositChannel
{
    public Domain.DepositChannel CreateDomain() { ... }
}
```

### 錯誤 2: Repository 混入快取邏輯

```csharp
// ❌ 錯誤
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;
        // ...
    }
}

// ✅ 正確：使用 Decorator
public class CustomerRepositoryDecorator : ICustomerRepository { ... }
```

### 錯誤 3: Service 包含過多業務邏輯

```csharp
// ❌ 錯誤
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        return channels.Where(c =>
            c.VipLevels.Contains(custContext.VipLevel)).ToList();
    }
}

// ✅ 正確：委託給 Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        return channels.GroupByDepositType(custContext);
    }
}
```

### 錯誤 4: 介面定義位置錯誤

```csharp
// ❌ 錯誤：介面定義在 Repositories 命名空間
namespace PaymentService.Repositories
{
    public interface ICustomerRepository { }
}

// ✅ 正確：介面定義在 Services 命名空間
namespace PaymentService.Services
{
    public interface ICustomerRepository { }
}
```

---

## 延伸閱讀

| 任務場景 | 參考文件 |
|----------|----------|
| 新增 Domain Model | [08-Domain Model 設計指南](zh-TW/08-Domain-Model-設計指南.md) |
| 實作 Repository | [09-Repository 模式](zh-TW/09-Repository-模式.md) |
| 加入快取機制 | [11-Decorator 模式設計規範](zh-TW/11-Decorator-模式設計規範.md) |
| 處理異常情境 | [13-異常處理與錯誤管理](zh-TW/13-異常處理與錯誤管理.md) |
| 撰寫單元測試 | [16-測試規範與指南](zh-TW/16-測試規範與指南.md) |
| TDD 與 Commit 紀律 | [07-TDD 與 Tidy First 實踐指南](zh-TW/07-TDD-與-Tidy-First-實踐指南.md) |

---

> **文件版本**: v1.0
> **最後更新**: 2025-01
