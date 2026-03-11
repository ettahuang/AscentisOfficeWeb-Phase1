# Domain Model 設計指南

> 本文說明 Domain Model 的設計原則與實作規範，包含 Rich Model、不可變性、record 類型、Value Object、CreateDomain 模式等核心概念。

---

## Rich Model vs Anemic Model

### 設計選擇

| 類型 | 特徵 | 專案選擇 |
|------|------|----------|
| **Rich Model** | 資料 + 行為封裝在一起 | ✅ 採用 |
| **Anemic Model** | 只有資料屬性，邏輯在外部 | ❌ 避免 |

### Rich Model 優勢

- **封裝性**：業務邏輯與資料緊密結合
- **可測試性**：可獨立測試 Domain Model
- **可讀性**：業務規則一目了然
- **維護性**：修改業務邏輯只需改一處

### 專案實踐對比

```csharp
// ❌ Anemic Model（錯誤做法）
public class DepositChannel
{
    public CurrencyEnum Currency { get; set; }
    public List<int> VipLevels { get; set; }
    public decimal MinAmount { get; set; }
    public decimal MaxAmount { get; set; }
    // 沒有業務方法，只有資料
}

// 業務邏輯散落在 Service
public class DepositService
{
    public bool IsChannelSupported(DepositChannel channel, CustomerContext context)
    {
        return context.Currency == channel.Currency
               && channel.VipLevels.Contains(context.VipLevel);
    }
}
```

```csharp
// ✅ Rich Model（正確做法）
public class DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }

    // 業務邏輯封裝在 Domain Model
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsReachedPointLevel(PointLevel)
               && custContext.IsVipLevelInScope(VipLevels)
               && !custContext.IsTagInScope(ExcludeTags);
    }

    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return new DepositChannel(...);  // 回傳新實例
    }
}
```

---

## 不可變性（Immutability）

### 設計原則

Domain Model 應該是不可變的（Immutable），修改時回傳新實例而非修改現有實例。

### 實作方式選擇

| 方式 | 特點 | 建議 |
|------|------|------|
| **`record` 類型** | 原生不可變、自動 Equals/GetHashCode、支援 `with` 表達式 | ✅ 首選 |
| **`class` + `init` setter** | 傳統方式、需手動實作相等性比較 | ⚪ 替代方案 |

> **選擇建議**：優先使用 `record`，除非有特殊需求（如需要繼承階層或與舊版 .NET 相容）。專案決策者可根據團隊熟悉度自行決定。

---

### 首選方案：使用 `record` 類型

`record` 是 C# 9.0 引入的類型，天生具備不可變性，是 Domain Model 的首選實作方式。

```csharp
// ✅ 首選：使用 record
public record DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public DepositTypeEnum DepositType { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    public int Sort { get; init; }

    // 業務邏輯方法
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsVipLevelInScope(VipLevels);
    }
}
```

#### record 的優勢

| 優勢 | 說明 |
|------|------|
| **原生不可變** | 屬性預設為 `init`，無需額外宣告 |
| **自動相等性** | 自動產生 `Equals()`、`GetHashCode()`，基於值比較 |
| **`with` 表達式** | 簡潔的複製並修改語法 |
| **簡潔語法** | 減少樣板程式碼 |

#### 使用 `with` 表達式修改

```csharp
public record DepositChannel
{
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    // ... 其他屬性

    /// <summary>
    /// 套用金額限制，回傳新實例
    /// </summary>
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        // ✅ 使用 with 表達式，簡潔地建立修改後的新實例
        return this with
        {
            MinAmount = Math.Max(MinAmount, limitInfo.MinAmount),
            MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount)
        };
    }
}
```

#### record 繼承範例

