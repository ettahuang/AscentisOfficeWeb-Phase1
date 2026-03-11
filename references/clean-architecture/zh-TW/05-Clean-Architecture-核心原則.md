# Clean Architecture 核心原則

> 本文說明 PaymentService 專案遵循的 Clean Architecture 核心原則，並透過實際程式碼範例展示如何落實這些原則。

---

## 七大核心原則總覽

| 原則 | 說明 | 專案實踐 |
|------|------|----------|
| **依賴反轉原則 (DIP)** | 高層模組不依賴低層模組，兩者都依賴抽象 | Repository 介面定義於 Application Layer |
| **關注點分離 (SoC)** | 不同關注點應分離至不同模組 | Domain/Application/Infrastructure 分層 |
| **開放封閉原則 (OCP)** | 對擴展開放，對修改封閉 | Decorator 模式實現快取擴展 |
| **單一職責原則 (SRP)** | 一個類別只有一個改變的理由 | Domain Model 只處理業務邏輯 |
| **領域驅動設計 (DDD)** | 以業務領域為核心設計軟體 | Rich Domain Model 封裝業務規則 |
| **介面隔離原則 (ISP)** | 不應強迫客戶端依賴不需要的介面 | 小而專一的 Repository 介面 |
| **YAGNI 原則** | 不要實作目前不需要的功能 | 只建立有明確當前使用場景的方法 |

---

## 原則一：依賴反轉原則 (DIP)

### 原則定義

> 高層模組不應該依賴低層模組，兩者都應該依賴抽象。
> 抽象不應該依賴細節，細節應該依賴抽象。

### 專案實踐

**介面定義於 Application Layer（高層）**：

```csharp
// Services/ICustomerRepository.cs - Application Layer 定義介面
namespace PaymentService.Services
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}
```

**實作位於 Infrastructure Layer（低層）**：

```csharp
// Repositories/CustomerRepository.cs - Infrastructure Layer 實作
namespace PaymentService.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        private readonly MySqlClient _mainDbClient;

        public async Task<Customer> GetCustInfoAsync(int custId)
        {
            var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
                "Customer_Get", new { CustId = custId });
            return dbCust?.CreateDomain();
        }
    }
}
```

**Service 依賴介面而非實作**：

```csharp
// Services/DepositQueryService.cs
public class DepositQueryService : IDepositQueryService
{
    // ✅ 依賴介面
    private readonly ICustomerRepository _customerRepository;
    private readonly IDepositRepository _depositRepository;

    public DepositQueryService(
        ICustomerRepository customerRepository,  // 注入介面
        IDepositRepository depositRepository)
    {
        _customerRepository = customerRepository;
        _depositRepository = depositRepository;
    }
}
```

### 違反原則的錯誤示範

```csharp
// ❌ 錯誤：直接依賴具體實作
public class DepositQueryService
{
    private readonly CustomerRepository _customerRepository;  // 直接依賴實作類別

    public DepositQueryService(CustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }
}

// ❌ 錯誤：介面定義在 Infrastructure Layer
namespace PaymentService.Repositories  // 錯誤的命名空間
{
    public interface ICustomerRepository { }
}
```

### DIP 的好處

| 好處 | 說明 |
|------|------|
| **可測試性** | 可使用 Mock 替換實作進行單元測試 |
| **可替換性** | 可輕鬆替換 Repository 實作（如換資料庫） |
| **解耦合** | Application Layer 不知道 Infrastructure 的細節 |

---

## 原則二：關注點分離 (SoC)

### 原則定義

> 將程式碼按照不同的關注點分離到不同的模組，每個模組只處理單一關注點。

### 專案實踐

**各層關注點**：

| 層級 | 關注點 | 範例 |
|------|--------|------|
| Domain | 業務邏輯 | `DepositChannel.IsSupported()` |
| Application | 用例協調 | `DepositQueryService.GetDepositChannelsByDepositTypeAsync()` |
| Infrastructure | 技術細節 | `CustomerRepository` 資料庫存取 |
| Presentation | HTTP 處理 | `CustomerController` 請求回應 |

**橫切關注點分離**：

```csharp
// 快取關注點 - 透過 Decorator 分離
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

// 異常處理關注點 - 透過 Middleware 分離
public class GlobalExceptionMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            await HandleExceptionAsync(context, ex);
        }
    }
}
```

### 違反原則的錯誤示範

