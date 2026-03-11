# AI Development Standards

> **Target Audience**: AI Assistant
> **Purpose**: Complete specification reference for AI-assisted development, including all rules, examples, and edge cases
> **Last Updated**: 2025-01

---

## Standards Overview

### Project Architecture Layers

```
PaymentService/
├── Models/
│   ├── Domain/           ← Domain Layer: Core business logic
│   ├── DbModel/          ← Infrastructure: Database mapping
│   ├── ValueObject/      ← Domain Layer: Value objects
│   ├── Enum/             ← Enumeration definitions
│   └── Payload/          ← Presentation: API models
├── Services/             ← Application Layer: Interface definitions + Service implementations
│   ├── ICustomerRepository.cs    ← Interface definition
│   ├── IDepositRepository.cs
│   └── DepositQueryService.cs    ← Service implementation
├── Repositories/         ← Infrastructure Layer: Repository implementations
│   ├── CustomerRepository.cs
│   └── CustomerRepositoryDecorator.cs  ← Decorator
├── Controllers/          ← Presentation Layer
├── Middlewares/          ← Cross-cutting concerns (entry point)
├── Handlers/             ← Application Layer: HTTP handling (outbound)
└── Exceptions/           ← Custom exceptions
```

### Core Principles Checklist

| # | Principle | Rule | Violation Consequence |
|---|-----------|------|----------------------|
| 1 | DIP | Interfaces defined in `Services/`, implementations in `Repositories/` | High coupling |
| 2 | SoC | Caching via Decorator, exceptions via Middleware | Mixed responsibilities |
| 3 | OCP | Extension over modification | Breaking existing functionality |
| 4 | SRP | One class, one reason to change | Maintenance difficulty |
| 5 | DDD | Rich Domain Model | Anemic Model |
| 6 | ISP | Small, focused interfaces | Dependency bloat |
| 7 | YAGNI | Only build what's currently needed | Code bloat |

---

## Coding Conventions

### Naming Conventions

#### Class Naming

| Type | Rule | Example |
|------|------|---------|
| Domain Model | PascalCase, noun | `DepositChannel`, `Customer` |
| DbModel | PascalCase + DbModel namespace | `DbModel.DepositChannel` |
| Repository Interface | `I` + noun + `Repository` | `ICustomerRepository` |
| Repository Implementation | noun + `Repository` | `CustomerRepository` |
| Decorator | noun + `RepositoryDecorator` | `CustomerRepositoryDecorator` |
| Service | noun + `Service` | `DepositQueryService` |
| Handler | noun + `Handler` | `GetPromotionListHandler` |
| Dispatcher | noun + `Dispatcher` | `PromotionListDispatcher` |

#### Method Naming

| Scenario | Rule | Example |
|----------|------|---------|
| Query method | `Get` + noun + `Async` | `GetCustomerAsync()` |
| Boolean method | `Is` + condition | `IsSupported()`, `IsVipLevelInScope()` |
| Transformation method | `CreateDomain()` or `With` + change | `CreateDomain()`, `WithAmountLimit()` |
| Validation method | `Validate` + noun | `ValidateRequest()` |

#### Variable Naming

| Type | Rule | Example |
|------|------|---------|
| Private field | `_camelCase` | `_customerRepository` |
| Local variable | `camelCase` | `custContext`, `depositChannels` |
| Constant | `PascalCase` or `UPPER_CASE` | `MaxRetryCount`, `CacheKeyPrefix` |

### Code Structure

#### Class Member Ordering

```csharp
public class CustomerService : ICustomerService
{
    // 1. Constants
    private const int MaxRetryCount = 3;

    // 2. Static readonly fields
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    // 3. Instance fields (readonly first)
    private readonly ICustomerRepository _customerRepository;
    private readonly ILogger<CustomerService> _logger;

    // 4. Static constructor (if needed)
    static CustomerService() { }

    // 5. Constructors
    public CustomerService(ICustomerRepository customerRepository, ILogger<CustomerService> logger)
    {
        _customerRepository = customerRepository;
        _logger = logger;
    }

    // 6. Public properties
    public int RetryCount => _retryCount;

    // 7. Public methods
    public async Task<Customer> GetCustomerAsync(int customerId) { }

    // 8. Protected/Internal methods

    // 9. Private methods
    private string GenerateCacheKey(int customerId) { }

    // 10. Nested types
}
```

