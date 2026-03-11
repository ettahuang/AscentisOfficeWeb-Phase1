# Decorator 模式設計規範

> 本文說明 PaymentService 專案中 Decorator 模式的設計原則與實作規範，主要用於實現快取、日誌等橫切關注點的分離。

---

## Decorator 模式概述

### 設計目的

Decorator 模式允許在**不修改原有類別**的情況下，動態地為物件添加新的功能。在 PaymentService 專案中，主要用於：

- **快取**：為 Repository 添加 Redis 快取
- **日誌**：記錄方法呼叫與結果
- **監控**：添加效能指標收集

### 架構圖

```
┌─────────────────────────────────────────────────┐
│  Service                                         │
│      ↓ 呼叫 ICustomerRepository                  │
├─────────────────────────────────────────────────┤
│  CustomerRepositoryDecorator (快取層)            │
│      ↓ Cache Miss 時呼叫                         │
├─────────────────────────────────────────────────┤
│  CustomerRepository (資料存取層)                  │
│      ↓                                           │
├─────────────────────────────────────────────────┤
│  Database                                        │
└─────────────────────────────────────────────────┘
```

### 與繼承的比較

| 面向 | 繼承 | Decorator（組合） |
|------|------|-------------------|
| 耦合度 | 高（編譯期綁定） | 低（執行期組合） |
| 彈性 | 低（靜態結構） | 高（動態組合） |
| 測試 | 困難 | 容易（可分別測試） |
| 擴展 | 需修改子類 | 新增 Decorator 即可 |

---

## Decorator 設計原則

### 原則一：只有一層 Decorator

避免多層 Decorator 嵌套，保持架構簡潔：

```csharp
// ✅ 正確：只有一層 Decorator
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

```csharp
// ❌ 避免：多層 Decorator 嵌套
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CacheDecorator>();      // 第一層
services.Decorate<ICustomerRepository, LoggingDecorator>();    // 第二層
services.Decorate<ICustomerRepository, MetricsDecorator>();    // 第三層
// 過於複雜，難以維護
```

### 原則二：只處理橫切關注點

Decorator 只負責橫切關注點，不包含業務邏輯：

```csharp
// ✅ 正確：只處理快取（橫切關注點）
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

```csharp
// ❌ 錯誤：Decorator 包含業務邏輯
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var customer = await _customerRepository.GetCustInfoAsync(custId);

        // ❌ 業務邏輯不應該在 Decorator
        if (customer.VipLevel < 3)
        {
            customer.Discount = 0;
        }

        return customer;
    }
}
```

### 原則三：透明委託

Decorator 的介面必須與被裝飾的類別完全一致：

```csharp
// 介面定義
public interface ICustomerRepository
{
    Task<Customer> GetCustInfoAsync(int custId);
    Task<int> GetPointLevelAsync(int custId);
    Task<CustomerContext> GetCustContextAsync(int custId);
}

// Decorator 實作所有方法
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;
    private readonly ICacheHelper _cacheHelper;

    // ✅ 實作所有介面方法
    public async Task<Customer> GetCustInfoAsync(int custId) { ... }
    public async Task<int> GetPointLevelAsync(int custId) { ... }
    public async Task<CustomerContext> GetCustContextAsync(int custId) { ... }
}
```

---

## 快取 Decorator 實作

### 完整範例：CustomerRepositoryDecorator

```csharp
namespace PaymentService.Repositories
{
    /// <summary>
    /// CustomerRepository 的快取 Decorator
    /// </summary>
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

        /// <summary>
        /// Cache Key: "CustInfo:{custId}", TTL: 1 分鐘
        /// </summary>
        public async Task<Customer> GetCustInfoAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"CustInfo:{custId}",
                TimeSpan.FromMinutes(1),
                async () => await _customerRepository.GetCustInfoAsync(custId)
            );
        }

        /// <summary>
        /// Cache Key: "PointLevel:{custId}", TTL: 1 分鐘
        /// 使用 RedisDataBase.Shared
        /// </summary>
        public async Task<int> GetPointLevelAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"PointLevel:{custId}",
                TimeSpan.FromMinutes(1),
                async () => await _customerRepository.GetPointLevelAsync(custId),
                RedisDataBase.Shared
            );
        }

        /// <summary>
        /// Cache Key: "CustomerContext:{custId}", TTL: 1 分鐘
        /// </summary>
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

### 完整範例：DepositRepositoryDecorator

```csharp
namespace PaymentService.Repositories
{
    public class DepositRepositoryDecorator : IDepositRepository
    {
        private readonly IDepositRepository _depositRepository;
        private readonly ICacheHelper _cacheHelper;

        public DepositRepositoryDecorator(
            IDepositRepository depositRepository,
            ICacheHelper cacheHelper)
        {
            _depositRepository = depositRepository;
            _cacheHelper = cacheHelper;
        }