```csharp
// ❌ 錯誤：Repository 混入多種關注點
public class CustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        // 快取關注點混入
        var cached = await _redis.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;

        // 資料存取關注點
        var data = await _db.Query(...);

        // 日誌關注點混入
        _logger.LogInformation("Retrieved customer {CustId}", custId);

        // 快取關注點混入
        await _redis.SetAsync($"Cust:{custId}", data);

        return data;
    }
}
```

---

## 原則三：開放封閉原則 (OCP)

### 原則定義

> 軟體實體（類別、模組、函式）應該對擴展開放，對修改封閉。

### 專案實踐：Decorator 模式

透過 Decorator 模式，可以在不修改原有 Repository 的情況下，擴展快取功能：

```csharp
// 原有的 Repository（不需修改）
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _mainDbClient.QueryFirstAsync<Customer>(...);
    }
}

// 擴展：加入快取功能（不修改原有程式碼）
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            () => _inner.GetCustInfoAsync(custId)  // 委託給原有實作
        );
    }
}
```

**DI 註冊實現擴展**：

```csharp
// Startup.cs
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();  // 擴展
```

### 違反原則的錯誤示範

```csharp
// ❌ 錯誤：為了加快取功能而修改原有類別
public class CustomerRepository : ICustomerRepository
{
    private readonly ICacheHelper _cache;  // 新增依賴

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        // 修改原有邏輯
        var cached = await _cache.GetAsync(...);
        if (cached != null) return cached;

        var data = await _db.Query(...);
        await _cache.SetAsync(...);
        return data;
    }
}
```

---

## 原則四：單一職責原則 (SRP)

### 原則定義

> 一個類別應該只有一個引起它變化的原因。

### 專案實踐

**Domain Model 單一職責：封裝業務邏輯**

```csharp
// DepositChannel.cs - 只負責存款通道的業務規則
public class DepositChannel
{
    // 業務規則：判斷客戶是否適用此通道
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsReachedPointLevel(PointLevel)
               && custContext.IsVipLevelInScope(VipLevels)
               && !custContext.IsTagInScope(ExcludeTags);
    }

    // 業務規則：計算金額交集
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return new DepositChannel(
            Currency, DepositType, ExcludeTags, VipLevels, PointLevel,
            Math.Max(MinAmount, limitInfo.MinAmount),
            Math.Min(MaxAmount, limitInfo.MaxAmount),
            Sort);
    }
}
```

**Repository 單一職責：資料存取**

```csharp
// CustomerRepository.cs - 只負責客戶資料的存取
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
            "Customer_Get", new { CustId = custId });
        return dbCust?.CreateDomain();
    }
}
```

**Service 單一職責：協調多個 Repository**

```csharp
// DepositQueryService.cs - 只負責協調，不處理業務邏輯
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

### 職責分配表

| 類別 | 職責 | 不應包含 |
|------|------|----------|
| Domain Model | 業務邏輯、驗證規則 | 資料存取、HTTP 處理、快取 |
| Repository | 資料存取、模型轉換 | 業務邏輯、快取、日誌 |
| Decorator | 橫切關注點（快取、日誌） | 業務邏輯、複雜查詢 |
| Service | 協調多個 Repository | 業務邏輯、資料存取 |
| Controller | HTTP 請求處理 | 業務邏輯、資料存取 |

---

## 原則五：領域驅動設計 (DDD)

### Rich Model vs Anemic Model

| 類型 | 特徵 | 專案選擇 |
|------|------|----------|
| **Rich Model** | 資料 + 行為封裝在一起 | ✅ 採用 |
| **Anemic Model** | 只有資料，邏輯在外部 Service | ❌ 避免 |

### Rich Model 實作範例

```csharp
// ✅ Rich Model：業務邏輯封裝於 Domain Model
public class DepositChannel
{
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
        return new DepositChannel(...);
    }
}
```

### Anemic Model 錯誤示範

```csharp
// ❌ Anemic Model：Domain Model 只有資料
public class DepositChannel
{
    public CurrencyEnum Currency { get; set; }
    public List<int> VipLevels { get; set; }
    // 沒有業務方法
}

