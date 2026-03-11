# Feature Toggle Specification

> This document explains the design principles and implementation specifications for Feature Toggle, using the Dispatcher Pattern instead of traditional if-else conditions. It also introduces three execution modes and V1/V2 result comparison mechanism.

---

## Feature Toggle Overview

### Design Purpose

Feature Toggle is used to control the enabling and disabling of features. Common use cases include:

- **Gradual Rollout**: Progressively release new features to a subset of users
- **A/B Testing**: Run multiple versions simultaneously for comparison
- **Emergency Rollback**: Quickly disable problematic features
- **Environment Differences**: Enable different features in different environments

### Design Choice

| Approach | Pros | Cons | Project Choice |
|----------|------|------|----------------|
| **if-else** | Simple and intuitive | Hard to maintain, violates OCP | ❌ Not adopted |
| **Strategy Pattern** | Follows OCP | Requires extra abstraction | Partially adopted |
| **Dispatcher Pattern** | Highly decoupled, easily extensible | Learning curve | ✅ Primary choice |

---

## Dispatcher Pattern Design

### Architecture Concept

```
┌─────────────────────────────────────────────────────────┐
│  Controller / Service                                    │
│      ↓ calls                                             │
├─────────────────────────────────────────────────────────┤
│  Dispatcher                                              │
│      ↓ selects Handler based on Toggle state             │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ V1 Handler  │    │ V2 Handler  │    │ V3 Handler  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Core Components

| Component | Responsibility |
|-----------|----------------|
| **Handler Interface** | Defines the unified interface for features |
| **V1/V2 Handler** | Concrete implementations for each version |
| **Dispatcher** | Selects and executes Handler based on Toggle state |
| **Toggle Repository** | Reads Toggle configuration |

---

## Handler Interface Design

### Interface Definition

```csharp
namespace PaymentService.Features.Deposit
{
    /// <summary>
    /// Deposit options query Handler interface
    /// </summary>
    public interface IGetDepositOptionsHandler
    {
        /// <summary>
        /// Handler version identifier
        /// </summary>
        string Version { get; }

        /// <summary>
        /// Execute deposit options query
        /// </summary>
        Task<DepositOptionsResult> HandleAsync(GetDepositOptionsRequest request);
    }
}
```

### Interface Design Principles

- **Version Identifier**: Each Handler must have a unique version identifier
- **Unified Signature**: All Handler versions use the same method signature
- **Async First**: Methods should return `Task<T>`

---

## Handler Implementation

### V1 Handler (Legacy Version)

```csharp
namespace PaymentService.Features.Deposit.Handlers
{
    /// <summary>
    /// Deposit options query V1 Handler (legacy logic)
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
            // V1 legacy logic: uses old PayService
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

### V2 Handler (New Version)

```csharp
namespace PaymentService.Features.Deposit.Handlers
{
    /// <summary>
    /// Deposit options query V2 Handler (Clean Architecture)
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
            // V2 new logic: uses Clean Architecture
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

## Dispatcher Implementation

### Dispatcher Design

```csharp
namespace PaymentService.Features.Deposit
{
    /// <summary>
    /// Deposit options query Dispatcher
    /// Selects the appropriate Handler based on Feature Toggle configuration
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
        /// Dispatch request to the appropriate Handler
        /// </summary>
        public async Task<DepositOptionsResult> DispatchAsync(GetDepositOptionsRequest request)
        {
            // 1. Get currently active version
            var activeVersion = await _toggleRepository
                .GetActiveVersionAsync("GetDepositOptions", request.SiteId);

            // 2. Find the corresponding Handler
            var handler = _handlers.FirstOrDefault(h => h.Version == activeVersion);

            if (handler == null)
            {
                _logger.LogWarning(
                    "Handler not found for version {Version}, falling back to V1",
                    activeVersion);
                handler = _handlers.First(h => h.Version == "V1");
            }

            // 3. Execute Handler
            _logger.LogInformation(
                "Dispatching GetDepositOptions to {Version} handler",
                handler.Version);

            return await handler.HandleAsync(request);
        }
    }
}
```

### Dispatcher Design Principles

| Principle | Description |
|-----------|-------------|
| **Fallback Mechanism** | Use default version when corresponding version is not found |
| **Logging** | Record which Handler version is used |
| **Dependency Injection** | Obtain all Handlers through DI |

---

## Feature Toggle Repository

### Interface Definition

```csharp
namespace PaymentService.Features
{
    /// <summary>
    /// Feature Toggle Repository interface
    /// </summary>
    public interface IFeatureToggleRepository
    {
        /// <summary>
        /// Get the active version for a feature
        /// </summary>
        /// <param name="featureName">Feature name</param>
        /// <param name="siteId">Site ID (optional, for site-level control)</param>
        /// <returns>Active version number</returns>
        Task<string> GetActiveVersionAsync(string featureName, int? siteId = null);

