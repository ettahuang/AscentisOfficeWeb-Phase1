# Repository 模式

> 本文說明 PaymentService 專案中 Repository 模式的設計原則與實作規範，包含介面設計、DbModel 分離、Decorator 快取層等核心概念。

---

## Repository 設計原則

### 核心職責

| 職責 | 說明 |
|------|------|
| **資料存取** | 執行資料庫查詢（Stored Procedure、SQL） |
| **模型轉換** | 將 DbModel 轉換為 Domain Model |
| **抽象資料源** | 隱藏資料存取細節 |

### 不應包含的職責

| 禁止項目 | 原因 |
|----------|------|
| 業務邏輯 | 應放在 Domain Model |
| 快取處理 | 應使用 Decorator 分離 |
| 日誌記錄 | 應使用 Decorator 或 Middleware |
| HTTP 呼叫 | 應獨立為其他 Infrastructure 服務 |

---

## 介面設計

### 介面定義位置

**重要**：Repository 介面定義於 `Services/` 命名空間（Application Layer），而非 `Repositories/` 命名空間。

```csharp
// ✅ 正確：介面在 Services/ 命名空間
namespace PaymentService.Services
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
        Task<int> GetPointLevelAsync(int custId);
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}

// ✅ 正確：實作在 Repositories/ 命名空間
namespace PaymentService.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        // 實作...
    }
}
```

```csharp
// ❌ 錯誤：介面在 Repositories/ 命名空間
namespace PaymentService.Repositories
{
    public interface ICustomerRepository { }  // 違反依賴反轉原則！
}
```

### 介面設計原則

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// 客戶資料存取介面
    /// </summary>
    public interface ICustomerRepository
    {
        /// <summary>
        /// 取得客戶基本資料
        /// </summary>
        /// <param name="custId">客戶 ID</param>
        /// <returns>客戶資料，若不存在則回傳 null</returns>
        Task<Customer> GetCustInfoAsync(int custId);

        /// <summary>
        /// 取得客戶積分等級
        /// </summary>
        Task<int> GetPointLevelAsync(int custId);

        /// <summary>
        /// 取得完整客戶上下文
        /// </summary>
        /// <exception cref="CustomerNotFoundException">客戶不存在時拋出</exception>
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}
```

### 介面設計檢查清單

- [ ] 介面是否在 `Services/` 命名空間？
- [ ] 方法回傳型別是否為 Domain Model？
- [ ] 是否有適當的 XML 文件註解？
- [ ] 介面是否小而專一（ISP）？

---

## Repository 實作

### 完整範例：CustomerRepository

```csharp
namespace PaymentService.Repositories
{
    /// <summary>
    /// 客戶資料存取實作
    /// </summary>
    public class CustomerRepository : ICustomerRepository
    {
        private readonly MySqlClient _mainDbClient;

        public CustomerRepository(IEnumerable<MySqlClient> mySqlClients)
        {
            var sqlClients = mySqlClients.ToList();
            _mainDbClient = sqlClients.First(client => client.DataBase == DataBase.Main);
        }

        /// <summary>
        /// 取得客戶資料
        /// </summary>
        public async Task<Customer> GetCustInfoAsync(int custId)
        {
            // 1. 執行 Stored Procedure，取得 DbModel
            var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
                "Customer_Get",
                new { CustId = custId });

            // 2. 使用 CreateDomain() 轉換為 Domain Model
            return dbCust?.CreateDomain();
        }

        /// <summary>
        /// 取得客戶積分等級
        /// </summary>
        public async Task<int> GetPointLevelAsync(int custId)
        {
            return await _mainDbClient.ExecuteScalarAsync<int>(
                "Member_PointLevel_Get",
                new { CustId = custId });
        }

        /// <summary>
        /// 取得完整客戶上下文
        /// </summary>
        public async Task<CustomerContext> GetCustContextAsync(int custId)
        {
            var customer = await GetCustInfoAsync(custId);

            // 業務例外：客戶不存在
            if (customer == null)
                throw new CustomerNotFoundException(custId);

            var pointLevel = await GetPointLevelAsync(custId);

            // 組合為 CustomerContext
            return new CustomerContext(customer, pointLevel);
        }
    }
}
```

### 完整範例：DepositRepository

```csharp
namespace PaymentService.Repositories
{
    public class DepositRepository : IDepositRepository
    {
        private readonly MySqlClient _reportDbClient;
        private readonly MySqlClient _mainDbClient;

