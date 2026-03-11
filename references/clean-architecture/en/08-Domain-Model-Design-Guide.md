# Domain Model Design Guide

> This document explains the design principles and implementation specifications for Domain Models, including Rich Model, immutability, record types, Value Objects, and the CreateDomain pattern.

---

## Rich Model vs Anemic Model

### Design Choice

| Type | Characteristics | Project Choice |
|------|-----------------|----------------|
| **Rich Model** | Data + behavior encapsulated together | Adopted |
| **Anemic Model** | Only data properties, logic external | Avoided |

### Rich Model Advantages

- **Encapsulation**: Business logic tightly coupled with data
- **Testability**: Domain Model can be tested independently
- **Readability**: Business rules are clear at a glance
- **Maintainability**: Modify business logic in one place only

### Project Practice Comparison

```csharp
// Anemic Model (Wrong approach)
public class DepositChannel
{
    public CurrencyEnum Currency { get; set; }
    public List<int> VipLevels { get; set; }
    public decimal MinAmount { get; set; }
    public decimal MaxAmount { get; set; }
    // No business methods, only data
}

// Business logic scattered in Service
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
// Rich Model (Correct approach)
public class DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }

    // Business logic encapsulated in Domain Model
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsReachedPointLevel(PointLevel)
               && custContext.IsVipLevelInScope(VipLevels)
               && !custContext.IsTagInScope(ExcludeTags);
    }

    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return new DepositChannel(...);  // Return new instance
    }
}
```

---

## Immutability

### Design Principle

Domain Models should be immutable. When modifying, return a new instance rather than modifying the existing instance.

### Implementation Options

| Approach | Characteristics | Recommendation |
|----------|-----------------|----------------|
| **`record` type** | Native immutability, auto Equals/GetHashCode, supports `with` expression | ✅ Preferred |
| **`class` + `init` setter** | Traditional approach, requires manual equality implementation | ⚪ Alternative |

> **Recommendation**: Prefer using `record` unless there are special requirements (e.g., inheritance hierarchies or compatibility with older .NET versions). Project leads can decide based on team familiarity.

---

### Preferred: Using `record` Type

`record` was introduced in C# 9.0 and has built-in immutability, making it the preferred implementation for Domain Models.

```csharp
// ✅ Preferred: using record
public record DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public DepositTypeEnum DepositType { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    public int Sort { get; init; }

    // Business logic methods
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsVipLevelInScope(VipLevels);
    }
}
```

#### Advantages of record

| Advantage | Description |
|-----------|-------------|
| **Native Immutability** | Properties are `init` by default, no extra declaration needed |
| **Auto Equality** | Auto-generates `Equals()`, `GetHashCode()`, based on value comparison |
| **`with` Expression** | Concise copy-and-modify syntax |
| **Concise Syntax** | Reduces boilerplate code |

#### Using `with` Expression for Modification

```csharp
public record DepositChannel
{
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }
    // ... other properties

    /// <summary>
    /// Apply amount limit, return new instance
    /// </summary>
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        // ✅ Using with expression for concise creation of modified instance
        return this with
        {
            MinAmount = Math.Max(MinAmount, limitInfo.MinAmount),
            MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount)
        };
    }
}
```

#### record Inheritance Example

```csharp
// Abstract base class
public abstract record PromotionBase
{
    public string BonusCode { get; init; } = string.Empty;
    public abstract PromotionTypeEnum Type { get; }
    public Period DisplayPeriod { get; init; } = null!;

    // Shared business method
    public bool IsVisibleTo(ViewerContext viewer)
    {
        return Visibility.IsVisibleTo(viewer);
    }
}

// Concrete implementations
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

### Alternative: Using `class` + `init` Setter

When `record` cannot be used (e.g., compatibility with older frameworks), use `class` with `init` setter.

```csharp
// ⚪ Alternative: using class + init
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

#### Return New Instance on Modification

When using `class`, manually create new instances:

```csharp
public class DepositChannel
{
    // Private constructor for creating modified instances
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
    /// Apply amount limit, return new instance
    /// </summary>
    public DepositChannel WithAmountLimit(DepositLimitInfo depositLimitInfo)
    {
        var newMin = Math.Max(MinAmount, depositLimitInfo.MinAmount);
        var newMax = Math.Min(MaxAmount, depositLimitInfo.MaxAmount);

        // Manually create new instance
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

### Benefits of Immutability

| Benefit | Description |
|---------|-------------|
| **Thread Safety** | No locking needed in multi-threaded environments |
| **Predictability** | Object state won't change unexpectedly |
| **Easy to Test** | No need to consider state changes |
| **Easy to Track** | Can track object change history |

---

## Entity Design

### Entity Definition

Entities are domain objects with unique identity. Even if properties are the same, entities with different identities are different.

### Project Example: Customer

```csharp
public class Customer
{
    /// <summary>
    /// Customer identifier (unique identity)
    /// </summary>
    public int CustId { get; init; }

    public int SiteId { get; init; }
    public int VipLevel { get; init; }
    public List<int> Tags { get; init; } = new();
    public CurrencyEnum Currency { get; init; }

    // ==================== Business Logic Methods ====================

    /// <summary>
    /// Determine if customer VIP level is within specified range
    /// </summary>
    public bool IsVipLevelInScope(IList<int> scopeVipLevels)
    {
        if (scopeVipLevels is null || scopeVipLevels.Count == 0)
            return false;

        return scopeVipLevels.Contains(VipLevel);
    }

    /// <summary>
    /// Determine if customer has specified tags
    /// </summary>
    public bool IsTagInScope(IList<int> scopeTags)
    {
        if (Tags is null || Tags.Count == 0)
            return false;

        return scopeTags.Intersect(Tags).Any();
    }

    /// <summary>
    /// Determine if customer currency matches
    /// </summary>
    public bool IsCurrencyOf(CurrencyEnum currency)
    {
        return currency == Currency;
    }
}
```

---

## Value Objects Design

### Value Object Definition

Value Objects are domain objects **without identity**. Equality is determined by property values. Two Value Objects are equal if all their property values are the same.

### Value Object vs Entity

| Characteristic | Value Object | Entity |
|----------------|--------------|--------|
| **Identity** | Equality by property values | Equality by unique identifier |
| **Mutability** | Immutable | Can be mutable (but prefer immutable) |
| **Lifecycle** | Lives with owning entity | Independent lifecycle |
| **Examples** | Period, Address, Money | Customer, Order |

### Project Location

```
Models/
├── Domain/           # Entities, Aggregate Roots
└── ValueObject/      # Value Objects
    ├── Period.cs
    ├── VisibilityRules.cs
    ├── LocalizedContent.cs
    └── AntifraudRules.cs
```

### Value Object Example: Period (Time Range)

```csharp
/// <summary>
/// Value object representing a time range
/// </summary>
public record Period
{
    public DateTime StartTime { get; init; }
    public DateTime EndTime { get; init; }

    /// <summary>
    /// Determines if the specified time is within the range
    /// </summary>
    public bool Contains(DateTime dateTime)
    {
        return dateTime >= StartTime && dateTime <= EndTime;
    }

    /// <summary>
    /// Determines if current time is within the range
    /// </summary>
    public bool IsActive(DateTime now)
    {
        return Contains(now);
    }

    /// <summary>
    /// Determines if the range has expired
    /// </summary>
    public bool IsExpired(DateTime now)
    {
        return now > EndTime;
    }
}
```

### Value Object Example: VisibilityRules

```csharp
/// <summary>
/// Value object encapsulating multiple visibility rules
/// </summary>
public record VisibilityRules
{
    public bool RequiresLogin { get; init; }
    public IReadOnlyList<int> AllowedVipLevels { get; init; } = Array.Empty<int>();
    public IReadOnlyList<int> ExcludedTags { get; init; } = Array.Empty<int>();
    public IReadOnlyList<int> AllowedDeviceTypes { get; init; } = Array.Empty<int>();

    public static VisibilityRules Default => new();

