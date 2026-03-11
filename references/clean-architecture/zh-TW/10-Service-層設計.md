# Service 層設計

> 本文說明 PaymentService 專案中 Service 層的設計原則與實作規範，包含何時需要 Service、Service 的職責邊界、以及如何正確委託業務邏輯給 Domain Model。

---

## Service 層定位

### 在 Clean Architecture 中的位置

```
┌─────────────────────────────────────────┐
│  Controller (Presentation)               │
│         ↓ 呼叫                           │
├─────────────────────────────────────────┤
│  Service (Application)  ← 你在這裡       │
│         ↓ 協調                           │
├─────────────────────────────────────────┤
│  Repository Interface (Application)      │
│         ↓ 實作                           │
├─────────────────────────────────────────┤
│  Repository (Infrastructure)             │
└─────────────────────────────────────────┘
```

### Service 層核心職責

| 職責 | 說明 | 範例 |
|------|------|------|
| **協調多個 Repository** | 呼叫多個資料來源 | 同時取得 Customer 和 DepositChannels |
| **編排業務流程** | 決定呼叫順序 | 先驗證客戶存在，再查詢通道 |
| **委託業務邏輯** | 將運算交給 Domain Model | `depositChannels.GroupByDepositType()` |
| **組裝結果** | 將多個來源資料組合 | 建立 `DepositChannelsByDepositType` |

---

## 何時需要 Service 層？

### 需要 Service 的情境

| 情境 | 說明 |
|------|------|
| 協調多個 Repository | 需要同時存取 Customer 和 Deposit 資料 |
| 跨聚合操作 | 操作涉及多個聚合根 |
| 複雜流程編排 | 需要多步驟的業務流程 |
| 交易邊界控制 | 需要在多個操作間維持交易一致性 |

### 不需要 Service 的情境

| 情境 | 建議做法 |
|------|----------|
| 單一 Repository CRUD | Controller 直接呼叫 Repository |
| 純資料查詢 | Controller 直接呼叫 Repository |
| 簡單的資料轉換 | 在 Controller 或 Domain Model 處理 |

---

## Service 設計原則

### 原則一：只做協調，不做業務邏輯

```csharp
// ✅ 正確：Service 只協調，業務邏輯在 Domain Model
public class DepositQueryService : IDepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        // 1. 協調：取得客戶上下文
        var custContext = await _customerRepository.GetCustContextAsync(custId);

        // 2. 協調：取得存款通道
        var siteId = custContext.Customer.SiteId;
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

        // 3. 委託：業務邏輯交給 Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}
```

```csharp
// ❌ 錯誤：Service 包含業務邏輯
public class DepositQueryService : IDepositQueryService
{
    public async Task<List<DepositChannel>> GetChannelsAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var channels = await _depositRepository.GetChannelsAsync(custContext.Customer.SiteId);

        // ❌ 這些邏輯應該在 Domain Model！
        return channels
            .Where(c => c.VipLevels.Contains(custContext.Customer.VipLevel))
            .Where(c => c.Currency == custContext.Customer.Currency)
            .Where(c => !c.ExcludeTags.Intersect(custContext.Customer.Tags).Any())
            .Where(c => c.PointLevel <= custContext.PointLevel)
            .ToList();
    }
}
```

### 原則二：依賴介面，非實作

```csharp
public class DepositQueryService : IDepositQueryService
{
    // ✅ 依賴介面
    private readonly ICustomerRepository _customerRepository;
    private readonly IDepositRepository _depositRepository;

    public DepositQueryService(
        ICustomerRepository customerRepository,   // 介面
        IDepositRepository depositRepository)     // 介面
    {
        _customerRepository = customerRepository;
        _depositRepository = depositRepository;
    }
}
```

```csharp
// ❌ 錯誤：依賴具體實作
public class DepositQueryService
{
    private readonly CustomerRepository _customerRepository;  // 具體類別
    private readonly DepositRepository _depositRepository;    // 具體類別
}
```

### 原則三：不處理橫切關注點

| 橫切關注點 | 正確處理方式 |
|------------|--------------|
| 快取 | Repository Decorator |
| 日誌 | Middleware / Decorator |
| 交易 | Unit of Work Pattern |
| 驗證 | Domain Model / Controller |

