# Feature Toggle 設計規範

> 本文說明 Feature Toggle（功能開關）的設計原則與實作規範，採用 Dispatcher Pattern 取代傳統的 if-else 判斷，並介紹三種執行模式與 V1/V2 結果比較機制。

---

## Feature Toggle 概述

### 設計目的

Feature Toggle 用於控制功能的啟用與停用，常見用途：

- **漸進式發布**：逐步開放新功能給部分用戶
- **A/B 測試**：同時運行多個版本進行比較
- **緊急回滾**：快速停用有問題的功能
- **環境差異**：不同環境啟用不同功能

### 設計選擇

| 方案 | 優點 | 缺點 | 專案選擇 |
|------|------|------|----------|
| **if-else** | 簡單直觀 | 難維護、違反 OCP | ❌ 不採用 |
| **Strategy Pattern** | 符合 OCP | 需要額外抽象 | 部分採用 |
| **Dispatcher Pattern** | 高度解耦、易擴展 | 學習成本 | ✅ 主要採用 |

---

## Dispatcher Pattern 設計

### 架構概念

```
┌─────────────────────────────────────────────────────────┐
│  Controller / Service                                    │
│      ↓ 呼叫                                              │
├─────────────────────────────────────────────────────────┤
│  Dispatcher                                              │
│      ↓ 根據 Toggle 狀態選擇 Handler                       │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ V1 Handler  │    │ V2 Handler  │    │ V3 Handler  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 核心元件

| 元件 | 職責 |
|------|------|
| **Handler Interface** | 定義功能的統一介面 |
| **V1/V2 Handler** | 各版本的具體實作 |
| **Dispatcher** | 根據 Toggle 狀態選擇並執行 Handler |
| **Toggle Repository** | 讀取 Toggle 設定 |

---

## Handler 介面設計

### 介面定義

```csharp
namespace PaymentService.Features.Deposit
{
    /// <summary>
    /// 存款選項查詢 Handler 介面
    /// </summary>
    public interface IGetDepositOptionsHandler
    {
        /// <summary>
        /// Handler 版本識別
        /// </summary>
        string Version { get; }

        /// <summary>
        /// 執行存款選項查詢
        /// </summary>
        Task<DepositOptionsResult> HandleAsync(GetDepositOptionsRequest request);
    }
}
```

### 介面設計原則

- **版本識別**：每個 Handler 必須有唯一的版本識別
- **統一簽章**：所有版本的 Handler 使用相同的方法簽章
- **非同步優先**：方法應回傳 `Task<T>`

---

## Handler 實作

### V1 Handler（舊版本）

```csharp
namespace PaymentService.Features.Deposit.Handlers
{
    /// <summary>
    /// 存款選項查詢 V1 Handler（舊邏輯）
    /// </summary>
    public class GetDepositOptionsV1Handler : IGetDepositOptionsHandler
    {
        private readonly IPayService _payService;

        public GetDepositOptionsV1Handler(IPayService payService)
        {
            _payService = payService;
        }

        public string Version => "V1";

        public async Task<DepositOptionsResult> HandleAsync(GetDepositOptionsRequest request)
        {
            // V1 舊邏輯：使用舊的 PayService
            var channels = await _payService.GetPayChannelsAsync(request.CustId);
            return new DepositOptionsResult
            {
                Channels = channels.Select(c => new DepositOptionDto
                {
                    Type = c.PayType,
                    Name = c.PayName
                }).ToList()
            };
        }
    }
}
```

### V2 Handler（新版本）

```csharp
namespace PaymentService.Features.Deposit.Handlers
{
    /// <summary>
    /// 存款選項查詢 V2 Handler（Clean Architecture）
    /// </summary>
    public class GetDepositOptionsV2Handler : IGetDepositOptionsHandler
    {
        private readonly IDepositQueryService _depositQueryService;

        public GetDepositOptionsV2Handler(IDepositQueryService depositQueryService)
        {
            _depositQueryService = depositQueryService;
        }

        public string Version => "V2";

        public async Task<DepositOptionsResult> HandleAsync(GetDepositOptionsRequest request)
        {
            // V2 新邏輯：使用 Clean Architecture
            var channels = await _depositQueryService
                .GetDepositChannelsByDepositTypeAsync(request.CustId);

            return new DepositOptionsResult
            {
                ChannelsByType = channels.ToDictionary()
            };
        }
    }
}
```

---

## Dispatcher 實作

### Dispatcher 設計

```csharp
namespace PaymentService.Features.Deposit
{
    /// <summary>
    /// 存款選項查詢 Dispatcher
    /// 根據 Feature Toggle 設定選擇對應的 Handler
    /// </summary>
    public class GetDepositOptionsDispatcher
    {
        private readonly IEnumerable<IGetDepositOptionsHandler> _handlers;
        private readonly IFeatureToggleRepository _toggleRepository;
        private readonly ILogger<GetDepositOptionsDispatcher> _logger;