```csharp
// 抽象基類
public abstract record PromotionBase
{
    public string BonusCode { get; init; } = string.Empty;
    public abstract PromotionTypeEnum Type { get; }
    public Period DisplayPeriod { get; init; } = null!;

    // 共用的業務方法
    public bool IsVisibleTo(ViewerContext viewer)
    {
        return Visibility.IsVisibleTo(viewer);
    }
}

// 具體實作
public record FirstDepositPromotion : PromotionBase
{
    public override PromotionTypeEnum Type => PromotionTypeEnum.FirstDeposit;
    public decimal MinDeposit { get; init; }
    public decimal BonusRate { get; init; }
}

public record RebatePromotion : PromotionBase
{
    public override PromotionTypeEnum Type => PromotionTypeEnum.Rebate;
    public decimal RebateRate { get; init; }
}
```

---

### 替代方案：使用 `class` + `init` setter

當無法使用 `record` 時（如需要與舊版框架相容），可使用 `class` 搭配 `init` setter。

```csharp
// ⚪ 替代方案：使用 class + init
public class DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public DepositTypeEnum DepositType { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    public int Sort { get; init; }
}
```

#### 修改時回傳新實例

使用 `class` 時，需手動建立新實例：

```csharp
public class DepositChannel
{
    // 私有建構子用於建立修改後的實例
    private DepositChannel(
        CurrencyEnum currency,
        DepositTypeEnum depositType,
        List<int> excludeTags,
        List<int> vipLevels,
        int pointLevel,
        decimal minAmount,
        decimal maxAmount,
        int sort)
    {
        Currency = currency;
        DepositType = depositType;
        ExcludeTags = excludeTags;
        VipLevels = vipLevels;
        PointLevel = pointLevel;
        MinAmount = minAmount;
        MaxAmount = maxAmount;
        Sort = sort;
    }

    /// <summary>
    /// 套用金額限制，回傳新實例
    /// </summary>
    public DepositChannel WithAmountLimit(DepositLimitInfo depositLimitInfo)
    {
        var newMin = Math.Max(MinAmount, depositLimitInfo.MinAmount);
        var newMax = Math.Min(MaxAmount, depositLimitInfo.MaxAmount);

        // 手動建立新實例
        return new DepositChannel(
            Currency,
            DepositType,
            ExcludeTags,
            VipLevels,
            PointLevel,
            newMin,
            newMax,
            Sort);
    }
}
```

---

### 不可變性的優勢

| 優勢 | 說明 |
|------|------|
| **執行緒安全** | 多執行緒環境無需加鎖 |
| **可預測性** | 物件狀態不會意外改變 |
| **易於測試** | 不需考慮狀態變化 |
| **易於追蹤** | 可追蹤物件的變化歷程 |

---

## 實體（Entities）設計

### 實體定義

實體是具有唯一識別的領域物件，即使屬性相同，不同識別的實體也是不同的。

### 專案範例：Customer

```csharp
public class Customer
{
    /// <summary>
    /// 客戶識別碼（唯一識別）
    /// </summary>
    public int CustId { get; init; }

    public int SiteId { get; init; }
    public int VipLevel { get; init; }
    public List<int> Tags { get; init; } = new();
    public CurrencyEnum Currency { get; init; }

    // ==================== 業務邏輯方法 ====================

    /// <summary>
    /// 判斷客戶 VIP 等級是否在指定範圍內
    /// </summary>
    public bool IsVipLevelInScope(IList<int> scopeVipLevels)
    {
        if (scopeVipLevels is null || scopeVipLevels.Count == 0)
            return false;

        return scopeVipLevels.Contains(VipLevel);
    }

    /// <summary>
    /// 判斷客戶是否擁有指定標籤
    /// </summary>
    public bool IsTagInScope(IList<int> scopeTags)
    {
        if (Tags is null || Tags.Count == 0)
            return false;

        return scopeTags.Intersect(Tags).Any();
    }

    /// <summary>
    /// 判斷客戶幣別是否符合
    /// </summary>
    public bool IsCurrencyOf(CurrencyEnum currency)
    {
        return currency == Currency;
    }
}
```

---

## 值物件（Value Objects）設計