        /// <summary>
        /// Cache Key: "DepositLimitInfos:{siteId}", TTL: 1 分鐘
        /// </summary>
        public async Task<DepositLimitInfos> GetDepositLimitInfosAsync(int siteId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"DepositLimitInfos:{siteId}",
                TimeSpan.FromMinutes(1),
                async () => await _depositRepository.GetDepositLimitInfosAsync(siteId)
            );
        }

        /// <summary>
        /// Cache Key: "DepositChannels:{siteId}", TTL: 30 秒
        /// </summary>
        public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"DepositChannels:{siteId}",
                TimeSpan.FromSeconds(30),
                async () => await _depositRepository.GetDepositChannelsAsync(siteId)
            );
        }
    }
}
```

---

## Cache Key 設計規範

### 命名規則

| 模式 | 範例 | 適用場景 |
|------|------|----------|
| `{Entity}:{Id}` | `CustInfo:12345` | 單一實體 |
| `{Entity}s:{ScopeId}` | `DepositChannels:1` | 集合資料 |
| `{Entity}:{Key1}:{Key2}` | `Limit:CNY:3` | 複合條件 |

### 命名範例

```csharp
// 客戶相關
$"CustInfo:{custId}"           // 客戶資訊
$"PointLevel:{custId}"         // 積分等級
$"CustomerContext:{custId}"    // 客戶上下文

// 存款相關
$"DepositChannels:{siteId}"    // 存款通道列表
$"DepositLimitInfos:{siteId}"  // 存款限額列表

// 複合條件
$"DepositLimit:{siteId}:{currency}:{vipLevel}"
```

### 避免的命名

```csharp
// ❌ 避免：太短或不明確
$"c:{custId}"          // 不知道是什麼
$"data:{id}"           // 太籠統

// ❌ 避免：包含特殊字元
$"cust:info:{custId}"  // 多個冒號可能造成解析問題

// ❌ 避免：使用物件的 ToString()
$"Customer:{customer}" // 可能序列化整個物件
```

---

## TTL 設計規範

### TTL 設定指南

| 資料類型 | 建議 TTL | 說明 |
|----------|----------|------|
| 即時性高 | 10-30 秒 | 存款通道狀態、餘額 |
| 中等頻率 | 1-5 分鐘 | 客戶資訊、VIP 等級 |
| 低頻變動 | 10-30 分鐘 | 系統設定、靜態資料 |
| 極少變動 | 1-24 小時 | 幣別設定、固定列表 |

### 專案範例

```csharp
// 客戶資訊：1 分鐘（中等頻率變動）
TimeSpan.FromMinutes(1)

// 存款通道：30 秒（可能有即時狀態變更）
TimeSpan.FromSeconds(30)

// 存款限額：1 分鐘
TimeSpan.FromMinutes(1)

// 站台設定：10 分鐘（低頻變動）
TimeSpan.FromMinutes(10)
```

---

## DI 註冊方式

### 使用 Scrutor 的 Decorate 方法

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 1. 先註冊原始 Repository
    services.AddScoped<ICustomerRepository, CustomerRepository>();

    // 2. 使用 Decorate 包裝 Decorator
    services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

    // DepositRepository 同理
    services.AddScoped<IDepositRepository, DepositRepository>();
    services.Decorate<IDepositRepository, DepositRepositoryDecorator>();

    // Service 註冊（依賴 Repository 介面）
    services.AddScoped<IDepositQueryService, DepositQueryService>();
}
```

### 註冊順序說明

```
1. AddScoped<ICustomerRepository, CustomerRepository>()
   → 容器內：ICustomerRepository = CustomerRepository

2. Decorate<ICustomerRepository, CustomerRepositoryDecorator>()
   → 容器內：ICustomerRepository = CustomerRepositoryDecorator
   → CustomerRepositoryDecorator 內部持有原本的 CustomerRepository
```

### 執行時期依賴關係

```
DepositQueryService
    ↓ 注入 ICustomerRepository
CustomerRepositoryDecorator
    ↓ 內部持有 ICustomerRepository
CustomerRepository
    ↓
Database
```

---

## Decorator 測試

### 單元測試 Decorator