        public GetDepositOptionsDispatcher(
            IEnumerable<IGetDepositOptionsHandler> handlers,
            IFeatureToggleRepository toggleRepository,
            ILogger<GetDepositOptionsDispatcher> logger)
        {
            _handlers = handlers;
            _toggleRepository = toggleRepository;
            _logger = logger;
        }

        /// <summary>
        /// 分派請求到對應的 Handler
        /// </summary>
        public async Task<DepositOptionsResult> DispatchAsync(GetDepositOptionsRequest request)
        {
            // 1. 取得目前啟用的版本
            var activeVersion = await _toggleRepository
                .GetActiveVersionAsync("GetDepositOptions", request.SiteId);

            // 2. 找到對應的 Handler
            var handler = _handlers.FirstOrDefault(h => h.Version == activeVersion);

            if (handler == null)
            {
                _logger.LogWarning(
                    "Handler not found for version {Version}, falling back to V1",
                    activeVersion);
                handler = _handlers.First(h => h.Version == "V1");
            }

            // 3. 執行 Handler
            _logger.LogInformation(
                "Dispatching GetDepositOptions to {Version} handler",
                handler.Version);

            return await handler.HandleAsync(request);
        }
    }
}
```

### Dispatcher 設計原則

| 原則 | 說明 |
|------|------|
| **Fallback 機制** | 找不到對應版本時使用預設版本 |
| **日誌記錄** | 記錄使用的 Handler 版本 |
| **依賴注入** | 透過 DI 取得所有 Handler |

---

## Feature Toggle Repository

### 介面定義

```csharp
namespace PaymentService.Features
{
    /// <summary>
    /// Feature Toggle Repository 介面
    /// </summary>
    public interface IFeatureToggleRepository
    {
        /// <summary>
        /// 取得功能的啟用版本
        /// </summary>
        /// <param name="featureName">功能名稱</param>
        /// <param name="siteId">站台 ID（可選，用於站台級別控制）</param>
        /// <returns>啟用的版本號</returns>
        Task<string> GetActiveVersionAsync(string featureName, int? siteId = null);

        /// <summary>
        /// 檢查功能是否啟用
        /// </summary>
        Task<bool> IsEnabledAsync(string featureName, int? siteId = null);
    }
}
```

### 實作

```csharp
namespace PaymentService.Features
{
    public class FeatureToggleRepository : IFeatureToggleRepository
    {
        private readonly MySqlClient _dbClient;
        private readonly ICacheHelper _cacheHelper;

        public FeatureToggleRepository(
            IEnumerable<MySqlClient> mySqlClients,
            ICacheHelper cacheHelper)
        {
            _dbClient = mySqlClients.First(c => c.DataBase == DataBase.Main);
            _cacheHelper = cacheHelper;
        }

        public async Task<string> GetActiveVersionAsync(string featureName, int? siteId = null)
        {
            var cacheKey = siteId.HasValue
                ? $"FeatureToggle:{featureName}:{siteId}"
                : $"FeatureToggle:{featureName}";

            return await _cacheHelper.TryGetOrCreateAsync(
                cacheKey,
                TimeSpan.FromMinutes(5),
                async () =>
                {
                    var toggle = await _dbClient.QueryFirstOrDefaultAsync<FeatureToggle>(
                        "FeatureToggle_Get",
                        new { FeatureName = featureName, SiteId = siteId });

                    return toggle?.ActiveVersion ?? "V1";
                });
        }