    /// <summary>
    /// Determines if visible to the specified viewer
    /// </summary>
    public bool IsVisibleTo(ViewerContext viewer)
    {
        // Login requirement check
        if (RequiresLogin && !viewer.IsAuthenticated)
            return false;

        // VIP level check
        if (AllowedVipLevels.Any() && !AllowedVipLevels.Contains(viewer.VipLevel))
            return false;

        // Excluded tags check
        if (ExcludedTags.Any() && viewer.Tags.Intersect(ExcludedTags).Any())
            return false;

        // Device type check
        if (AllowedDeviceTypes.Any() && !AllowedDeviceTypes.Contains(viewer.DeviceType))
            return false;

        return true;
    }
}
```

### Value Object Example: LocalizedContent

```csharp
/// <summary>
/// Value object encapsulating multi-language content
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
    /// Gets display content for specified language, falls back to default language
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

### Value Object Design Principles

| Principle | Description |
|-----------|-------------|
| **Immutability** | Value Objects cannot be modified once created |
| **No Identity** | No ID property, equality by values |
| **Self-Validation** | Validate all properties during construction |
| **Behavior Encapsulation** | Encapsulate business logic related to the value |
| **Replaceability** | Objects with same values are interchangeable |

### When to Use Value Objects

| Scenario | Use Value Object |
|----------|------------------|
| Combination of related properties | Period (start + end time) |
| Encapsulating validation rule sets | VisibilityRules, AntifraudRules |
| Amount + currency combination | Money (Amount + Currency) |
| Multi-language content container | LocalizedContent |
| No need to track change history | Address, Coordinates, Color |

---

## Aggregate Design

### Aggregate Definition

An aggregate is a collection of related objects with an Aggregate Root responsible for maintaining overall consistency.

### Project Example: DepositChannels (Aggregate Root)

```csharp
public class DepositChannels
{
    // Internal collection: protected with private
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
    /// Aggregate root's core business method: Group by deposit type and apply limits
    /// </summary>
    public DepositChannelsByDepositType GroupByDepositType(CustomerContext custContext)
    {
        var channelsByType = new Dictionary<DepositTypeEnum, IList<DepositChannel>>();

        // 1. Filter channels applicable to customer
        var payInfoGrouping = DepositChannelList
            .Where(channel => channel.IsSupported(custContext))
            .GroupBy(channel => channel.DepositType);

        foreach (var group in payInfoGrouping)
        {
            // 2. Resolve deposit limit for this type
            if (!DepositLimitInfos.TryResolveLimit(custContext, group.Key, out var depositLimitInfo))
                continue;

            // 3. Filter channels with overlapping amount range and apply limits
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

### Aggregate Design Principles

| Principle | Description |
|-----------|-------------|
| **Single Entry Point** | Access internal objects through aggregate root |
| **Consistency Boundary** | Changes within aggregate maintain consistency |
| **Minimize Size** | Aggregates should not be too large |
| **Unique Identity** | Each aggregate has unique identification |

---

## Composite Object Design

### Project Example: CustomerContext

`CustomerContext` combines `Customer` and `PointLevel`, providing a unified customer query interface:

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

    // ==================== Delegate Methods ====================
    // Delegate queries to internal Customer object

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

    // ==================== Own Methods ====================
    // PointLevel related logic handled at this layer

    public bool IsReachedPointLevel(int requiredPointLevel)
    {
        return requiredPointLevel <= PointLevel;
    }
}
```

### Advantages of Composite Objects

- **Encapsulate Complexity**: Hide internal structure
- **Unified Interface**: Provide consistent query methods
- **Clear Responsibilities**: Each class only handles its own logic

---

## CreateDomain Pattern

### Design Purpose

Convert DbModel to Domain Model, achieving separation between the two.

### DbModel Definition