### 值物件定義

值物件是**沒有身份識別**的領域物件，以屬性值來判斷相等性。兩個值物件若所有屬性值相同，則視為相等。

### 值物件 vs 實體

| 特性 | 值物件（Value Object） | 實體（Entity） |
|------|----------------------|---------------|
| **識別方式** | 以屬性值判斷相等 | 以唯一識別碼判斷 |
| **可變性** | 不可變 | 可變（但建議不可變） |
| **生命週期** | 隨所屬實體存亡 | 獨立生命週期 |
| **範例** | Period、Address、Money | Customer、Order |

### 專案位置

```
Models/
├── Domain/           # 實體、聚合根
└── ValueObject/      # 值物件
    ├── Period.cs
    ├── VisibilityRules.cs
    ├── LocalizedContent.cs
    └── AntifraudRules.cs
```

### 值物件範例：Period（時間區間）

```csharp
/// <summary>
/// 表示一個時間區間的值物件
/// </summary>
public record Period
{
    public DateTime StartTime { get; init; }
    public DateTime EndTime { get; init; }

    /// <summary>
    /// 判斷指定時間是否在區間內
    /// </summary>
    public bool Contains(DateTime dateTime)
    {
        return dateTime >= StartTime && dateTime <= EndTime;
    }

    /// <summary>
    /// 判斷當前時間是否在區間內
    /// </summary>
    public bool IsActive(DateTime now)
    {
        return Contains(now);
    }

    /// <summary>
    /// 判斷區間是否已過期
    /// </summary>
    public bool IsExpired(DateTime now)
    {
        return now > EndTime;
    }
}
```

### 值物件範例：VisibilityRules（可見性規則）

```csharp
/// <summary>
/// 封裝多項可見性判斷規則的值物件
/// </summary>
public record VisibilityRules
{
    public bool RequiresLogin { get; init; }
    public IReadOnlyList<int> AllowedVipLevels { get; init; } = Array.Empty<int>();
    public IReadOnlyList<int> ExcludedTags { get; init; } = Array.Empty<int>();
    public IReadOnlyList<int> AllowedDeviceTypes { get; init; } = Array.Empty<int>();

    public static VisibilityRules Default => new();

    /// <summary>
    /// 判斷是否對指定檢視者可見
    /// </summary>
    public bool IsVisibleTo(ViewerContext viewer)
    {
        // 登入要求檢查
        if (RequiresLogin && !viewer.IsAuthenticated)
            return false;

        // VIP 等級檢查
        if (AllowedVipLevels.Any() && !AllowedVipLevels.Contains(viewer.VipLevel))
            return false;

        // 排除標籤檢查
        if (ExcludedTags.Any() && viewer.Tags.Intersect(ExcludedTags).Any())
            return false;

        // 裝置類型檢查
        if (AllowedDeviceTypes.Any() && !AllowedDeviceTypes.Contains(viewer.DeviceType))
            return false;

        return true;
    }
}
```

### 值物件範例：LocalizedContent（多語系內容）

```csharp
/// <summary>
/// 封裝多語系內容的值物件
/// </summary>
public record LocalizedContent
{
    private readonly IReadOnlyDictionary<int, PromotionDisplayInfo> _contentByLang;

    public static LocalizedContent Empty => new(new Dictionary<int, PromotionDisplayInfo>());

    public LocalizedContent(IReadOnlyDictionary<int, PromotionDisplayInfo> contentByLang)
    {
        _contentByLang = contentByLang ?? throw new ArgumentNullException(nameof(contentByLang));
    }

    /// <summary>
    /// 取得指定語言的顯示內容，若無則使用預設語言
    /// </summary>
    public PromotionDisplayInfo GetDisplayInfo(int langId, int defaultLangId)
    {
        if (_contentByLang.TryGetValue(langId, out var info))
            return info;

        if (_contentByLang.TryGetValue(defaultLangId, out var defaultInfo))
            return defaultInfo;

        return PromotionDisplayInfo.Empty;
    }
}
```