---

## 完整 Service 實作範例

### 介面定義

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// 存款查詢服務介面
    /// </summary>
    public interface IDepositQueryService
    {
        /// <summary>
        /// 取得客戶可用的存款通道（依存款類型分組）
        /// </summary>
        /// <param name="custId">客戶 ID</param>
        /// <returns>依存款類型分組的存款通道</returns>
        /// <exception cref="CustomerNotFoundException">客戶不存在時拋出</exception>
        Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId);
    }
}
```

### 實作

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// 存款查詢服務
    /// 協調 CustomerRepository 和 DepositRepository 以完成存款通道查詢用例
    /// </summary>
    public class DepositQueryService : IDepositQueryService
    {
        private readonly ICustomerRepository _customerRepository;
        private readonly IDepositRepository _depositRepository;

        public DepositQueryService(
            ICustomerRepository customerRepository,
            IDepositRepository depositRepository)
        {
            _customerRepository = customerRepository;
            _depositRepository = depositRepository;
        }

        /// <summary>
        /// 取得客戶可用的存款通道（依存款類型分組）
        /// </summary>
        public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
        {
            // Step 1: 取得客戶上下文（含驗證客戶存在）
            var custContext = await _customerRepository.GetCustContextAsync(custId);

            // Step 2: 取得該站台的存款通道
            var siteId = custContext.Customer.SiteId;
            var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

            // Step 3: 委託 Domain Model 進行業務邏輯處理
            // - 篩選客戶適用的通道
            // - 依存款類型分組
            // - 套用存款限額
            return depositChannels.GroupByDepositType(custContext);
        }
    }
}
```

---

## 委託業務邏輯給 Domain Model

### 正確的委託模式

```csharp
// Service 層
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

        // ✅ 委託給 Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}

// Domain Model 層
public class DepositChannels
{
    public DepositChannelsByDepositType GroupByDepositType(CustomerContext custContext)
    {
        var channelsByType = new Dictionary<DepositTypeEnum, IList<DepositChannel>>();

        // 業務邏輯在這裡
        var payInfoGrouping = DepositChannelList
            .Where(channel => channel.IsSupported(custContext))  // 委託給 DepositChannel
            .GroupBy(channel => channel.DepositType);

        foreach (var group in payInfoGrouping)
        {
            if (!DepositLimitInfos.TryResolveLimit(custContext, group.Key, out var depositLimitInfo))
                continue;

            var payInfo = group
                .Where(channel => channel.IsOverlappingWith(depositLimitInfo))
                .Select(channel => channel.WithAmountLimit(depositLimitInfo))
                .ToList();

            if (!payInfo.Any())
                continue;

            channelsByType.Add(group.Key, payInfo);
        }

        return new DepositChannelsByDepositType(channelsByType);
    }
}
```

### 委託層級

```
Service.GetDepositChannelsByDepositTypeAsync()
    ↓ 委託
DepositChannels.GroupByDepositType()
    ↓ 委託
DepositChannel.IsSupported()
DepositChannel.IsOverlappingWith()
DepositChannel.WithAmountLimit()
DepositLimitInfos.TryResolveLimit()
```

---

## 並行查詢優化

### 何時使用並行查詢

當 Service 需要呼叫多個**獨立**的 Repository 方法時，使用 `Task.WhenAll()` 進行並行處理。

### 範例：並行查詢

```csharp
public class DepositQueryService : IDepositQueryService
{
    public async Task<DepositSummary> GetDepositSummaryAsync(int custId)
    {
        // 先取得客戶資訊（後續查詢需要 siteId）
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var siteId = custContext.Customer.SiteId;

        // ✅ 並行查詢獨立的資料
        var channelsTask = _depositRepository.GetDepositChannelsAsync(siteId);
        var historyTask = _depositRepository.GetDepositHistoryAsync(custId);
        var configTask = _configRepository.GetSiteConfigAsync(siteId);

        await Task.WhenAll(channelsTask, historyTask, configTask);

        var channels = await channelsTask;
        var history = await historyTask;
        var config = await configTask;

        // 組裝結果
        return new DepositSummary(
            channels.GroupByDepositType(custContext),
            history,
            config);
    }
}
```

### 注意事項