        /// <summary>
        /// Check if a feature is enabled
        /// </summary>
        Task<bool> IsEnabledAsync(string featureName, int? siteId = null);
    }
}
```

### Implementation

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

## Database Table Design

### Feature Toggle Table

```sql
CREATE TABLE FeatureToggle (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    FeatureName VARCHAR(100) NOT NULL,
    SiteId INT NULL,                    -- NULL means global setting
    ActiveVersion VARCHAR(20) NOT NULL, -- 'V1', 'V2', 'DISABLED'
    Description VARCHAR(500),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY UK_Feature_Site (FeatureName, SiteId)
);
```

### Data Examples

| FeatureName | SiteId | ActiveVersion | Description |
|-------------|--------|---------------|-------------|
| GetDepositOptions | NULL | V1 | Default uses V1 |
| GetDepositOptions | 1 | V2 | Site 1 uses V2 |
| GetDepositOptions | 2 | V2 | Site 2 uses V2 |
| GetWithdrawalOptions | NULL | V1 | Default uses V1 |

---

## DI Registration

### Registering Handlers and Dispatcher

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // Register all Handlers (using multiple interface implementations)
    services.AddScoped<IGetDepositOptionsHandler, GetDepositOptionsV1Handler>();
    services.AddScoped<IGetDepositOptionsHandler, GetDepositOptionsV2Handler>();

    // Register Dispatcher
    services.AddScoped<GetDepositOptionsDispatcher>();

    // Register Feature Toggle Repository
    services.AddScoped<IFeatureToggleRepository, FeatureToggleRepository>();
}
```

### Controller Usage

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

## Comparison with if-else

### if-else Approach (Not Recommended)

```csharp
// ❌ Not recommended: using if-else
public class DepositController
{
    public async Task<IActionResult> GetDepositOptions(int custId)
    {
        var version = await _toggleRepo.GetActiveVersionAsync("GetDepositOptions");

        if (version == "V1")
        {
            // V1 logic
            var channels = await _payService.GetPayChannels(custId);
            return Ok(channels);
        }
        else if (version == "V2")
        {
            // V2 logic
            var channels = await _depositQueryService.GetChannels(custId);
            return Ok(channels);
        }
        else if (version == "V3")
        {
            // V3 logic...
        }
        else
        {
            // Default...
        }
    }
}
```

### Problems with if-else

| Problem | Description |
|---------|-------------|
| **Violates OCP** | Adding new versions requires modifying existing code |
| **Hard to test** | All logic mixed together |
| **Code bloat** | More versions, longer methods |
| **High coupling** | Controller knows all version details |

### Dispatcher Pattern Approach (Recommended)

```csharp
// ✅ Recommended: using Dispatcher Pattern
public class DepositController
{
    private readonly GetDepositOptionsDispatcher _dispatcher;

    public async Task<IActionResult> GetDepositOptions(
        [FromBody] GetDepositOptionsRequest request)
    {
        // Controller doesn't know which versions exist
        var result = await _dispatcher.DispatchAsync(request);
        return Ok(ApiResult.Success(result));
    }
}

// Adding V3 only requires:
// 1. Create GetDepositOptionsV3Handler
// 2. Register in DI
// 3. Update database configuration
// No need to modify Controller or Dispatcher
```

---

## Gradual Migration Strategy

### Migration Steps

```
Phase 1: Preparation
├── Create Handler interface
├── Wrap existing logic as V1 Handler
├── Create Dispatcher
└── Create Feature Toggle configuration

Phase 2: New Version Development
├── Develop V2 Handler (new logic)
├── Write V2 unit tests
└── Register V2 Handler

Phase 3: Gradual Rollout
├── Enable MixedWithShadow mode in test environment
├── Monitor V1/V2 result differences
├── Switch to MixedV2 mode after confirming no differences
└── Gradually expand scope

Phase 4: Cleanup
├── After all features use V2
├── Remove V1 Handler
└── Simplify or remove Dispatcher
```

---

## Dispatcher Three Execution Modes

To support gradual migration, the Dispatcher can adopt three execution modes. This is an advanced version control strategy suitable for risk management during large-scale feature refactoring.