### 值物件設計原則

| 原則 | 說明 |
|------|------|
| **不可變性** | 值物件一旦建立就不可修改 |
| **無識別碼** | 不使用 ID，以值判斷相等 |
| **自我驗證** | 建構時驗證所有屬性的合法性 |
| **行為封裝** | 封裝與該值相關的業務邏輯 |
| **可替換性** | 相同值的物件可互換使用 |

### 何時使用值物件

| 情境 | 使用值物件 |
|------|-----------|
| 表示一個概念的組合屬性 | Period（開始+結束時間） |
| 封裝驗證規則集合 | VisibilityRules、AntifraudRules |
| 表示金額+幣別組合 | Money（Amount + Currency） |
| 多語系內容容器 | LocalizedContent |
| 不需要追蹤變更歷史 | 地址、座標、顏色 |

---

## 聚合（Aggregates）設計

### 聚合定義

聚合是一組相關物件的集合，有一個聚合根（Aggregate Root）負責維護整體一致性。

### 專案範例：DepositChannels（聚合根）

```csharp
public class DepositChannels
{
    // 內部集合：使用 private 保護
    [JsonProperty]
    private IReadOnlyList<DepositChannel> DepositChannelList { get; set; }

    [JsonProperty]
    private DepositLimitInfos DepositLimitInfos { get; set; }

    public DepositChannels(
        IReadOnlyList<DepositChannel> depositChannelList,
        DepositLimitInfos depositLimitInfos)
    {
        DepositChannelList = depositChannelList
            ?? throw new ArgumentNullException(nameof(depositChannelList));
        DepositLimitInfos = depositLimitInfos
            ?? throw new ArgumentNullException(nameof(depositLimitInfos));
    }

    /// <summary>
    /// 聚合根的核心業務方法：依存款類型分組並套用限額
    /// </summary>
    public DepositChannelsByDepositType GroupByDepositType(CustomerContext custContext)
    {
        var channelsByType = new Dictionary<DepositTypeEnum, IList<DepositChannel>>();

        // 1. 篩選客戶適用的通道
        var payInfoGrouping = DepositChannelList
            .Where(channel => channel.IsSupported(custContext))
            .GroupBy(channel => channel.DepositType);

        foreach (var group in payInfoGrouping)
        {
            // 2. 解析該類型的存款限額
            if (!DepositLimitInfos.TryResolveLimit(custContext, group.Key, out var depositLimitInfo))
                continue;

            // 3. 篩選金額範圍有交集的通道，並套用限額
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

### 聚合設計原則

| 原則 | 說明 |
|------|------|
| **單一入口** | 透過聚合根存取內部物件 |
| **一致性邊界** | 聚合內的變更保持一致性 |
| **最小化** | 聚合不應過大 |
| **識別唯一** | 每個聚合有唯一識別 |

---

## 組合物件設計

### 專案範例：CustomerContext

`CustomerContext` 組合 `Customer` 和 `PointLevel`，提供統一的客戶查詢介面：

```csharp
public class CustomerContext
{
    public Customer Customer { get; init; }
    public int PointLevel { get; init; }

    public CustomerContext(Customer customer, int pointLevel)
    {
        Customer = customer ?? throw new ArgumentNullException(nameof(customer));
        PointLevel = pointLevel >= 0
            ? pointLevel
            : throw new ArgumentException("PointLevel cannot be negative", nameof(pointLevel));
    }

    // ==================== 委託方法 ====================
    // 將查詢委託給內部的 Customer 物件

    public bool IsCurrencyOf(CurrencyEnum currency)
    {
        return Customer.IsCurrencyOf(currency);
    }

    public bool IsVipLevelInScope(IList<int> scopeVipLevels)
    {
        return Customer.IsVipLevelInScope(scopeVipLevels);
    }