#### Namespace Rules

```csharp
// ✅ Correct: Use file-scoped namespace
namespace BonusService.Services;

public class CustomerService { }

// ❌ Wrong: Use block-scoped namespace
namespace BonusService.Services
{
    public class CustomerService { }
}
```

#### Using Statement Ordering

```csharp
// 1. System namespaces
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

// 2. Microsoft namespaces
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

// 3. Third-party namespaces (alphabetical order)
using FluentAssertions;
using NSubstitute;

// 4. Project namespaces
using BonusService.Models.Domain;
using BonusService.Services;
```

### Comments & Documentation

#### XML Documentation Requirements

**Required Format**: All `public` members must have English XML comments

```csharp
/// <summary>
/// Gets the customer information by customer ID.
/// </summary>
/// <param name="customerId">The unique identifier of the customer.</param>
/// <returns>The customer domain model, or null if not found.</returns>
/// <exception cref="ArgumentException">Thrown when customerId is invalid.</exception>
public async Task<Customer?> GetCustomerAsync(int customerId)
{
    // Implementation
}
```

**Documentation Requirements by Member Type**:

| Member Type | Required Tags |
|-------------|---------------|
| Class | `<summary>` |
| Method | `<summary>`, `<param>`, `<returns>` |
| Property | `<summary>` |
| Exception-throwing method | `<summary>`, `<param>`, `<returns>`, `<exception>` |

---

## Development Guidelines

### Domain Model Design

#### Immutability Requirements

```csharp
// ✅ Correct: Use record (recommended)
public sealed record DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }

    // Immutability: Use with expression to create new instance
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return this with
        {
            MinAmount = Math.Max(MinAmount, limitInfo.MinAmount),
            MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount)
        };
    }
}

// ✅ Correct: Use class + init (alternative)
public sealed class DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public List<int> VipLevels { get; init; }

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

// ❌ Wrong: Use mutable set
public class DepositChannel
{
    public CurrencyEnum Currency { get; set; }  // Wrong!
}
```

#### Rich Domain Model Requirements

```csharp
// ✅ Correct: Rich Model - Business logic inside Domain Model
public class DepositChannel
{
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsReachedPointLevel(PointLevel)
               && custContext.IsVipLevelInScope(VipLevels)
               && !custContext.IsTagInScope(ExcludeTags);
    }
}

// ❌ Wrong: Anemic Model - Business logic outside
public class DepositService
{
    public bool IsChannelSupported(DepositChannel channel, CustomerContext context)
    {
        // This logic should be inside Domain Model
        return context.Currency == channel.Currency
               && channel.VipLevels.Contains(context.VipLevel);
    }
}
```

#### Value Object Design

```csharp
// Value Object example: Time period
public sealed record Period
{
    public MarketDateTime StartTime { get; init; }
    public MarketDateTime EndTime { get; init; }

    public bool IsActive(MarketDateTime now)
        => now >= StartTime && now <= EndTime;

    public bool Contains(MarketDateTime dateTime)
        => dateTime >= StartTime && dateTime <= EndTime;
}

// Value Object example: Visibility rules
public sealed record VisibilityRules
{
    public required IReadOnlyList<int> VipLevels { get; init; }
    public required IReadOnlyList<int> ExcludeTags { get; init; }
    public required int PointLevel { get; init; }

    public bool IsVisibleTo(CustomerContext context)
    {
        return context.IsVipLevelInScope(VipLevels)
               && !context.IsTagInScope(ExcludeTags)
               && context.IsReachedPointLevel(PointLevel);
    }
}
```

### Repository Design

#### Interface Definition Location

```csharp
// ✅ Correct: Interface in Services/ namespace
namespace PaymentService.Services;

public interface ICustomerRepository
{
    Task<Customer> GetCustInfoAsync(int custId);
    Task<CustomerContext> GetCustContextAsync(int custId);
}

// ❌ Wrong: Interface in Repositories/ namespace
namespace PaymentService.Repositories;

public interface ICustomerRepository { }  // Wrong location!
```

#### Implementation Rules

```csharp
namespace PaymentService.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly MySqlClient _mainDbClient;

    public CustomerRepository(MySqlClient mainDbClient)
    {
        _mainDbClient = mainDbClient;
    }

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        // 1. Query DbModel
        var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
            "Customer_Get", new { CustId = custId });

        // 2. Convert to Domain Model
        return dbCust?.CreateDomain();
    }
}
```