> **Note**: This is not a mandatory universal specification, but a design option for future reference. Projects can decide whether to adopt it based on actual needs.

### Mode Overview

| Mode | Description | Applicable Phase |
|------|-------------|------------------|
| **V1Only** | Pure legacy execution | Default/Stable phase |
| **MixedWithShadow** | V1 returns + V2 background comparison | Validation phase |
| **MixedV2** | V1 + V2 parallel, results merged | Production phase |

### Mode 1: V1Only (Default Mode)

The most basic mode where all requests are handled by V1 Handler.

```csharp
// V1Only: V1 handles all requests
private async Task<List<Result>> ExecuteV1OnlyAsync(Request request)
{
    var handler = GetHandler(HandlerVersionEnum.V1);
    return await handler.HandleAsync(request);
}
```

**Applicable scenarios**:
- New feature not ready yet
- Emergency rollback needed

### Mode 2: MixedWithShadow (Validation Mode)

V1 handles the request and returns results, V2 runs in background and compares results to validate V2 correctness.

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

    return v1Result;  // Always return V1 result
}
```

**Applicable scenarios**:
- Validating if V2 logic is consistent with V1
- Discovering potential issues without affecting production traffic

### Mode 3: MixedV2 (Production Mode)

V1 and V2 run in parallel, each handling their supported types, then merging results.

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

**Applicable scenarios**:
- V2 has been validated as stable
- Need to gradually migrate types from V1 to V2

### Mode Selection Flow

```
Start Migration
    │
    ├─ Develop V2 Handler
    │
    ▼
V1Only (Default)
    │
    ├─ V2 development complete, ready for validation
    │
    ▼
MixedWithShadow (Validation)
    │
    ├─ Monitor comparison results
    ├─ Confirm no differences
    │
    ▼
MixedV2 (Production)
    │
    ├─ Gradually expand V2 supported types
    │
    ▼
Remove V1, simplify architecture
```

---

## Feature Toggle Configuration Sources

Toggle configuration can come from two sources. Projects can choose the appropriate approach based on requirements.

### Option 1: Database Configuration

Store Toggle configuration in database tables, supporting dynamic adjustment with immediate effect.

**Applicable scenarios**:
- Need to adjust settings dynamically without restarting service
- Need site-level granular control
- Need to adjust settings through admin panel

**Table Design**:

```sql
CREATE TABLE FeatureToggle (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    FeatureName VARCHAR(100) NOT NULL,
    SiteId INT NULL,                    -- NULL means global setting
    ActiveVersion VARCHAR(20) NOT NULL, -- 'V1', 'V2', 'DISABLED'
    Description VARCHAR(500),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UpdatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY UK_Feature_Site (FeatureName, SiteId)
);
```

**Priority Rules**:
1. Site-specific setting (SiteId = specific value)
2. Global setting (SiteId = NULL)
3. Default value (V1)

### Option 2: appsettings.json Configuration

Store Toggle configuration in config files, configured at deployment time, takes effect after restart.

**Applicable scenarios**:
- Simple version control
- Configuration changes need to go through deployment process
- No need for dynamic adjustment

**Configuration Example**:

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

### Comparison and Selection

| Aspect | Database Configuration | appsettings.json |
|--------|------------------------|------------------|
| **Effect Timing** | Immediate (with cache) | Requires service restart |
| **Adjustment Method** | Admin panel/direct DB modification | Modify config file and deploy |
| **Granularity** | Supports site/customer level | Usually global/operation level |
| **Traceability** | Database has change records | Requires version control tracking |
| **Complexity** | Higher (needs table, cache) | Lower (uses IOptions) |

> **Recommendation**: Project leads can choose the appropriate approach based on team needs and complexity. Both approaches can also be used together.

---

## V1/V2 Result Comparison Mechanism

In MixedWithShadow mode, V1 and V2 results need to be compared to validate correctness.

### Comparison Result Data Structure

```csharp
/// <summary>
/// V1/V2 comparison result
/// </summary>
public class ComparisonResult
{
    /// <summary>
    /// Whether results are completely identical
    /// </summary>
    public bool IsMatch { get; set; }

    /// <summary>
    /// V1 result count
    /// </summary>
    public int V1Count { get; set; }

    /// <summary>
    /// V2 result count
    /// </summary>
    public int V2Count { get; set; }

    /// <summary>
    /// Item IDs only present in V1
    /// </summary>
    public List<string> OnlyInV1 { get; set; } = new();