        public async Task<bool> IsEnabledAsync(string featureName, int? siteId = null)
        {
            var version = await GetActiveVersionAsync(featureName, siteId);
            return version != "DISABLED";
        }
    }
}
```

---

## 資料表設計

### Feature Toggle 資料表

```sql
CREATE TABLE FeatureToggle (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    FeatureName VARCHAR(100) NOT NULL,
    SiteId INT NULL,                    -- NULL 表示全域設定
    ActiveVersion VARCHAR(20) NOT NULL, -- 'V1', 'V2', 'DISABLED'
    Description VARCHAR(500),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY UK_Feature_Site (FeatureName, SiteId)
);
```

### 資料範例

| FeatureName | SiteId | ActiveVersion | Description |
|-------------|--------|---------------|-------------|
| GetDepositOptions | NULL | V1 | 預設使用 V1 |
| GetDepositOptions | 1 | V2 | 站台 1 使用 V2 |
| GetDepositOptions | 2 | V2 | 站台 2 使用 V2 |
| GetWithdrawalOptions | NULL | V1 | 預設使用 V1 |

---

## DI 註冊

### 註冊 Handler 和 Dispatcher

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 註冊所有 Handler（使用介面的多重實作）
    services.AddScoped<IGetDepositOptionsHandler, GetDepositOptionsV1Handler>();
    services.AddScoped<IGetDepositOptionsHandler, GetDepositOptionsV2Handler>();

    // 註冊 Dispatcher
    services.AddScoped<GetDepositOptionsDispatcher>();

    // 註冊 Feature Toggle Repository
    services.AddScoped<IFeatureToggleRepository, FeatureToggleRepository>();
}
```

### Controller 使用

```csharp
[ApiController]
[Route("api/[controller]")]
public class DepositController : ControllerBase
{
    private readonly GetDepositOptionsDispatcher _dispatcher;

    public DepositController(GetDepositOptionsDispatcher dispatcher)
    {
        _dispatcher = dispatcher;
    }

    [HttpPost("GetOptions")]
    public async Task<IActionResult> GetDepositOptions(
        [FromBody] GetDepositOptionsRequest request)
    {
        var result = await _dispatcher.DispatchAsync(request);
        return Ok(ApiResult.Success(result));
    }
}
```

---

## 與 if-else 的比較

### if-else 方式（不推薦）

```csharp
// ❌ 不推薦：使用 if-else
public class DepositController
{
    public async Task<IActionResult> GetDepositOptions(int custId)
    {
        var version = await _toggleRepo.GetActiveVersionAsync("GetDepositOptions");

        if (version == "V1")
        {
            // V1 邏輯
            var channels = await _payService.GetPayChannels(custId);
            return Ok(channels);
        }
        else if (version == "V2")
        {
            // V2 邏輯
            var channels = await _depositQueryService.GetChannels(custId);
            return Ok(channels);
        }
        else if (version == "V3")
        {
            // V3 邏輯...
        }
        else
        {
            // 預設...
        }
    }
}
```

### if-else 的問題

| 問題 | 說明 |
|------|------|
| **違反 OCP** | 新增版本需修改現有程式碼 |
| **難以測試** | 所有邏輯混在一起 |
| **程式碼膨脹** | 版本越多，方法越長 |
| **耦合度高** | Controller 知道所有版本細節 |

### Dispatcher Pattern 方式（推薦）

```csharp
// ✅ 推薦：使用 Dispatcher Pattern
public class DepositController
{
    private readonly GetDepositOptionsDispatcher _dispatcher;

    public async Task<IActionResult> GetDepositOptions(
        [FromBody] GetDepositOptionsRequest request)
    {
        // Controller 不知道有哪些版本
        var result = await _dispatcher.DispatchAsync(request);
        return Ok(ApiResult.Success(result));
    }
}

// 新增 V3 只需要：
// 1. 新增 GetDepositOptionsV3Handler
// 2. 在 DI 註冊
// 3. 更新資料庫設定
// 不需要修改 Controller 或 Dispatcher
```

---

## 漸進式遷移策略

### 遷移步驟

```
Phase 1: 準備
├── 建立 Handler 介面
├── 將現有邏輯包裝為 V1 Handler
├── 建立 Dispatcher
└── 建立 Feature Toggle 設定

Phase 2: 新版本開發
├── 開發 V2 Handler（新邏輯）
├── 撰寫 V2 的單元測試
└── 註冊 V2 Handler

Phase 3: 漸進式發布
├── 在測試環境啟用 MixedWithShadow 模式
├── 監控 V1/V2 結果差異
├── 確認無差異後切換至 MixedV2 模式
└── 逐步擴大範圍

Phase 4: 清理
├── 所有功能使用 V2 後
├── 移除 V1 Handler
└── 簡化或移除 Dispatcher
```

---

## Dispatcher 三種執行模式

為了支援漸進式遷移，Dispatcher 可以採用三種執行模式。這是一種進階的版本控制策略，適用於大型功能重構時的風險控管。

> **注意**：這不是通用的強制規範，而是提供日後參考的設計選項。專案可根據實際需求決定是否採用。