        public DepositRepository(IEnumerable<MySqlClient> mySqlClients)
        {
            var sqlClients = mySqlClients.ToList();
            _mainDbClient = sqlClients.First(client => client.DataBase == DataBase.Main);
            _reportDbClient = sqlClients.First(client => client.DataBase == DataBase.Report);
        }

        /// <summary>
        /// 取得存款限額資訊
        /// </summary>
        public async Task<DepositLimitInfos> GetDepositLimitInfosAsync(int siteId)
        {
            var dbDepositLimitInfos = await _reportDbClient
                .QueryAsync<DbModel.DepositLimitInfo>(
                    "Service_DepositLimitInfo_Get",
                    new { _SiteId = siteId });

            // 轉換為 Domain Model
            var depositLimitInfos = dbDepositLimitInfos
                .Select(dbInfo => dbInfo.CreateDomain())
                .ToList();

            return new DepositLimitInfos(depositLimitInfos);
        }

        /// <summary>
        /// 取得存款通道（含限額資訊）
        /// </summary>
        public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
        {
            // ✅ 並行查詢優化
            var queryTask = _mainDbClient.QueryAsync<DbModel.DepositChannel>(
                "Service_Integrate_PayInfo_Get",
                new { _SiteId = siteId, _DepositType = (int)DepositTypeEnum.Undefined });

            var getDepositLimitInfosTask = GetDepositLimitInfosAsync(siteId);

            await Task.WhenAll(queryTask, getDepositLimitInfosTask);

            var dbDepositChannels = await queryTask;
            var depositLimitInfos = await getDepositLimitInfosTask;

            // 轉換為 Domain Model
            var depositChannelList = dbDepositChannels
                .Select(dbChannel => dbChannel.CreateDomain())
                .ToList();

            return new DepositChannels(depositChannelList, depositLimitInfos);
        }
    }
}
```

---

## DbModel 與 Domain Model 分離

### 分離的必要性

| 面向 | DbModel | Domain Model |
|------|---------|--------------|
| **職責** | 資料庫欄位映射 | 業務邏輯封裝 |
| **型別** | 原始型別（int, string） | 強型別（Enum, List） |
| **可變性** | 可變 | 不可變 |
| **依賴** | 無 | 無外部依賴 |

### DbModel 設計

```csharp
namespace PaymentService.Models.DbModel
{
    /// <summary>
    /// 資料庫映射模型（對應 Stored Procedure 回傳欄位）
    /// </summary>
    public class DepositChannel
    {
        // 資料庫欄位（原始型別）
        public int? SysId { get; init; }
        public string BankCode { get; init; }
        public string BankName { get; init; }
        public int PayId { get; init; }
        public int DepositType { get; init; }         // int
        public int PointLevel { get; init; }
        public string VipLevel { get; init; }          // JSON 字串
        public string TagExcludeList { get; init; }    // JSON 字串
        public int CurrencyId { get; init; }           // int
        public decimal MinAmount { get; init; }
        public decimal MaxAmount { get; init; }
        public int Sort { get; init; }

        /// <summary>
        /// 轉換為 Domain Model
        /// </summary>
        public Domain.DepositChannel CreateDomain()
        {
            return new Domain.DepositChannel
            {
                Currency = (CurrencyEnum)CurrencyId,              // int → Enum
                DepositType = (DepositTypeEnum)DepositType,       // int → Enum
                ExcludeTags = TagExcludeList.ParseJson<List<int>>(), // JSON → List
                VipLevels = VipLevel.ParseJson<List<int>>(),      // JSON → List
                PointLevel = PointLevel,
                MinAmount = MinAmount,
                MaxAmount = MaxAmount,
                Sort = Sort
            };
        }
    }
}
```

### CreateDomain 轉換重點

| 轉換類型 | 範例 |
|----------|------|
| int → Enum | `(CurrencyEnum)CurrencyId` |
| JSON → List | `VipLevel.ParseJson<List<int>>()` |
| JSON → Object | `ConfigJson.ParseJson<Config>()` |
| Nullable 處理 | `dbModel?.CreateDomain()` |

---

## Decorator 模式快取層

### 設計原則

使用 Decorator 模式將快取邏輯與資料存取邏輯分離：

```
┌────────────────────────────────────────┐
│ DepositRepositoryDecorator (快取層)     │
│ ┌────────────────────────────────────┐ │
│ │ DepositRepository (資料存取層)      │ │
│ └────────────────────────────────────┘ │
└────────────────────────────────────────┘
```

### Decorator 實作

```csharp
namespace PaymentService.Repositories
{
    public class CustomerRepositoryDecorator : ICustomerRepository
    {
        private readonly ICustomerRepository _customerRepository;
        private readonly ICacheHelper _cacheHelper;