#### Decorator Pattern Implementation

```csharp
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;
    private readonly ICacheHelper _cacheHelper;

    public CustomerRepositoryDecorator(
        ICustomerRepository inner,
        ICacheHelper cacheHelper)
    {
        _inner = inner;
        _cacheHelper = cacheHelper;
    }

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            async () => await _inner.GetCustInfoAsync(custId)
        );
    }
}

// DI Registration
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

### Service Layer Design

```csharp
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

    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        // 1. Parallel query optimization
        var custContextTask = _customerRepository.GetCustContextAsync(custId);
        var depositChannelsTask = _depositRepository.GetDepositChannelsAsync(siteId);

        await Task.WhenAll(custContextTask, depositChannelsTask);

        var custContext = await custContextTask;
        var depositChannels = await depositChannelsTask;

        // 2. Delegate business logic to Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}
```

### Error Handling

#### Custom Exceptions

```csharp
// Base exception class
public class PaymentServiceException : Exception
{
    public PaymentError Error { get; }

    public PaymentServiceException(PaymentError error, string message)
        : base(message)
    {
        Error = error;
    }
}

// Specific business exception
public class CustomerNotFoundException : PaymentServiceException
{
    public CustomerNotFoundException(int custId)
        : base(PaymentError.CustomerNotFound, $"Customer not found. custId: {custId}")
    {
    }
}
```

#### Exception Handling Rules

```csharp
// ✅ Correct: Throw specific business exception
public async Task<Customer> GetCustomerAsync(int custId)
{
    var customer = await _repository.GetCustInfoAsync(custId);
    if (customer == null)
        throw new CustomerNotFoundException(custId);
    return customer;
}

// ❌ Wrong: Swallowing exceptions
public async Task<Customer?> GetCustomerAsync(int custId)
{
    try
    {
        return await _repository.GetCustInfoAsync(custId);
    }
    catch (Exception)
    {
        return null;  // Wrong! Should not swallow exceptions
    }
}
```

### Logging

```csharp
// ✅ Correct: Structured logging
_logger.LogInformation(
    "Customer {CustomerId} retrieved successfully with VipLevel {VipLevel}",
    custId, customer.VipLevel);

// ❌ Wrong: String interpolation (cannot be structured searched)
_logger.LogInformation($"Customer {custId} retrieved successfully");
```

### Testing Requirements

#### Given-When-Then Structure

```csharp
[Test]
public void IsSupported_WhenAllConditionsMet_ShouldReturnTrue()
{
    // Given - Prepare test data
    var channel = GivenDepositChannel(
        currency: CurrencyEnum.CNY,
        vipLevels: new List<int> { 1, 2, 3 });

    var custContext = GivenCustomerContext(
        currency: CurrencyEnum.CNY,
        vipLevel: 2);

    // When - Execute method under test
    var result = channel.IsSupported(custContext);

    // Then - Verify result
    result.Should().BeTrue();
}

// Given helper method
private DepositChannel GivenDepositChannel(
    CurrencyEnum currency = CurrencyEnum.CNY,
    List<int>? vipLevels = null)
{
    return new DepositChannelBuilder()
        .With(currency: currency, vipLevels: vipLevels)
        .Build();
}
```

#### Test Naming Convention

```
[MethodUnderTest]_[Scenario]_[ExpectedResult]

Examples:
- IsSupported_WhenAllConditionsMet_ShouldReturnTrue
- IsSupported_WhenCurrencyNotMatch_ShouldReturnFalse
- GetAsync_WhenCustomerNotFound_ThrowsCustomerNotFoundException
```

#### FluentAssertions Usage

```csharp
// Value comparison
result.Should().Be(expected);
result.Should().BeTrue();
result.Should().BeNull();

// Collection verification
result.Should().HaveCount(3);
result.Should().ContainSingle();
result.Should().BeEquivalentTo(expectedList);

// Exception verification
var act = async () => await service.GetAsync(id);
await act.Should().ThrowAsync<CustomerNotFoundException>()
    .WithMessage("*custId: 1*");

// Immutability verification
result.Should().NotBeSameAs(original);
```

### Performance Considerations

#### Parallel Queries

```csharp
// ✅ Correct: Execute independent queries in parallel
var custContextTask = _customerRepository.GetCustContextAsync(custId);
var depositChannelsTask = _depositRepository.GetDepositChannelsAsync(siteId);