    public bool IsTagInScope(IList<int> scopeTags)
    {
        return Customer.IsTagInScope(scopeTags);
    }

    // ==================== 自有方法 ====================
    // PointLevel 相關的邏輯在此層處理

    public bool IsReachedPointLevel(int requiredPointLevel)
    {
        return requiredPointLevel <= PointLevel;
    }
}
```

### 組合物件的優勢

- **封裝複雜度**：隱藏內部結構
- **統一介面**：提供一致的查詢方法
- **職責清晰**：每個類別只負責自己的邏輯

---

## CreateDomain 模式

### 設計目的

將 DbModel 轉換為 Domain Model，實現兩者的分離。

### DbModel 定義

```csharp
namespace PaymentService.Models.DbModel
{
    /// <summary>
    /// 資料庫映射模型（對應 Stored Procedure 回傳欄位）
    /// </summary>
    public class DepositChannel
    {
        public int? SysId { get; init; }
        public string BankCode { get; init; }
        public string BankName { get; init; }
        public int PayId { get; init; }
        public int DepositType { get; init; }        // int 對應 Enum
        public int PointLevel { get; init; }
        public string VipLevel { get; init; }         // JSON 字串
        public string TagExcludeList { get; init; }   // JSON 字串
        public int CurrencyId { get; init; }          // int 對應 Enum
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
                Currency = (CurrencyEnum)CurrencyId,
                DepositType = (DepositTypeEnum)DepositType,
                ExcludeTags = TagExcludeList.ParseJson<List<int>>(),
                VipLevels = VipLevel.ParseJson<List<int>>(),
                PointLevel = PointLevel,
                MinAmount = MinAmount,
                MaxAmount = MaxAmount,
                Sort = Sort
            };
        }
    }
}
```

### Repository 使用 CreateDomain

```csharp
public class DepositRepository : IDepositRepository
{
    public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
    {
        // 1. 查詢 DbModel
        var dbChannels = await _mainDbClient.QueryAsync<DbModel.DepositChannel>(
            "DepositChannel_Get", new { SiteId = siteId });

        var dbLimits = await _mainDbClient.QueryAsync<DbModel.DepositLimitInfo>(
            "DepositLimit_Get", new { SiteId = siteId });

        // 2. 使用 CreateDomain() 轉換
        var channels = dbChannels.Select(db => db.CreateDomain()).ToList();
        var limits = dbLimits.Select(db => db.CreateDomain()).ToList();

        // 3. 回傳 Domain Model
        return new DepositChannels(channels, new DepositLimitInfos(limits));
    }
}
```

### CreateDomain 模式的優勢

| 優勢 | 說明 |
|------|------|
| **關注點分離** | DbModel 處理資料庫映射，Domain Model 處理業務邏輯 |
| **型別安全** | JSON 字串轉 List、int 轉 Enum |
| **易於維護** | 資料庫欄位變更不影響業務邏輯 |
| **易於測試** | Domain Model 可獨立測試 |

---

## 領域語言命名

### 命名原則

使用業務領域的語言命名，讓程式碼自我解釋：

| 技術導向命名 | 領域導向命名 |
|--------------|--------------|
| `CheckVipLevel()` | `IsVipLevelInScope()` |
| `FilterByCondition()` | `IsSupported()` |
| `UpdateAmount()` | `WithAmountLimit()` |
| `ValidateRange()` | `IsOverlappingWith()` |
| `GetData()` | `GetCustContextAsync()` |
| `ProcessChannels()` | `GroupByDepositType()` |

### 命名模式

| 模式 | 用途 | 範例 |
|------|------|------|
| `Is...` | 布林判斷 | `IsSupported()`, `IsOverlappingWith()` |
| `With...` | 回傳修改後的新實例 | `WithAmountLimit()` |
| `Try...` | 嘗試操作，回傳成功與否 | `TryResolveLimit()` |
| `...InScope` | 範圍判斷 | `IsVipLevelInScope()`, `IsTagInScope()` |

---

## 驗證邏輯設計

### 建構時驗證

```csharp
public class CustomerContext
{
    public CustomerContext(Customer customer, int pointLevel)
    {
        // 建構時驗證
        Customer = customer
            ?? throw new ArgumentNullException(nameof(customer));

        PointLevel = pointLevel >= 0
            ? pointLevel
            : throw new ArgumentException("PointLevel cannot be negative", nameof(pointLevel));
    }
}
```

### 方法參數驗證

```csharp
public class DepositChannel
{
    public bool IsOverlappingWith(DepositLimitInfo depositLimitInfo)
    {
        // 方法參數驗證
        if (depositLimitInfo == null)
            throw new ArgumentNullException(nameof(depositLimitInfo));

        // 業務邏輯
        if (!IsValidAmountRange() || !depositLimitInfo.IsValidAmountRange())
            return false;

        return MinAmount <= depositLimitInfo.MaxAmount
               && MaxAmount >= depositLimitInfo.MinAmount;
    }