// ❌ 業務邏輯外移到 Service
public class DepositService
{
    public bool IsChannelSupported(DepositChannel channel, CustomerContext context)
    {
        // 邏輯應該在 Domain Model 內
        return context.Currency == channel.Currency
               && channel.VipLevels.Contains(context.VipLevel);
    }
}
```

### 領域語言命名

使用業務領域的語言命名，而非技術術語：

| 技術命名 | 領域命名 |
|----------|----------|
| `CheckVipLevel()` | `IsVipLevelInScope()` |
| `FilterByCondition()` | `IsSupported()` |
| `UpdateAmount()` | `WithAmountLimit()` |
| `GetData()` | `GetCustContextAsync()` |

---

## 原則六：介面隔離原則 (ISP)

### 原則定義

> 不應該強迫客戶端依賴它不需要的介面。

### 專案實踐

**小而專一的介面**：

```csharp
// ✅ 專一的 Repository 介面
public interface ICustomerRepository
{
    Task<Customer> GetCustInfoAsync(int custId);
    Task<int> GetPointLevelAsync(int custId);
    Task<CustomerContext> GetCustContextAsync(int custId);
}

public interface IDepositRepository
{
    Task<DepositChannels> GetDepositChannelsAsync(int siteId);
    Task<DepositLimitInfos> GetDepositLimitInfosAsync(int siteId);
}
```

### 違反原則的錯誤示範

```csharp
// ❌ 錯誤：肥大的介面
public interface IPaymentRepository
{
    // Customer 相關
    Task<Customer> GetCustInfoAsync(int custId);
    Task<int> GetPointLevelAsync(int custId);

    // Deposit 相關
    Task<List<DepositChannel>> GetDepositChannels(int siteId);
    Task<List<DepositLimit>> GetDepositLimits(int siteId);

    // Withdrawal 相關
    Task<List<WithdrawalChannel>> GetWithdrawalChannels(int siteId);

    // 其他
    Task<Config> GetConfig(string key);
}

// 使用時，客戶端被迫依賴不需要的方法
public class DepositQueryService
{
    private readonly IPaymentRepository _repo;  // 依賴整個肥大介面
}
```

---

## 原則七：YAGNI 原則 (You Aren't Gonna Need It)

### 原則定義

> 不要實作目前不需要的功能。避免基於對未來需求的推測而建立功能。

### 為什麼 YAGNI 很重要

| 問題 | 影響 |
|------|------|
| **浪費精力** | 花時間建立未被使用的功能 |
| **增加複雜度** | 更多程式碼需要維護和測試 |
| **錯誤的抽象** | 過早設計可能不符合實際需求 |
| **技術債務** | 未使用的程式碼成為維護負擔 |

### 專案實踐

**只實作有明確當前使用場景的方法**：

```csharp
// ✅ 正確：只有實際需要的方法
public sealed class ClaimHistory
{
    public bool HasAnyClaim => _records.Count > 0;
    public int Count => _records.Count;

    // 這些方法有明確的業務使用場景
    public bool HasClaimedBonus(string bonusCode)
        => _records.Any(r => r.BonusCode == bonusCode);

    public bool HasClaimedBonus(int bonusId)
        => _records.Any(r => r.BonusId == bonusId);