await Task.WhenAll(custContextTask, depositChannelsTask);

// ❌ Wrong: Execute independent queries sequentially
var custContext = await _customerRepository.GetCustContextAsync(custId);
var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);
```

#### Caching Strategy

```csharp
// Use Decorator to implement caching
public async Task<Customer> GetCustInfoAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync(
        $"CustInfo:{custId}",
        TimeSpan.FromMinutes(1),  // Appropriate expiration time
        async () => await _inner.GetCustInfoAsync(custId)
    );
}
```

---

## Security Standards

### Input Validation

```csharp
// Controller layer uses Data Annotations
public class DepositRequest
{
    [Required]
    [Range(1, int.MaxValue)]
    public int CustomerId { get; set; }

    [Required]
    [Range(0.01, 1000000)]
    public decimal Amount { get; set; }
}
```

### Sensitive Data Handling

```csharp
// ❌ Wrong: Log sensitive data
_logger.LogInformation("User password: {Password}", password);

// ✅ Correct: Mask sensitive data
_logger.LogInformation("User {UserId} authenticated", userId);
```

---

## Database Operations

### Using Stored Procedures

```csharp
public async Task<Customer> GetCustInfoAsync(int custId)
{
    return await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
        "Customer_Get",  // SP name
        new { CustId = custId });  // Parameters
}
```

### DbModel Conversion

```csharp
namespace PaymentService.Models.DbModel;

public class Customer
{
    public int CustId { get; set; }
    public int VipLevel { get; set; }
    public int CurrencyId { get; set; }

    // Convert to Domain Model
    public Domain.Customer CreateDomain()
    {
        return new Domain.Customer
        {
            CustId = CustId,
            VipLevel = VipLevel,
            Currency = (CurrencyEnum)CurrencyId
        };
    }
}
```

---

## API Design Principles

### Controller Design

```csharp
[ApiController]
[Route("api/[controller]")]
public class DepositController : ControllerBase
{
    private readonly IDepositQueryService _depositQueryService;

    [HttpGet("channels/{custId}")]
    public async Task<ApiResult<DepositChannelsByDepositType>> GetChannels(int custId)
    {
        // Controller only handles HTTP, logic in Service
        var result = await _depositQueryService.GetDepositChannelsByDepositTypeAsync(custId);
        return ApiResult.Success(result);
    }
}
```

### Response Format

```csharp
public class ApiResult<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}
```

---

## Edge Cases & Exceptions

### Null Handling

```csharp
// ✅ Correct: Explicitly handle null
public async Task<Customer> GetCustomerAsync(int custId)
{
    var customer = await _repository.GetCustInfoAsync(custId);
    if (customer == null)
        throw new CustomerNotFoundException(custId);
    return customer;
}

// Or use nullable return type
public async Task<Customer?> TryGetCustomerAsync(int custId)
{
    return await _repository.GetCustInfoAsync(custId);
}
```

### Collection Boundaries

```csharp
// Ensure collection is not null
public IReadOnlyList<int> VipLevels { get; init; } = Array.Empty<int>();

// Or use required
public required IReadOnlyList<int> VipLevels { get; init; }
```

### Numeric Boundaries

```csharp
public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
{
    var newMin = Math.Max(MinAmount, limitInfo.MinAmount);
    var newMax = Math.Min(MaxAmount, limitInfo.MaxAmount);

    // Boundary check
    if (newMin > newMax)
        throw new InvalidOperationException(
            $"Invalid amount range: min={newMin}, max={newMax}");

    return this with { MinAmount = newMin, MaxAmount = newMax };
}
```

---

## Code Examples

### Good Examples

#### Complete Domain Model

```csharp
public sealed record DepositChannel
{
    public required CurrencyEnum Currency { get; init; }
    public required DepositTypeEnum DepositType { get; init; }
    public required IReadOnlyList<int> VipLevels { get; init; }
    public required IReadOnlyList<int> ExcludeTags { get; init; }
    public required int PointLevel { get; init; }
    public required decimal MinAmount { get; init; }
    public required decimal MaxAmount { get; init; }
    public required int Sort { get; init; }