    public DepositChannel WithAmountLimit(DepositLimitInfo depositLimitInfo)
    {
        if (depositLimitInfo == null)
            throw new ArgumentNullException(nameof(depositLimitInfo));

        var newMin = Math.Max(MinAmount, depositLimitInfo.MinAmount);
        var newMax = Math.Min(MaxAmount, depositLimitInfo.MaxAmount);

        // 業務規則驗證
        if (newMin > newMax)
            throw new InvalidOperationException(
                "No overlapping range exists. Call IsOverlappingWith() before WithAmountLimit().");

        return new DepositChannel(...);
    }
}
```

---

## 空值處理策略

### 專案範例：DepositUnLimitInfo

當沒有找到對應的限額設定時，使用「無限額」物件：

```csharp
public class DepositLimitInfos
{
    public bool TryResolveLimit(
        CustomerContext custContext,
        DepositTypeEnum depositType,
        out DepositLimitInfo depositLimitInfo)
    {
        var matchingLimit = DepositLimitInfoList?
            .FirstOrDefault(info =>
                info.VipLevel == custContext.PointLevel
                && info.DepositType == depositType
                && info.Currency == custContext.Customer.Currency);

        // 沒有找到對應限額 → 使用 UnLimitInfo
        if (matchingLimit == null)
        {
            depositLimitInfo = new DepositUnLimitInfo(
                depositType, custContext.Customer.Currency, custContext.PointLevel);
            return true;
        }

        // 限額已停用 → 不允許存款
        if (matchingLimit.Status == GeneralStatusEnum.Disable)
        {
            depositLimitInfo = null;
            return false;
        }

        // 使用找到的限額
        depositLimitInfo = matchingLimit;
        return true;
    }
}
```

### DepositUnLimitInfo 設計

```csharp
/// <summary>
/// 表示無限額的存款限制資訊
/// </summary>
public class DepositUnLimitInfo : DepositLimitInfo
{
    public DepositUnLimitInfo(
        DepositTypeEnum depositType,
        CurrencyEnum currency,
        int vipLevel)
    {
        DepositType = depositType;
        Currency = currency;
        VipLevel = vipLevel;
        MinAmount = 0;
        MaxAmount = decimal.MaxValue;  // 無上限
    }
}
```

---

## ✅ Review Checklist

### Domain Model 設計檢查

- [ ] 是否使用 `record`（首選）或 `class + init`（替代）確保不可變性？
- [ ] 修改方法是否回傳新實例（`with` 表達式或手動建立）？
- [ ] 業務邏輯是否封裝在 Domain Model 內？
- [ ] 是否使用領域語言命名？
- [ ] 建構子是否進行必要驗證？

### Value Object 檢查

- [ ] 值物件是否使用 `record` 實作？
- [ ] 值物件是否放在 `Models/ValueObject/` 目錄？
- [ ] 值物件是否無識別碼（無 ID 屬性）？
- [ ] 值物件是否封裝相關的業務邏輯？

### CreateDomain 檢查

- [ ] DbModel 與 Domain Model 是否分離？
- [ ] Repository 是否回傳 Domain Model？
- [ ] JSON 字串是否正確解析為強型別？
- [ ] int 是否正確轉換為 Enum？

### 聚合設計檢查

- [ ] 聚合根是否提供統一的操作入口？
- [ ] 內部集合是否使用 private 保護？
- [ ] 聚合是否過大需要拆分？

---

## ✅ 新人常見踩雷點

### 1. 使用 set 而非 init

```csharp
// ❌ 錯誤：使用 set 允許外部修改
public class DepositChannel
{
    public decimal MinAmount { get; set; }
}