    public bool HasClaimedAny(params PromotionTypeEnum[] promotionTypes)
        => _records.Any(r => promotionTypes.Contains(r.PromotionType));
}
```

### 違反原則的錯誤示範

```csharp
// ❌ 錯誤：「以防萬一」建立的方法，沒有當前使用場景
public sealed class ClaimHistory
{
    // 這些方法是推測性建立的，不是基於實際需求
    public IEnumerable<ClaimRecord> GetRecords() => _records;  // 暴露內部資料
    public MarketDateTime? GetLastClaimDate(string bonusCode) => ...;  // 沒有當前使用場景
    public IEnumerable<ClaimRecord> GetByPromotionTypes(...) => ...;  // 沒有當前使用場景
    public IEnumerable<ClaimRecord> GetByCategoryId(int categoryId) => ...;  // 沒有當前使用場景
}
```

### YAGNI 決策檢查清單

在新增方法或功能之前，先問：

| 問題 | 如果答案是否定的... |
|------|---------------------|
| 這個功能有**當前**使用場景嗎？ | 不要建立 |
| 這會在**當前 sprint/迭代**中被使用嗎？ | 延後處理 |
| 需求是**具體的**還是推測的？ | 等待具體需求 |
| 移除這個會破壞**現有功能**嗎？ | 可以安全移除 |

### 何時應用 YAGNI

| 場景 | 應用 YAGNI？ | 原因 |
|------|--------------|------|
| 建立 Domain Model 方法 | ✅ 是 | 只新增有明確業務用途的方法 |
| 新增 Repository 查詢方法 | ✅ 是 | 只新增實際會被呼叫的查詢 |
| 設計 API 端點 | ✅ 是 | 只暴露需要的端點 |
| 建立測試輔助方法 | ⚠️ 謹慎 | 測試輔助方法可能鼓勵測試實作細節 |

### YAGNI 的好處

| 好處 | 說明 |
|------|------|
| **更簡單的程式碼庫** | 更少的程式碼需要閱讀、理解和維護 |
| **更快的開發速度** | 專注於當前需要的功能 |
| **更好的抽象** | 基於真實需求設計，而非推測 |
| **更容易重構** | 更少的程式碼意味著更容易變更 |

### 與其他原則的關係

| 原則 | 與 YAGNI 的關係 |
|------|-----------------|
| **SRP** | YAGNI 幫助避免新增不必要的職責 |
| **ISP** | YAGNI 防止介面膨脹 |
| **OCP** | 在需要時才建立擴展點，而非提前建立 |

---

## 原則應用總結

### 設計決策檢查表

| 問題 | 對應原則 | 正確做法 |
|------|----------|----------|
| 介面定義在哪裡？ | DIP | Application Layer (Services/) |
| 快取邏輯放哪裡？ | SoC, OCP | Decorator |
| 要加新功能時？ | OCP | 擴展而非修改 |
| 這個類別做了什麼？ | SRP | 只做一件事 |
| 業務邏輯放哪裡？ | DDD | Domain Model |
| 介面是否太大？ | ISP | 拆分成小介面 |
| 這個功能現在需要嗎？ | YAGNI | 只建立當前需要的功能 |

---

## ✅ Review Checklist

### 原則遵循檢查

- [ ] Repository 介面是否定義於 `Services/` 命名空間？（DIP）
- [ ] 橫切關注點是否透過 Decorator/Middleware 分離？（SoC）
- [ ] 新功能是否透過擴展而非修改實現？（OCP）
- [ ] 每個類別是否只有單一職責？（SRP）
- [ ] Domain Model 是否包含業務邏輯方法？（DDD）
- [ ] 介面是否小而專一？（ISP）
- [ ] 每個方法/功能是否都是當前實際需要的？（YAGNI）

### 程式碼品質檢查

- [ ] Service 是否只做協調，不包含業務邏輯？
- [ ] Domain Model 是否使用 `init` setter 保持不可變性？
- [ ] 方法命名是否使用領域語言？

---

## ✅ 新人常見踩雷點

### 1. 介面定義位置錯誤

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

### 2. Service 包含過多業務邏輯

```csharp
// ❌ 錯誤：業務邏輯在 Service
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

// ✅ 正確：委託給 Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        return channels.GroupByDepositType(custContext);  // 委託給 Domain Model
    }
}
```

### 3. 為了加功能而修改原有程式碼

```csharp
// ❌ 錯誤：修改原有 Repository 加入快取
public class CustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.Get(...);  // 修改原有程式碼
        // ...
    }
}

// ✅ 正確：使用 Decorator 擴展
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

---

## ✅ TL / Reviewer 檢查重點

### 架構原則審查

| 原則 | 檢查點 | 警示信號 |
|------|--------|----------|
| DIP | 介面位置 | `using PaymentService.Repositories` 出現在 Application Layer |
| SoC | 關注點混合 | Repository 內有 `_cache` 或 `_logger` |
| OCP | 修改原有程式碼 | 為了加功能修改已有類別的核心邏輯 |
| SRP | 類別過大 | 類別超過 200 行或有超過 5 個依賴 |
| DDD | 貧血模型 | Domain Model 只有 getter/setter |
| ISP | 肥大介面 | 介面有超過 7 個方法 |
| YAGNI | 推測性功能 | 「以防萬一」建立的方法/類別，沒有當前呼叫者 |

### 程式碼審查問題

- [ ] 「這個邏輯為什麼不在 Domain Model？」
- [ ] 「為什麼要修改原有的類別？能用 Decorator 嗎？」
- [ ] 「這個介面是不是太大了？需要拆分嗎？」
- [ ] 「這個 Service 是不是做太多事了？」
- [ ] 「這個方法實際有在使用嗎？當前的使用場景是什麼？」

---

> **文件版本**: v1.0
> **最後更新**: 2024-11