    /// <summary>
    /// Determines if this channel is supported for the given customer context.
    /// </summary>
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsReachedPointLevel(PointLevel)
               && custContext.IsVipLevelInScope(VipLevels)
               && !custContext.IsTagInScope(ExcludeTags);
    }

    /// <summary>
    /// Creates a new channel with adjusted amount limits.
    /// </summary>
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return this with
        {
            MinAmount = Math.Max(MinAmount, limitInfo.MinAmount),
            MaxAmount = Math.Min(MaxAmount, limitInfo.MaxAmount)
        };
    }
}
```

#### Complete Repository Decorator

```csharp
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;
    private readonly ICacheHelper _cacheHelper;
    private readonly ILogger<CustomerRepositoryDecorator> _logger;

    public CustomerRepositoryDecorator(
        ICustomerRepository inner,
        ICacheHelper cacheHelper,
        ILogger<CustomerRepositoryDecorator> logger)
    {
        _inner = inner;
        _cacheHelper = cacheHelper;
        _logger = logger;
    }

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cacheKey = $"CustInfo:{custId}";

        return await _cacheHelper.TryGetOrCreateAsync(
            cacheKey,
            TimeSpan.FromMinutes(1),
            async () =>
            {
                _logger.LogDebug("Cache miss for {CacheKey}", cacheKey);
                return await _inner.GetCustInfoAsync(custId);
            });
    }

    public async Task<CustomerContext> GetCustContextAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(
            $"CustContext:{custId}",
            TimeSpan.FromMinutes(1),
            async () => await _inner.GetCustContextAsync(custId));
    }
}
```

#### Complete Test Class

```csharp
[TestFixture]
public class DepositChannelTests
{
    #region IsSupported Tests

    [Test]
    public void IsSupported_WhenAllConditionsMet_ShouldReturnTrue()
    {
        // Given
        var channel = GivenDepositChannel(
            currency: CurrencyEnum.CNY,
            vipLevels: new List<int> { 1, 2, 3 },
            pointLevel: 5);

        var custContext = GivenCustomerContext(
            currency: CurrencyEnum.CNY,
            vipLevel: 2,
            pointLevel: 8);

        // When
        var result = channel.IsSupported(custContext);

        // Then
        result.Should().BeTrue();
    }

    [Test]
    public void IsSupported_WhenCurrencyNotMatch_ShouldReturnFalse()
    {
        // Given
        var channel = GivenDepositChannel(currency: CurrencyEnum.CNY);
        var custContext = GivenCustomerContext(currency: CurrencyEnum.USD);

        // When
        var result = channel.IsSupported(custContext);

        // Then
        result.Should().BeFalse();
    }

    #endregion

    #region WithAmountLimit Tests

    [Test]
    public void WithAmountLimit_WhenRangesOverlap_ShouldReturnNewInstanceWithIntersectedRange()
    {
        // Given
        var channel = GivenDepositChannel(minAmount: 100, maxAmount: 1000);
        var limitInfo = GivenDepositLimitInfo(minAmount: 200, maxAmount: 800);

        // When
        var result = channel.WithAmountLimit(limitInfo);

        // Then
        result.Should().NotBeSameAs(channel);
        result.MinAmount.Should().Be(200);
        result.MaxAmount.Should().Be(800);
    }

    #endregion

    #region Helper Methods

    private DepositChannel GivenDepositChannel(
        CurrencyEnum currency = CurrencyEnum.CNY,
        List<int>? vipLevels = null,
        int pointLevel = 1,
        decimal minAmount = 100,
        decimal maxAmount = 5000)
    {
        return new DepositChannelBuilder()
            .With(
                currency: currency,
                vipLevels: vipLevels,
                pointLevel: pointLevel,
                minAmount: minAmount,
                maxAmount: maxAmount)
            .Build();
    }

    private CustomerContext GivenCustomerContext(
        CurrencyEnum currency = CurrencyEnum.CNY,
        int vipLevel = 1,
        int pointLevel = 1)
    {
        return new CustomerContextBuilder()
            .With(currency: currency, vipLevel: vipLevel, pointLevel: pointLevel)
            .Build();
    }

    private DepositLimitInfo GivenDepositLimitInfo(
        decimal minAmount = 100,
        decimal maxAmount = 5000)
    {
        return new DepositLimitInfo
        {
            MinAmount = minAmount,
            MaxAmount = maxAmount
        };
    }