```csharp
namespace PaymentService.Models.DbModel
{
    /// <summary>
    /// Database mapping model (corresponds to Stored Procedure return columns)
    /// </summary>
    public class DepositChannel
    {
        public int? SysId { get; init; }
        public string BankCode { get; init; }
        public string BankName { get; init; }
        public int PayId { get; init; }
        public int DepositType { get; init; }        // int corresponds to Enum
        public int PointLevel { get; init; }
        public string VipLevel { get; init; }         // JSON string
        public string TagExcludeList { get; init; }   // JSON string
        public int CurrencyId { get; init; }          // int corresponds to Enum
        public decimal MinAmount { get; init; }
        public decimal MaxAmount { get; init; }
        public int Sort { get; init; }

        /// <summary>
        /// Convert to Domain Model
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

### Repository Using CreateDomain

```csharp
public class DepositRepository : IDepositRepository
{
    public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
    {
        // 1. Query DbModel
        var dbChannels = await _mainDbClient.QueryAsync<DbModel.DepositChannel>(
            "DepositChannel_Get", new { SiteId = siteId });

        var dbLimits = await _mainDbClient.QueryAsync<DbModel.DepositLimitInfo>(
            "DepositLimit_Get", new { SiteId = siteId });

        // 2. Use CreateDomain() for conversion
        var channels = dbChannels.Select(db => db.CreateDomain()).ToList();
        var limits = dbLimits.Select(db => db.CreateDomain()).ToList();

        // 3. Return Domain Model
        return new DepositChannels(channels, new DepositLimitInfos(limits));
    }
}
```

### Advantages of CreateDomain Pattern

| Advantage | Description |
|-----------|-------------|
| **Separation of Concerns** | DbModel handles database mapping, Domain Model handles business logic |
| **Type Safety** | JSON strings to List, int to Enum |
| **Easy to Maintain** | Database column changes don't affect business logic |
| **Easy to Test** | Domain Model can be tested independently |

---

## Domain Language Naming

### Naming Principles

Use business domain language for naming, making code self-explanatory:

| Technical-Oriented Naming | Domain-Oriented Naming |
|---------------------------|------------------------|
| `CheckVipLevel()` | `IsVipLevelInScope()` |
| `FilterByCondition()` | `IsSupported()` |
| `UpdateAmount()` | `WithAmountLimit()` |
| `ValidateRange()` | `IsOverlappingWith()` |
| `GetData()` | `GetCustContextAsync()` |
| `ProcessChannels()` | `GroupByDepositType()` |

### Naming Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `Is...` | Boolean check | `IsSupported()`, `IsOverlappingWith()` |
| `With...` | Return modified new instance | `WithAmountLimit()` |
| `Try...` | Attempt operation, return success/failure | `TryResolveLimit()` |
| `...InScope` | Range check | `IsVipLevelInScope()`, `IsTagInScope()` |

---

## Validation Logic Design

### Constructor Validation

```csharp
public class CustomerContext
{
    public CustomerContext(Customer customer, int pointLevel)
    {
        // Constructor validation
        Customer = customer
            ?? throw new ArgumentNullException(nameof(customer));

        PointLevel = pointLevel >= 0
            ? pointLevel
            : throw new ArgumentException("PointLevel cannot be negative", nameof(pointLevel));
    }
}
```

### Method Parameter Validation

```csharp
public class DepositChannel
{
    public bool IsOverlappingWith(DepositLimitInfo depositLimitInfo)
    {
        // Method parameter validation
        if (depositLimitInfo == null)
            throw new ArgumentNullException(nameof(depositLimitInfo));

        // Business logic
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

        // Business rule validation
        if (newMin > newMax)
            throw new InvalidOperationException(
                "No overlapping range exists. Call IsOverlappingWith() before WithAmountLimit().");

        return new DepositChannel(...);
    }
}
```

---

## Null Handling Strategy

### Project Example: DepositUnLimitInfo

When no corresponding limit setting is found, use an "unlimited" object:

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

        // No matching limit found -> use UnLimitInfo
        if (matchingLimit == null)
        {
            depositLimitInfo = new DepositUnLimitInfo(
                depositType, custContext.Customer.Currency, custContext.PointLevel);
            return true;
        }

        // Limit is disabled -> deposit not allowed
        if (matchingLimit.Status == GeneralStatusEnum.Disable)
        {
            depositLimitInfo = null;
            return false;
        }

        // Use found limit
        depositLimitInfo = matchingLimit;
        return true;
    }
}
```