    /// <summary>
    /// Item IDs only present in V2
    /// </summary>
    public List<string> OnlyInV2 { get; set; } = new();

    /// <summary>
    /// List of field differences
    /// </summary>
    public List<FieldDifference> Differences { get; set; } = new();
}

/// <summary>
/// Single field difference
/// </summary>
public class FieldDifference
{
    public string ItemId { get; set; }
    public string FieldName { get; set; }
    public string V1Value { get; set; }
    public string V2Value { get; set; }
}
```

### Comparison Logic Implementation

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

    // Compare key fields of common items
    foreach (var id in v1Dict.Keys.Intersect(v2Dict.Keys))
    {
        var v1 = v1Dict[id];
        var v2 = v2Dict[id];

        // Compare key business fields
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

        // Add other field comparisons as needed...
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

### Logging

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

### Monitoring Recommendations

| Metric | Description |
|--------|-------------|
| **Match Rate** | Percentage of matching results |
| **Mismatch Count** | Total number of mismatches |
| **Common Differences** | Most frequently differing fields |
| **V2 Error Rate** | Percentage of V2 execution errors |

---

## Review Checklist

### Handler Design Check

- [ ] Does each Handler have a unique version identifier?
- [ ] Do all Handlers implement the same interface?
- [ ] Does each Handler only contain its version's logic?
- [ ] Are there appropriate unit tests?

### Dispatcher Design Check

- [ ] Is there a Fallback mechanism?
- [ ] Is there logging for which version is used?
- [ ] Are all Handlers injected through DI?
- [ ] Is the appropriate execution mode selected (V1Only/MixedWithShadow/MixedV2)?

### Feature Toggle Check

- [ ] Is the appropriate configuration source selected (database/appsettings)?
- [ ] Is Toggle configuration cached?
- [ ] Is there DISABLED state support?

### V1/V2 Comparison Check (when using MixedWithShadow mode)

- [ ] Are the key fields to compare defined?
- [ ] Is comparison result logging implemented?
- [ ] Is mismatch rate being monitored?

---

## Common Pitfalls for New Developers

### 1. Using if-else in Controller to Determine Version

```csharp
// ❌ Wrong: if-else judgment
public async Task<IActionResult> GetDepositOptions(int custId)
{
    var version = await _toggleRepo.GetActiveVersionAsync("GetDepositOptions");

    if (version == "V1")
    {
        // V1 logic
    }
    else if (version == "V2")
    {
        // V2 logic
    }
}

// ✅ Correct: use Dispatcher
public async Task<IActionResult> GetDepositOptions(GetDepositOptionsRequest request)
{
    var result = await _dispatcher.DispatchAsync(request);
    return Ok(result);
}
```

### 2. Inappropriate Code Sharing Between Handlers

```csharp
// ❌ Wrong: V2 inherits V1
public class GetDepositOptionsV2Handler : GetDepositOptionsV1Handler
{
    public override Task<Result> HandleAsync(Request request)
    {
        // Override partial logic
    }
}

// ✅ Correct: each Handler implements independently
public class GetDepositOptionsV1Handler : IGetDepositOptionsHandler { ... }
public class GetDepositOptionsV2Handler : IGetDepositOptionsHandler { ... }

// If shared logic is needed, extract to a separate Helper class
```

### 3. Forgetting to Register New Handler

```csharp
// ❌ Wrong: only create Handler class, forget DI registration
public class GetDepositOptionsV3Handler : IGetDepositOptionsHandler { ... }
// But not registered in Startup.cs

// ✅ Correct: remember DI registration
services.AddScoped<IGetDepositOptionsHandler, GetDepositOptionsV3Handler>();
```

---

## TL / Reviewer Checkpoint

### Architecture Review

| Check Item | Warning Signal |
|------------|----------------|
| if-else version judgment | Controller/Service has `if (version == "V1")` |
| Handler inheritance | V2Handler inherits V1Handler |
| Missing Fallback | Dispatcher doesn't handle Handler not found case |

### Migration Plan Review

- [ ] Is there a complete migration plan?
- [ ] Is there a Rollback strategy?
- [ ] Is there monitoring for new version error rates?

### Cleanup Plan Review

- [ ] Is there a removal timeline for old versions?
- [ ] Is there documentation recording each version's status?

---

> **Document Version**: v1.1
> **Last Updated**: 2025-01
> **Changes**: Added three execution modes (V1Only/MixedWithShadow/MixedV2), configuration source options, V1/V2 result comparison mechanism