### 模式概覽

| 模式 | 說明 | 適用階段 |
|------|------|---------|
| **V1Only** | 純舊版執行 | 預設/穩定階段 |
| **MixedWithShadow** | V1 回傳 + V2 後台比較 | 驗證階段 |
| **MixedV2** | V1 + V2 並行，結果合併 | 生產階段 |

### 模式一：V1Only（預設模式）

最基本的模式，所有請求都由 V1 Handler 處理。

```csharp
// V1Only: V1 handles all requests
private async Task<List<Result>> ExecuteV1OnlyAsync(Request request)
{
    var handler = GetHandler(HandlerVersionEnum.V1);
    return await handler.HandleAsync(request);
}
```

**適用情境**：
- 新功能尚未準備好
- 需要緊急回滾時

### 模式二：MixedWithShadow（驗證模式）

V1 處理請求並回傳結果，V2 在後台執行並比較結果差異，用於驗證 V2 的正確性。

```csharp
// MixedWithShadow: V1 returns, V2 runs in background for comparison
private async Task<List<Result>> ExecuteMixedWithShadowAsync(Request request)
{
    var v1Handler = GetHandler(HandlerVersionEnum.V1);
    var v1Result = await v1Handler.HandleAsync(request);

    // Fire and forget: V2 comparison in background
    var v2Handler = TryGetHandler(HandlerVersionEnum.V2);
    if (v2Handler != null)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                var v2Result = await v2Handler.HandleAsync(request);
                var comparison = CompareResults(v1Result, v2Result);
                LogComparisonResult(comparison);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Shadow V2 handler failed");
            }
        });
    }

    return v1Result;  // 永遠回傳 V1 結果
}
```

**適用情境**：
- 驗證 V2 邏輯是否與 V1 一致
- 發現潛在問題但不影響生產流量

### 模式三：MixedV2（生產模式）

V1 和 V2 並行執行，各自處理其支援的類型，最後合併結果。

```csharp
// MixedV2: V1 + V2 run in parallel, results merged
private async Task<List<Result>> ExecuteMixedV2Async(Request request)
{
    var v1Handler = GetHandler(HandlerVersionEnum.V1);
    var v2Handler = TryGetHandler(HandlerVersionEnum.V2);

    if (v2Handler == null)
        return await v1Handler.HandleAsync(request);

    var v2SupportedTypes = v2Handler.SupportedTypes;

    // Run V1 and V2 in parallel
    var v1Task = v1Handler.HandleAsync(request);
    var v2Task = v2Handler.HandleAsync(request);
    await Task.WhenAll(v1Task, v2Task);

    var v1Result = v1Task.Result;
    var v2Result = v2Task.Result;

    // Filter out V2-supported types from V1 to avoid duplicates
    var filteredV1 = v1Result
        .Where(r => !v2SupportedTypes.Contains(r.Type))
        .ToList();

    // Merge and sort
    return filteredV1.Concat(v2Result).OrderBy(r => r.Sort).ToList();
}
```

**適用情境**：
- V2 已驗證穩定
- 需要逐步將類型從 V1 遷移到 V2

### 模式選擇流程

```
開始遷移
    │
    ├─ 開發 V2 Handler
    │
    ▼
V1Only (預設)
    │
    ├─ V2 開發完成，準備驗證
    │
    ▼
MixedWithShadow (驗證)
    │
    ├─ 監控比較結果
    ├─ 確認無差異
    │
    ▼
MixedV2 (生產)
    │
    ├─ 逐步擴大 V2 支援的類型
    │
    ▼
移除 V1，簡化架構
```

---

## Feature Toggle 配置來源

Toggle 設定可以有兩種配置來源，專案可根據需求選擇適合的方式。

### 方式一：資料庫配置

透過資料庫表儲存 Toggle 設定，支援動態調整、即時生效。

**適用情境**：
- 需要動態調整設定而不重啟服務
- 需要站台級別的細緻控制
- 需要透過管理後台調整設定

**資料表設計**：

```sql
CREATE TABLE FeatureToggle (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    FeatureName VARCHAR(100) NOT NULL,
    SiteId INT NULL,                    -- NULL 表示全域設定
    ActiveVersion VARCHAR(20) NOT NULL, -- 'V1', 'V2', 'DISABLED'
    Description VARCHAR(500),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY UK_Feature_Site (FeatureName, SiteId)
);
```