```csharp
[TestFixture]
public class CustomerRepositoryDecoratorTests
{
    private Mock<ICustomerRepository> _mockInnerRepo;
    private Mock<ICacheHelper> _mockCacheHelper;
    private CustomerRepositoryDecorator _decorator;

    [SetUp]
    public void SetUp()
    {
        _mockInnerRepo = new Mock<ICustomerRepository>();
        _mockCacheHelper = new Mock<ICacheHelper>();
        _decorator = new CustomerRepositoryDecorator(
            _mockInnerRepo.Object,
            _mockCacheHelper.Object);
    }

    [Test]
    public async Task GetCustInfoAsync_ShouldUseCacheWithCorrectKeyAndTTL()
    {
        // Given
        var custId = 12345;
        var expectedCustomer = new CustomerBuilder().Build();

        _mockCacheHelper
            .Setup(c => c.TryGetOrCreateAsync(
                It.Is<string>(key => key == $"CustInfo:{custId}"),
                It.Is<TimeSpan>(ttl => ttl == TimeSpan.FromMinutes(1)),
                It.IsAny<Func<Task<Customer>>>(),
                It.IsAny<RedisDataBase>()))
            .ReturnsAsync(expectedCustomer);

        // When
        var result = await _decorator.GetCustInfoAsync(custId);

        // Then
        result.Should().Be(expectedCustomer);
        _mockCacheHelper.Verify(c => c.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            It.IsAny<Func<Task<Customer>>>(),
            It.IsAny<RedisDataBase>()), Times.Once);
    }

    [Test]
    public async Task GetCustInfoAsync_WhenCacheMiss_ShouldCallInnerRepository()
    {
        // Given
        var custId = 12345;
        var expectedCustomer = new CustomerBuilder().Build();

        _mockCacheHelper
            .Setup(c => c.TryGetOrCreateAsync(
                It.IsAny<string>(),
                It.IsAny<TimeSpan>(),
                It.IsAny<Func<Task<Customer>>>(),
                It.IsAny<RedisDataBase>()))
            .Returns((string key, TimeSpan ttl, Func<Task<Customer>> factory, RedisDataBase db) =>
                factory());  // 模擬 Cache Miss，呼叫 factory

        _mockInnerRepo
            .Setup(r => r.GetCustInfoAsync(custId))
            .ReturnsAsync(expectedCustomer);

        // When
        var result = await _decorator.GetCustInfoAsync(custId);

        // Then
        result.Should().Be(expectedCustomer);
        _mockInnerRepo.Verify(r => r.GetCustInfoAsync(custId), Times.Once);
    }
}
```

---

## ✅ Review Checklist

### Decorator 設計檢查

- [ ] 是否只有一層 Decorator？
- [ ] Decorator 是否只處理橫切關注點（快取、日誌）？
- [ ] Decorator 是否實作了完整的介面？
- [ ] 是否使用 `services.Decorate()` 註冊？

### Cache Key 檢查

- [ ] Cache Key 命名是否遵循 `{Entity}:{Id}` 模式？
- [ ] Cache Key 是否唯一，不會碰撞？
- [ ] 是否避免了特殊字元？

### TTL 檢查

- [ ] TTL 設定是否符合資料變動頻率？
- [ ] 高頻變動資料是否使用較短 TTL？
- [ ] 是否有文件記錄各 Cache Key 的 TTL？

---

## ✅ 新人常見踩雷點

### 1. 在 Decorator 中加入業務邏輯

```csharp
// ❌ 錯誤：Decorator 包含業務邏輯
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var customer = await _cacheHelper.TryGetOrCreateAsync(...);

        // ❌ 業務邏輯不應該在這裡
        if (customer.VipLevel >= 5)
        {
            customer.IsVip = true;
        }

        return customer;
    }
}

// ✅ 正確：Decorator 只處理快取
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

### 2. 忘記實作所有介面方法

```csharp
// ❌ 錯誤：只實作部分方法
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(...);
    }

    // ❌ 缺少 GetPointLevelAsync
    // ❌ 缺少 GetCustContextAsync
}

// ✅ 正確：實作所有方法
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId) { ... }
    public async Task<int> GetPointLevelAsync(int custId) { ... }
    public async Task<CustomerContext> GetCustContextAsync(int custId) { ... }
}
```

### 3. Cache Key 不一致或會碰撞

```csharp
// ❌ 錯誤：不同方法使用相同 Cache Key 模式
public async Task<Customer> GetCustInfoAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"Cust:{custId}", ...);
}

public async Task<CustomerContext> GetCustContextAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"Cust:{custId}", ...);  // 碰撞！
}

// ✅ 正確：使用不同的 Cache Key
public async Task<Customer> GetCustInfoAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"CustInfo:{custId}", ...);
}

public async Task<CustomerContext> GetCustContextAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"CustomerContext:{custId}", ...);
}
```

### 4. 使用 AddScoped 而非 Decorate

```csharp
// ❌ 錯誤：直接用 AddScoped 覆蓋
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.AddScoped<ICustomerRepository, CustomerRepositoryDecorator>();  // 覆蓋而非包裝

// ✅ 正確：使用 Decorate
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

---

## ✅ TL / Reviewer 檢查重點

### 架構審查

| 檢查項目 | 警示信號 |
|----------|----------|
| 多層 Decorator | 超過一層的 Decorate 呼叫 |
| 業務邏輯混入 | Decorator 中有 if-else 業務判斷 |
| 介面不完整 | Decorator 未實作所有介面方法 |

### 快取審查

- [ ] Cache Key 是否有潛在碰撞風險？
- [ ] TTL 設定是否合理？
- [ ] 是否有 Cache 失效策略（如資料更新時清除）？

### 效能審查

- [ ] 是否有不必要的快取（如已經很快的查詢）？
- [ ] 快取的資料量是否過大？
- [ ] 是否有考慮快取穿透問題？

---

> **文件版本**: v1.0
> **最後更新**: 2024-11