        public CustomerRepositoryDecorator(
            ICustomerRepository customerRepository,
            ICacheHelper cacheHelper)
        {
            _customerRepository = customerRepository;
            _cacheHelper = cacheHelper;
        }

        public async Task<Customer> GetCustInfoAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"CustInfo:{custId}",           // Cache Key
                TimeSpan.FromMinutes(1),         // TTL
                async () => await _customerRepository.GetCustInfoAsync(custId)
            );
        }

        public async Task<int> GetPointLevelAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"PointLevel:{custId}",
                TimeSpan.FromMinutes(1),
                async () => await _customerRepository.GetPointLevelAsync(custId),
                RedisDataBase.Shared  // 指定 Redis DB
            );
        }

        public async Task<CustomerContext> GetCustContextAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"CustomerContext:{custId}",
                TimeSpan.FromMinutes(1),
                async () => await _customerRepository.GetCustContextAsync(custId)
            );
        }
    }
}
```

### DI 註冊

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 1. 註冊原始 Repository
    services.AddScoped<ICustomerRepository, CustomerRepository>();

    // 2. 使用 Decorate 加入 Decorator
    services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

    // DepositRepository 同理
    services.AddScoped<IDepositRepository, DepositRepository>();
    services.Decorate<IDepositRepository, DepositRepositoryDecorator>();
}
```

### Cache Key 設計規範

| 模式 | 範例 | 說明 |
|------|------|------|
| `{Entity}:{Id}` | `CustInfo:12345` | 單一實體 |
| `{Entity}s:{SiteId}` | `DepositChannels:1` | 集合資料 |
| `{Entity}:{Composite}` | `DepositLimit:1:CNY:3` | 複合條件 |

### TTL 設計建議

| 資料類型 | 建議 TTL | 說明 |
|----------|----------|------|
| 高頻變動 | 30 秒 | 存款通道狀態 |
| 中頻變動 | 1-5 分鐘 | 客戶資訊 |
| 低頻變動 | 10-30 分鐘 | 設定資料 |

---

## 效能優化

### 並行查詢

當需要查詢多個獨立資料源時，使用 `Task.WhenAll()` 並行處理：

```csharp
public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
{
    // ✅ 並行查詢
    var channelsTask = _mainDbClient.QueryAsync<DbModel.DepositChannel>(
        "Service_Integrate_PayInfo_Get", new { _SiteId = siteId });

    var limitsTask = GetDepositLimitInfosAsync(siteId);

    // 等待兩個查詢同時完成
    await Task.WhenAll(channelsTask, limitsTask);

    var channels = await channelsTask;
    var limits = await limitsTask;

    return new DepositChannels(
        channels.Select(c => c.CreateDomain()).ToList(),
        limits);
}
```

```csharp
// ❌ 錯誤：循序查詢
public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
{
    var channels = await _mainDbClient.QueryAsync<DbModel.DepositChannel>(...);
    var limits = await GetDepositLimitInfosAsync(siteId);  // 等待前一個完成才開始

    return new DepositChannels(...);
}
```

### 查詢優化建議

| 優化項目 | 說明 |
|----------|------|
| 只查詢需要的欄位 | SELECT 特定欄位而非 * |
| 使用索引 | 確保查詢條件有對應索引 |
| 批次查詢 | 避免 N+1 問題 |
| 快取熱點資料 | 使用 Decorator 快取 |

---

## Repository 測試

### 測試策略

> **重要規則**：Repository 只需要整合測試，不需要單元測試。

| 測試類型 | Repository | 原因 |
|----------|------------|------|
| ❌ 單元測試 | 不需要 | Repository 的核心職責是資料庫存取，Mock 資料庫無法驗證真實行為 |
| ✅ 整合測試 | 必要 | 驗證 SP 呼叫、參數傳遞、DbModel → Domain 轉換的正確性 |

**為什麼不需要單元測試？**

1. **Mock 無法驗證真實行為**：Repository 的價值在於正確呼叫 Stored Procedure 並轉換結果，Mock MySqlClient 只是在測試 Mock 設定
2. **維護成本高**：單元測試需要維護 Mock 設定，當 SP 參數或回傳結構改變時，單元測試可能仍然通過但實際已壞
3. **整合測試更有價值**：使用 Testcontainers 可以驗證端到端的資料流程，包含 SP 執行結果

**何時例外？**