**優先級規則**：
1. 站台特定設定 (SiteId = 具體值)
2. 全域設定 (SiteId = NULL)
3. 預設值 (V1)

### 方式二：appsettings.json 配置

透過組態檔儲存 Toggle 設定，部署時配置、重啟生效。

**適用情境**：
- 簡單的版本控制
- 配置變更需要經過部署流程
- 不需要動態調整

**配置範例**：

```json
{
  "FeatureToggle": {
    "DefaultMode": "V1Only",
    "OperationModes": {
      "GetPromotionList": "V1Only",
      "GetSpecialPromotionList": "MixedV2"
    }
  }
}
```

### 比較與選擇

| 面向 | 資料庫配置 | appsettings.json |
|------|-----------|------------------|
| **生效時機** | 即時（搭配快取） | 需重啟服務 |
| **調整方式** | 管理後台/直接修改資料庫 | 修改配置檔後部署 |
| **細緻度** | 支援站台/客戶級別 | 通常為全域/操作級別 |
| **追蹤性** | 資料庫有變更紀錄 | 需搭配版控追蹤 |
| **複雜度** | 較高（需建表、快取） | 較低（使用 IOptions） |

> **建議**：專案決策者可根據團隊需求和複雜度選擇合適的方式。兩種方式也可以混合使用。

---

## V1/V2 結果比較機制

在 MixedWithShadow 模式下，需要比較 V1 和 V2 的結果以驗證正確性。

### 比較結果資料結構

```csharp
/// <summary>
/// V1/V2 比較結果
/// </summary>
public class ComparisonResult
{
    /// <summary>
    /// 結果是否完全一致
    /// </summary>
    public bool IsMatch { get; set; }

    /// <summary>
    /// V1 結果數量
    /// </summary>
    public int V1Count { get; set; }

    /// <summary>
    /// V2 結果數量
    /// </summary>
    public int V2Count { get; set; }

    /// <summary>
    /// 只存在於 V1 的項目識別碼
    /// </summary>
    public List<string> OnlyInV1 { get; set; } = new();

    /// <summary>
    /// 只存在於 V2 的項目識別碼
    /// </summary>
    public List<string> OnlyInV2 { get; set; } = new();

    /// <summary>
    /// 欄位差異清單
    /// </summary>
    public List<FieldDifference> Differences { get; set; } = new();
}

/// <summary>
/// 單一欄位差異
/// </summary>
public class FieldDifference
{
    public string ItemId { get; set; }
    public string FieldName { get; set; }
    public string V1Value { get; set; }
    public string V2Value { get; set; }
}
```

### 比較邏輯實作

```csharp
private static ComparisonResult CompareResults(
    List<Result> v1Result,
    List<Result> v2Result)
{
    var v1Dict = v1Result.ToDictionary(r => r.Id);
    var v2Dict = v2Result.ToDictionary(r => r.Id);

    var onlyInV1 = v1Dict.Keys.Except(v2Dict.Keys).ToList();
    var onlyInV2 = v2Dict.Keys.Except(v1Dict.Keys).ToList();
    var differences = new List<FieldDifference>();

    // 比較共同項目的關鍵欄位
    foreach (var id in v1Dict.Keys.Intersect(v2Dict.Keys))
    {
        var v1 = v1Dict[id];
        var v2 = v2Dict[id];

        // 比較關鍵業務欄位
        if (v1.CanJoin != v2.CanJoin)
        {
            differences.Add(new FieldDifference
            {
                ItemId = id,
                FieldName = nameof(Result.CanJoin),
                V1Value = v1.CanJoin.ToString(),
                V2Value = v2.CanJoin.ToString()
            });
        }

        // 可依需求新增其他欄位比較...
    }

    return new ComparisonResult
    {
        IsMatch = onlyInV1.Count == 0 && onlyInV2.Count == 0 && differences.Count == 0,
        V1Count = v1Result.Count,
        V2Count = v2Result.Count,
        OnlyInV1 = onlyInV1,
        OnlyInV2 = onlyInV2,
        Differences = differences
    };
}
```

### 日誌記錄