```csharp
// ❌ 錯誤：有依賴關係的查詢不能並行
var custContextTask = _customerRepository.GetCustContextAsync(custId);
var channelsTask = _depositRepository.GetDepositChannelsAsync(siteId);  // 需要 siteId！
await Task.WhenAll(custContextTask, channelsTask);  // siteId 還沒取得！

// ✅ 正確：有依賴關係的循序處理
var custContext = await _customerRepository.GetCustContextAsync(custId);
var siteId = custContext.Customer.SiteId;  // 取得 siteId
var channels = await _depositRepository.GetDepositChannelsAsync(siteId);
```

---

## Service 與 Controller 的互動

### Controller 呼叫 Service

```csharp
[ApiController]
[Route("api/[controller]")]
public class CustomerController : ControllerBase
{
    private readonly IDepositQueryService _depositQueryService;

    public CustomerController(IDepositQueryService depositQueryService)
    {
        _depositQueryService = depositQueryService;
    }

    [HttpPost("GetDepositOptions")]
    public async Task<IActionResult> GetDepositOptions(
        [FromBody] GetDepositOptionsRequest request)
    {
        // Controller 只呼叫 Service，不處理業務邏輯
        var result = await _depositQueryService
            .GetDepositChannelsByDepositTypeAsync(request.CustId);

        return Ok(ApiResult.Success(result));
    }
}
```

### 職責劃分

| 層級 | 職責 |
|------|------|
| **Controller** | HTTP 處理、輸入驗證、回應格式化 |
| **Service** | 協調 Repository、編排流程、委託 Domain |
| **Repository** | 資料存取、模型轉換 |
| **Domain Model** | 業務邏輯、業務規則驗證 |

---

## DI 註冊

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // Repository 註冊
    services.AddScoped<ICustomerRepository, CustomerRepository>();
    services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

    services.AddScoped<IDepositRepository, DepositRepository>();
    services.Decorate<IDepositRepository, DepositRepositoryDecorator>();

    // Service 註冊
    services.AddScoped<IDepositQueryService, DepositQueryService>();
}
```

---

## Service 測試

### 單元測試

```csharp
[TestFixture]
public class DepositQueryServiceTests
{
    private Mock<ICustomerRepository> _mockCustomerRepo;
    private Mock<IDepositRepository> _mockDepositRepo;
    private DepositQueryService _service;

    [SetUp]
    public void SetUp()
    {
        _mockCustomerRepo = new Mock<ICustomerRepository>();
        _mockDepositRepo = new Mock<IDepositRepository>();
        _service = new DepositQueryService(
            _mockCustomerRepo.Object,
            _mockDepositRepo.Object);
    }

    [Test]
    public async Task GetDepositChannelsByDepositTypeAsync_WhenCustomerExists_ShouldReturnGroupedChannels()
    {
        // Given
        var custId = 12345;
        var custContext = new CustomerContextBuilder()
            .With(siteId: 1, vipLevel: 3)
            .Build();

        var depositChannels = new DepositChannelsBuilder()
            .WithChannels(3)
            .Build();

        _mockCustomerRepo
            .Setup(r => r.GetCustContextAsync(custId))
            .ReturnsAsync(custContext);

        _mockDepositRepo
            .Setup(r => r.GetDepositChannelsAsync(It.IsAny<int>()))
            .ReturnsAsync(depositChannels);

        // When
        var result = await _service.GetDepositChannelsByDepositTypeAsync(custId);

        // Then
        result.Should().NotBeNull();
        _mockCustomerRepo.Verify(r => r.GetCustContextAsync(custId), Times.Once);
        _mockDepositRepo.Verify(r => r.GetDepositChannelsAsync(1), Times.Once);
    }