### DepositUnLimitInfo Design

```csharp
/// <summary>
/// Represents unlimited deposit limit information
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
        MaxAmount = decimal.MaxValue;  // No upper limit
    }
}
```

---

## Review Checklist

### Domain Model Design Check

- [ ] Using `record` (preferred) or `class + init` (alternative) to ensure immutability?
- [ ] Do modification methods return new instances (`with` expression or manual creation)?
- [ ] Is business logic encapsulated within Domain Model?
- [ ] Use domain language for naming?
- [ ] Does constructor perform necessary validation?

### Value Object Check

- [ ] Is Value Object implemented using `record`?
- [ ] Is Value Object placed in `Models/ValueObject/` directory?
- [ ] Does Value Object have no identity (no ID property)?
- [ ] Does Value Object encapsulate related business logic?

### CreateDomain Check

- [ ] Are DbModel and Domain Model separated?
- [ ] Does Repository return Domain Model?
- [ ] Are JSON strings correctly parsed to strong types?
- [ ] Are ints correctly converted to Enums?

### Aggregate Design Check

- [ ] Does aggregate root provide unified operation entry point?
- [ ] Are internal collections protected with private?
- [ ] Is aggregate too large and needs splitting?

---

## Common Pitfalls for New Developers

### 1. Using set Instead of init

```csharp
// Wrong: Using set allows external modification
public class DepositChannel
{
    public decimal MinAmount { get; set; }
}

// Problem this causes
var channel = new DepositChannel { MinAmount = 100 };
channel.MinAmount = 999;  // Can be modified at will!

// Correct: Using init restricts to initialization only
public class DepositChannel
{
    public decimal MinAmount { get; init; }
}
```

### 2. Directly Modifying Object Instead of Returning New Instance

```csharp
// Wrong: Directly modifying existing instance
public void ApplyAmountLimit(DepositLimitInfo limitInfo)
{
    this.MinAmount = Math.Max(MinAmount, limitInfo.MinAmount);
    this.MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount);
}

// Correct: Return new instance
public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
{
    return new DepositChannel(
        Currency, DepositType, ExcludeTags, VipLevels, PointLevel,
        Math.Max(MinAmount, limitInfo.MinAmount),
        Math.Min(MaxAmount, limitInfo.MaxAmount),
        Sort);
}
```

### 3. Domain Model Depending on External Services

```csharp
// Wrong: Domain Model injecting Repository
public class DepositChannel
{
    private readonly IDepositRepository _repo;

    public async Task<bool> IsAvailable()
    {
        var limits = await _repo.GetLimits();  // Should not query database in Domain Model
        return ...;
    }
}

// Correct: Pass required data through parameters
public class DepositChannel
{
    public bool IsOverlappingWith(DepositLimitInfo depositLimitInfo)
    {
        // Data passed in from outside
        return MinAmount <= depositLimitInfo.MaxAmount
               && MaxAmount >= depositLimitInfo.MinAmount;
    }
}
```

### 4. Business Logic in Service Instead of Domain Model

```csharp
// Wrong: Business logic in Service
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

// Correct: Business logic in Domain Model
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

## TL / Reviewer Checkpoint

### Rich Model Review

| Check Item | Warning Signal |
|------------|----------------|
| Anemic model | Domain Model only has getter/setter, no business methods |
| Logic leakage | Service has lots of Where/Select business logic |
| Mutability | Uses `set` instead of `init` |

### Design Quality Review

- [ ] Do Domain Model methods use domain language naming?
- [ ] Is there appropriate parameter validation?
- [ ] Are aggregate boundaries reasonable?
- [ ] Is CreateDomain conversion complete?

### Common Review Questions

- "Why isn't this logic in Domain Model's IsSupported() method?"
- "Why does this property use set instead of init?"
- "Why does this method directly modify the object instead of returning a new instance?"

---

> **Document Version**: v1.1
> **Last Updated**: 2025-01
> **Changes**: Added `record` type as preferred option, added Value Object section