```csharp
private void LogComparisonResult(string operation, int custId, ComparisonResult comparison)
{
    if (comparison.IsMatch)
    {
        _logger.LogInformation(
            "Shadow comparison MATCH for {Operation}, CustId={CustId}, Count={Count}",
            operation, custId, comparison.V1Count);
    }
    else
    {
        _logger.LogWarning(
            "Shadow comparison MISMATCH for {Operation}, CustId={CustId}. " +
            "V1Count={V1Count}, V2Count={V2Count}, " +
            "OnlyInV1=[{OnlyInV1}], OnlyInV2=[{OnlyInV2}], " +
            "Differences=[{Differences}]",
            operation, custId,
            comparison.V1Count, comparison.V2Count,
            string.Join(", ", comparison.OnlyInV1),
            string.Join(", ", comparison.OnlyInV2),
            string.Join(", ", comparison.Differences.Select(d => $"{d.ItemId}.{d.FieldName}")));
    }
}
```

### 監控建議

| 監控指標 | 說明 |
|---------|------|
| **Match Rate** | 結果一致的比例 |
| **Mismatch Count** | 不一致的總數 |
| **Common Differences** | 最常出現差異的欄位 |
| **V2 Error Rate** | V2 執行錯誤的比例 |

---

## ✅ Review Checklist

### Handler 設計檢查

- [ ] Handler 是否有唯一的版本識別？
- [ ] 所有 Handler 是否實作相同介面？
- [ ] Handler 是否只包含該版本的邏輯？
- [ ] 是否有適當的單元測試？

### Dispatcher 設計檢查

- [ ] 是否有 Fallback 機制？
- [ ] 是否有日誌記錄使用的版本？
- [ ] 是否透過 DI 注入所有 Handler？
- [ ] 是否選擇適當的執行模式（V1Only/MixedWithShadow/MixedV2）？

### Feature Toggle 檢查

- [ ] 是否選擇適當的配置來源（資料庫/appsettings）？
- [ ] 是否有快取 Toggle 設定？
- [ ] 是否有 DISABLED 狀態支援？

### V1/V2 比較檢查（使用 MixedWithShadow 模式時）

- [ ] 是否定義了需要比較的關鍵欄位？
- [ ] 是否有日誌記錄比較結果？
- [ ] 是否有監控不一致的比例？

---

## ✅ 新人常見踩雷點

### 1. 在 Controller 中使用 if-else 判斷版本

```csharp
// ❌ 錯誤：if-else 判斷
public async Task<IActionResult> GetDepositOptions(int custId)
{
    var version = await _toggleRepo.GetActiveVersionAsync("GetDepositOptions");

    if (version == "V1")
    {
        // V1 邏輯
    }
    else if (version == "V2")
    {
        // V2 邏輯
    }
}

// ✅ 正確：使用 Dispatcher
public async Task<IActionResult> GetDepositOptions(GetDepositOptionsRequest request)
{
    var result = await _dispatcher.DispatchAsync(request);
    return Ok(result);
}
```

### 2. Handler 之間共用程式碼不當

```csharp
// ❌ 錯誤：V2 繼承 V1
public class GetDepositOptionsV2Handler : GetDepositOptionsV1Handler
{
    public override Task<Result> HandleAsync(Request request)
    {
        // 覆寫部分邏輯
    }
}

// ✅ 正確：各 Handler 獨立實作
public class GetDepositOptionsV1Handler : IGetDepositOptionsHandler { ... }
public class GetDepositOptionsV2Handler : IGetDepositOptionsHandler { ... }

// 如需共用邏輯，抽取到獨立的 Helper 類別
```

### 3. 忘記註冊新的 Handler

```csharp
// ❌ 錯誤：只建立 Handler 類別，忘記 DI 註冊
public class GetDepositOptionsV3Handler : IGetDepositOptionsHandler { ... }
// 但沒有在 Startup.cs 註冊

// ✅ 正確：記得 DI 註冊
services.AddScoped<IGetDepositOptionsHandler, GetDepositOptionsV3Handler>();
```

---

## ✅ TL / Reviewer 檢查重點

### 架構審查

| 檢查項目 | 警示信號 |
|----------|----------|
| if-else 判斷版本 | Controller/Service 中有 `if (version == "V1")` |
| Handler 繼承 | V2Handler 繼承 V1Handler |
| 缺少 Fallback | Dispatcher 沒有處理找不到 Handler 的情況 |

### 遷移計畫審查

- [ ] 是否有完整的遷移計畫？
- [ ] 是否有 Rollback 策略？
- [ ] 是否有監控新版本的錯誤率？

### 清理計畫審查

- [ ] 舊版本是否有移除時程？
- [ ] 是否有文件記錄各版本狀態？

---

> **文件版本**: v1.1
> **最後更新**: 2025-01
> **更新內容**: 新增三種執行模式（V1Only/MixedWithShadow/MixedV2）、配置來源選擇、V1/V2 結果比較機制