// 導致的問題
var channel = new DepositChannel { MinAmount = 100 };
channel.MinAmount = 999;  // 可以隨意修改！

// ✅ 正確：使用 init 限制只能在初始化時設定
public class DepositChannel
{
    public decimal MinAmount { get; init; }
}
```

### 2. 直接修改物件而非回傳新實例

```csharp
// ❌ 錯誤：直接修改現有實例
public void ApplyAmountLimit(DepositLimitInfo limitInfo)
{
    this.MinAmount = Math.Max(MinAmount, limitInfo.MinAmount);
    this.MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount);
}

// ✅ 正確：回傳新實例
public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
{
    return new DepositChannel(
        Currency, DepositType, ExcludeTags, VipLevels, PointLevel,
        Math.Max(MinAmount, limitInfo.MinAmount),
        Math.Min(MaxAmount, limitInfo.MaxAmount),
        Sort);
}
```

### 3. Domain Model 依賴外部服務

```csharp
// ❌ 錯誤：Domain Model 注入 Repository
public class DepositChannel
{
    private readonly IDepositRepository _repo;

    public async Task<bool> IsAvailable()
    {
        var limits = await _repo.GetLimits();  // 不應該在 Domain Model 查資料庫
        return ...;
    }
}

// ✅ 正確：透過參數傳入所需資料
public class DepositChannel
{
    public bool IsOverlappingWith(DepositLimitInfo depositLimitInfo)
    {
        // 資料從外部傳入
        return MinAmount <= depositLimitInfo.MaxAmount
               && MaxAmount >= depositLimitInfo.MinAmount;
    }
}
```

### 4. 業務邏輯放在 Service 而非 Domain Model

```csharp
// ❌ 錯誤：業務邏輯在 Service
public class DepositService
{
    public List<DepositChannel> FilterChannels(List<DepositChannel> channels, CustomerContext ctx)
    {
        return channels.Where(c =>
            c.VipLevels.Contains(ctx.VipLevel) &&
            c.Currency == ctx.Currency
        ).ToList();
    }
}

// ✅ 正確：業務邏輯在 Domain Model
public class DepositChannel
{
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsVipLevelInScope(VipLevels);
    }
}
```

---

## ✅ TL / Reviewer 檢查重點

### Rich Model 審查

| 檢查項目 | 警示信號 |
|----------|----------|
| 貧血模型 | Domain Model 只有 getter/setter，沒有業務方法 |
| 邏輯外洩 | Service 中有大量 Where/Select 業務邏輯 |
| 可變性 | 使用 `set` 而非 `init` |

### 設計品質審查

- [ ] Domain Model 的方法是否使用領域語言命名？
- [ ] 是否有適當的參數驗證？
- [ ] 聚合邊界是否合理？
- [ ] CreateDomain 轉換是否完整？

### 常見問題提問

- 「這個邏輯為什麼不在 Domain Model 的 IsSupported() 方法中？」
- 「為什麼這個屬性用 set 而不是 init？」
- 「這個方法為什麼直接修改物件，而不是回傳新實例？」

---

> **文件版本**: v1.1
> **最後更新**: 2025-01
> **更新內容**: 新增 `record` 類型作為首選方案、新增 Value Object 章節