    [Test]
    public async Task GetDepositChannelsByDepositTypeAsync_WhenCustomerNotFound_ShouldThrowException()
    {
        // Given
        var custId = 99999;
        _mockCustomerRepo
            .Setup(r => r.GetCustContextAsync(custId))
            .ThrowsAsync(new CustomerNotFoundException(custId));

        // When
        var act = async () => await _service.GetDepositChannelsByDepositTypeAsync(custId);

        // Then
        await act.Should().ThrowAsync<CustomerNotFoundException>();
    }
}
```

---

## ✅ Review Checklist

### Service 設計檢查

- [ ] Service 是否只做協調，不包含業務邏輯？
- [ ] 業務邏輯是否委託給 Domain Model？
- [ ] 是否依賴介面而非實作？
- [ ] 是否有使用 `Task.WhenAll()` 優化並行查詢？

### 職責邊界檢查

- [ ] Service 是否有 Where/Select 等 LINQ 業務邏輯？
- [ ] Service 是否有快取處理？
- [ ] Service 是否有日誌記錄？
- [ ] Service 方法是否過長（超過 30 行）？

### 介面設計檢查

- [ ] 介面方法命名是否清晰表達意圖？
- [ ] 是否有適當的 XML 文件註解？
- [ ] 回傳型別是否為 Domain Model？

---

## ✅ 新人常見踩雷點

### 1. 在 Service 中寫業務邏輯

```csharp
// ❌ 錯誤：Service 包含業務邏輯
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannelsAsync(int custId)
    {
        var context = await _customerRepo.GetCustContextAsync(custId);
        var channels = await _depositRepo.GetChannelsAsync(context.Customer.SiteId);

        // 這些應該在 Domain Model！
        return channels
            .Where(c => c.VipLevels.Contains(context.Customer.VipLevel))
            .Where(c => c.Currency == context.Customer.Currency)
            .ToList();
    }
}

// ✅ 正確：委託給 Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetChannelsAsync(int custId)
    {
        var context = await _customerRepo.GetCustContextAsync(custId);
        var channels = await _depositRepo.GetChannelsAsync(context.Customer.SiteId);

        return channels.GroupByDepositType(context);  // 委託！
    }
}
```

### 2. 直接依賴 Repository 實作

```csharp
// ❌ 錯誤：依賴具體類別
public class DepositQueryService
{
    private readonly CustomerRepository _customerRepository;

    public DepositQueryService(CustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }
}

// ✅ 正確：依賴介面
public class DepositQueryService
{
    private readonly ICustomerRepository _customerRepository;

    public DepositQueryService(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }
}
```

### 3. 在 Service 中處理快取

```csharp
// ❌ 錯誤：Service 處理快取
public class DepositQueryService
{
    private readonly ICacheHelper _cache;

    public async Task<DepositChannelsByDepositType> GetChannelsAsync(int custId)
    {
        var cacheKey = $"Channels:{custId}";
        var cached = await _cache.GetAsync(cacheKey);
        if (cached != null) return cached;

        // ...
    }
}

// ✅ 正確：快取在 Repository Decorator 處理
// Service 不需要知道快取的存在
```

### 4. 沒有使用並行查詢

```csharp
// ❌ 效能較差：循序查詢
var channels = await _depositRepo.GetChannelsAsync(siteId);
var history = await _depositRepo.GetHistoryAsync(custId);
var config = await _configRepo.GetConfigAsync(siteId);

// ✅ 效能較好：並行查詢
var channelsTask = _depositRepo.GetChannelsAsync(siteId);
var historyTask = _depositRepo.GetHistoryAsync(custId);
var configTask = _configRepo.GetConfigAsync(siteId);
await Task.WhenAll(channelsTask, historyTask, configTask);
```

---

## ✅ TL / Reviewer 檢查重點

### 職責審查

| 發現問題 | 可能原因 | 建議處理 |
|----------|----------|----------|
| Service 有 Where/Select | 業務邏輯未委託 | 移至 Domain Model |
| Service 有 ICacheHelper | 快取未分離 | 使用 Repository Decorator |
| Service 超過 50 行 | 做太多事 | 拆分或委託 Domain |
| 多個 if-else 判斷 | 業務邏輯混入 | 移至 Domain Model |

### 設計審查

- [ ] Service 是否可被單元測試？
- [ ] Repository 依賴是否可被 Mock？
- [ ] 是否有不必要的 Service 層（單一 Repository 操作）？

### 常見問題提問

- 「這個 Where 條件為什麼不在 Domain Model 的方法中？」
- 「這兩個 Repository 呼叫可以並行嗎？」
- 「這個 Service 是否有必要？Controller 可以直接呼叫 Repository 嗎？」

---

> **文件版本**: v1.0
> **最後更新**: 2024-11