- 如果 Repository 包含複雜的查詢條件組裝邏輯（如動態 SQL 拼接），可以針對該邏輯寫單元測試
- Decorator（如快取層）可以寫單元測試來驗證快取邏輯

### 整合測試（Testcontainers）

```csharp
[TestFixture]
public class CustomerRepositoryTests
{
    private MySqlContainerFixture _fixture;
    private CustomerRepository _repository;

    [OneTimeSetUp]
    public async Task Setup()
    {
        _fixture = await new MySqlContainerFixtureBuilder()
            .WithDatabase(DatabaseNames.Main)
            .BuildAsync();

        _repository = new CustomerRepository(_fixture.GetMySqlClients());
    }

    [Test]
    public async Task GetCustInfoAsync_WhenCustomerExists_ShouldReturnCustomer()
    {
        // Given
        var custId = await _fixture.InsertTestCustomer();

        // When
        var result = await _repository.GetCustInfoAsync(custId);

        // Then
        result.Should().NotBeNull();
        result.CustId.Should().Be(custId);
    }
}
```

---

## ✅ Review Checklist

### 介面設計檢查

- [ ] 介面是否定義於 `Services/` 命名空間？
- [ ] 方法回傳型別是否為 Domain Model（非 DbModel）？
- [ ] 是否有適當的 XML 文件註解？
- [ ] 介面是否小而專一？

### 實作檢查

- [ ] 是否使用 `CreateDomain()` 進行模型轉換？
- [ ] 是否有處理 null 的情況？
- [ ] 是否使用 `Task.WhenAll()` 優化並行查詢？
- [ ] 快取是否透過 Decorator 分離？

### Decorator 檢查

- [ ] Cache Key 命名是否一致？
- [ ] TTL 設定是否合理？
- [ ] DI 是否使用 `services.Decorate()` 註冊？

---

## ✅ 新人常見踩雷點

### 1. 介面定義在錯誤位置

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

### 2. 回傳 DbModel 而非 Domain Model

```csharp
// ❌ 錯誤：回傳 DbModel
public async Task<DbModel.Customer> GetCustInfoAsync(int custId)
{
    return await _db.QueryFirstAsync<DbModel.Customer>(...);
}

// ✅ 正確：回傳 Domain Model
public async Task<Customer> GetCustInfoAsync(int custId)
{
    var dbModel = await _db.QueryFirstAsync<DbModel.Customer>(...);
    return dbModel?.CreateDomain();
}
```

### 3. 快取邏輯混入 Repository

```csharp
// ❌ 錯誤：Repository 直接處理快取
public class CustomerRepository : ICustomerRepository
{
    private readonly ICacheHelper _cache;  // 不應該有

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;

        var data = await _db.Query(...);
        await _cache.SetAsync($"Cust:{custId}", data);
        return data;
    }
}

// ✅ 正確：使用 Decorator 處理快取
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var dbModel = await _db.QueryFirstAsync<DbModel.Customer>(...);
        return dbModel?.CreateDomain();
    }
}

public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cache.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            () => _repo.GetCustInfoAsync(custId));
    }
}
```

### 4. 忘記使用 Task.WhenAll

```csharp
// ❌ 錯誤：循序查詢
var customer = await _customerRepo.GetCustInfoAsync(custId);
var pointLevel = await _customerRepo.GetPointLevelAsync(custId);

// ✅ 正確：並行查詢
var customerTask = _customerRepo.GetCustInfoAsync(custId);
var pointLevelTask = _customerRepo.GetPointLevelAsync(custId);
await Task.WhenAll(customerTask, pointLevelTask);

var customer = await customerTask;
var pointLevel = await pointLevelTask;
```

---

## ✅ TL / Reviewer 檢查重點

### 架構審查

| 檢查項目 | 警示信號 |
|----------|----------|
| 介面位置 | `using PaymentService.Services` 出現在 Repository 介面定義檔 |
| DbModel 洩漏 | Repository 方法回傳 `DbModel.XXX` |
| 快取混入 | Repository 有 `ICacheHelper` 依賴 |
| 職責越界 | Repository 有業務邏輯判斷 |

### 效能審查

- [ ] 是否有 N+1 查詢問題？
- [ ] 是否使用 `Task.WhenAll()` 並行化？
- [ ] Cache Key 是否有碰撞風險？
- [ ] TTL 是否設定合理？

### 測試審查

- [ ] Repository 是否可被 Mock？
- [ ] 是否有整合測試覆蓋？

---

> **文件版本**: v1.0
> **最後更新**: 2024-11