    #endregion
}
```

### Anti-patterns

#### Anti-pattern 1: Anemic Domain Model

```csharp
// ❌ Anti-pattern: Domain Model with only data
public class DepositChannel
{
    public CurrencyEnum Currency { get; set; }
    public List<int> VipLevels { get; set; }
    // No business logic methods
}

// ❌ Business logic moved to Service
public class DepositService
{
    public bool IsChannelSupported(DepositChannel channel, CustomerContext context)
    {
        return context.Currency == channel.Currency
               && channel.VipLevels.Contains(context.VipLevel);
    }
}
```

#### Anti-pattern 2: DIP Violation

```csharp
// ❌ Anti-pattern: Interface defined in wrong location
namespace PaymentService.Repositories
{
    public interface ICustomerRepository { }  // Should be in Services/
}

// ❌ Anti-pattern: Direct dependency on implementation
public class DepositQueryService
{
    private readonly CustomerRepository _repository;  // Should depend on interface
}
```

#### Anti-pattern 3: Repository with Caching

```csharp
// ❌ Anti-pattern: Caching logic directly in Repository
public class CustomerRepository : ICustomerRepository
{
    private readonly ICacheHelper _cache;  // Should not be here

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;

        var data = await _db.Query(...);
        await _cache.SetAsync($"Cust:{custId}", data);
        return data;
    }
}
```

#### Anti-pattern 4: Mixed Commits

```bash
# ❌ Anti-pattern: One commit mixing structural and behavioral changes
git commit -m "feat: add validation and refactor service"

# ✅ Correct: Separate commits
git commit -m "refactor: extract validation logic"
git commit -m "feat: add deposit validation"
```

#### Anti-pattern 5: Speculative Features (YAGNI Violation)

```csharp
// ❌ Anti-pattern: Creating methods without current use cases
public class ClaimHistory
{
    // These methods are created "just in case"
    public IEnumerable<ClaimRecord> GetRecords() => _records;
    public MarketDateTime? GetLastClaimDate(string bonusCode) => ...;
    public IEnumerable<ClaimRecord> GetByPromotionTypes(...) => ...;
    public IEnumerable<ClaimRecord> GetByCategoryId(int categoryId) => ...;
}

// ✅ Correct: Only create methods with clear use cases
public class ClaimHistory
{
    public bool HasClaimedBonus(string bonusCode)
        => _records.Any(r => r.BonusCode == bonusCode);

    public bool HasClaimedAny(params PromotionTypeEnum[] promotionTypes)
        => _records.Any(r => promotionTypes.Contains(r.PromotionType));
}
```

---

## Reference Documents

| Topic | File Path |
|-------|-----------|
| Architecture Overview | [en/02-Architecture-Overview.md](en/02-Architecture-Overview.md) |
| Core Principles | [en/05-Clean-Architecture-Core-Principles.md](en/05-Clean-Architecture-Core-Principles.md) |
| Layer Responsibilities | [en/06-Layer-Responsibilities.md](en/06-Layer-Responsibilities.md) |
| TDD & Tidy First | [en/07-TDD-and-Tidy-First-Guide.md](en/07-TDD-and-Tidy-First-Guide.md) |
| Domain Model | [en/08-Domain-Model-Design-Guide.md](en/08-Domain-Model-Design-Guide.md) |
| Repository Pattern | [en/09-Repository-Pattern.md](en/09-Repository-Pattern.md) |
| Service Layer | [en/10-Service-Layer-Design.md](en/10-Service-Layer-Design.md) |
| Decorator Pattern | [en/11-Decorator-Pattern-Specification.md](en/11-Decorator-Pattern-Specification.md) |
| Feature Toggle | [en/12-Feature-Toggle-Specification.md](en/12-Feature-Toggle-Specification.md) |
| Exception Handling | [en/13-Exception-Handling-and-Error-Management.md](en/13-Exception-Handling-and-Error-Management.md) |
| Testing Specification | [en/16-Testing-Specification-and-Guidelines.md](en/16-Testing-Specification-and-Guidelines.md) |
| C# Coding Conventions | [en/18-CSharp-Coding-Conventions.md](en/18-CSharp-Coding-Conventions.md) |
| Git Commit Convention | [git-workflow/commit-message-conventions.md](../git-workflow/commit-message-conventions.md) |
| Code Review | [en/20-Code-Review-Checklist.md](en/20-Code-Review-Checklist.md) |

---

> **Document Version**: v1.0
> **Last Updated**: 2025-01
