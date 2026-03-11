# Clean Architecture Core Principles

> This document explains the core principles of Clean Architecture followed by the PaymentService project, demonstrating how to implement these principles through actual code examples.

---

## Overview of Seven Core Principles

| Principle | Description | Project Practice |
|-----------|-------------|------------------|
| **Dependency Inversion Principle (DIP)** | High-level modules should not depend on low-level modules; both should depend on abstractions | Repository interfaces defined in Application Layer |
| **Separation of Concerns (SoC)** | Different concerns should be separated into different modules | Domain/Application/Infrastructure layering |
| **Open-Closed Principle (OCP)** | Open for extension, closed for modification | Decorator pattern for cache extension |
| **Single Responsibility Principle (SRP)** | A class should have only one reason to change | Domain Model only handles business logic |
| **Domain-Driven Design (DDD)** | Design software centered around the business domain | Rich Domain Model encapsulates business rules |
| **Interface Segregation Principle (ISP)** | Clients should not be forced to depend on interfaces they don't use | Small, focused Repository interfaces |
| **YAGNI (You Aren't Gonna Need It)** | Don't implement functionality until it's actually needed | Only build methods with clear current use cases |

---

## Principle 1: Dependency Inversion Principle (DIP)

### Principle Definition

> High-level modules should not depend on low-level modules. Both should depend on abstractions.
> Abstractions should not depend on details. Details should depend on abstractions.

### Project Practice

**Interface defined in Application Layer (high-level)**:

```csharp
// Services/ICustomerRepository.cs - Application Layer defines interface
namespace PaymentService.Services
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}
```

**Implementation in Infrastructure Layer (low-level)**:

```csharp
// Repositories/CustomerRepository.cs - Infrastructure Layer implementation
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

**Service depends on interface, not implementation**:

```csharp
// Services/DepositQueryService.cs
public class DepositQueryService : IDepositQueryService
{
    // Depends on interfaces
    private readonly ICustomerRepository _customerRepository;
    private readonly IDepositRepository _depositRepository;

    public DepositQueryService(
        ICustomerRepository customerRepository,  // Inject interface
        IDepositRepository depositRepository)
    {
        _customerRepository = customerRepository;
        _depositRepository = depositRepository;
    }
}
```

### Anti-Pattern Examples

```csharp
// Wrong: Direct dependency on concrete implementation
public class DepositQueryService
{
    private readonly CustomerRepository _customerRepository;  // Direct dependency on implementation class

    public DepositQueryService(CustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }
}

// Wrong: Interface defined in Infrastructure Layer
namespace PaymentService.Repositories  // Wrong namespace
{
    public interface ICustomerRepository { }
}
```

### Benefits of DIP

| Benefit | Description |
|---------|-------------|
| **Testability** | Can use mocks to replace implementations for unit testing |
| **Replaceability** | Can easily replace Repository implementation (e.g., change database) |
| **Decoupling** | Application Layer doesn't know Infrastructure details |

---

## Principle 2: Separation of Concerns (SoC)

### Principle Definition

> Separate code by different concerns into different modules, each module handling only a single concern.

### Project Practice

**Concerns by Layer**:

| Layer | Concern | Example |
|-------|---------|---------|
| Domain | Business logic | `DepositChannel.IsSupported()` |
| Application | Use case coordination | `DepositQueryService.GetDepositChannelsByDepositTypeAsync()` |
| Infrastructure | Technical details | `CustomerRepository` database access |
| Presentation | HTTP handling | `CustomerController` request response |

**Cross-Cutting Concerns Separation**:

```csharp
// Caching concern - separated via Decorator
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

// Exception handling concern - separated via Middleware
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

### Anti-Pattern Examples

```csharp
// Wrong: Repository mixed with multiple concerns
public class CustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        // Caching concern mixed in
        var cached = await _redis.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;

        // Data access concern
        var data = await _db.Query(...);

        // Logging concern mixed in
        _logger.LogInformation("Retrieved customer {CustId}", custId);

        // Caching concern mixed in
        await _redis.SetAsync($"Cust:{custId}", data);

        return data;
    }
}
```

---

## Principle 3: Open-Closed Principle (OCP)

### Principle Definition

> Software entities (classes, modules, functions) should be open for extension, but closed for modification.

### Project Practice: Decorator Pattern

Through the Decorator pattern, you can extend caching functionality without modifying the original Repository:

```csharp
// Original Repository (no modification needed)
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _mainDbClient.QueryFirstAsync<Customer>(...);
    }
}

// Extension: Add caching functionality (without modifying original code)
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            () => _inner.GetCustInfoAsync(custId)  // Delegate to original implementation
        );
    }
}
```

**DI Registration for Extension**:

```csharp
// Startup.cs
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();  // Extension
```

### Anti-Pattern Examples

```csharp
// Wrong: Modifying original class to add caching
public class CustomerRepository : ICustomerRepository
{
    private readonly ICacheHelper _cache;  // Added dependency

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        // Modified original logic
        var cached = await _cache.GetAsync(...);
        if (cached != null) return cached;

        var data = await _db.Query(...);
        await _cache.SetAsync(...);
        return data;
    }
}
```

---

## Principle 4: Single Responsibility Principle (SRP)

### Principle Definition

> A class should have only one reason to change.

### Project Practice

**Domain Model Single Responsibility: Encapsulate Business Logic**

```csharp
// DepositChannel.cs - Only responsible for deposit channel business rules
public class DepositChannel
{
    // Business rule: Determine if customer is eligible for this channel
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsReachedPointLevel(PointLevel)
               && custContext.IsVipLevelInScope(VipLevels)
               && !custContext.IsTagInScope(ExcludeTags);
    }

    // Business rule: Calculate amount intersection
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

**Repository Single Responsibility: Data Access**

```csharp
// CustomerRepository.cs - Only responsible for customer data access
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

**Service Single Responsibility: Coordinate Multiple Repositories**

```csharp
// DepositQueryService.cs - Only responsible for coordination, not business logic
public class DepositQueryService : IDepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

        // Business logic delegated to Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}
```

### Responsibility Assignment Table

| Class | Responsibility | Should Not Contain |
|-------|----------------|-------------------|
| Domain Model | Business logic, validation rules | Data access, HTTP handling, caching |
| Repository | Data access, model conversion | Business logic, caching, logging |
| Decorator | Cross-cutting concerns (caching, logging) | Business logic, complex queries |
| Service | Coordinate multiple Repositories | Business logic, data access |
| Controller | HTTP request handling | Business logic, data access |

---

## Principle 5: Domain-Driven Design (DDD)

### Rich Model vs Anemic Model

| Type | Characteristics | Project Choice |
|------|-----------------|----------------|
| **Rich Model** | Data + behavior encapsulated together | Adopted |
| **Anemic Model** | Only data, logic in external Service | Avoided |

### Rich Model Implementation Example

```csharp
// Rich Model: Business logic encapsulated in Domain Model
public class DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public List<int> VipLevels { get; init; }
    public decimal MinAmount { get; init; }
    public decimal MaxAmount { get; init; }

    // Business logic methods
    public bool IsSupported(CustomerContext custContext)
    {
        return custContext.IsCurrencyOf(Currency)
               && custContext.IsVipLevelInScope(VipLevels);
    }

    // Immutability: Return new instance
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        return new DepositChannel(...);
    }
}
```

### Anemic Model Anti-Pattern

```csharp
// Anemic Model: Domain Model only has data
public class DepositChannel
{
    public CurrencyEnum Currency { get; set; }
    public List<int> VipLevels { get; set; }
    // No business methods
}

// Business logic externalized to Service
public class DepositService
{
    public bool IsChannelSupported(DepositChannel channel, CustomerContext context)
    {
        // Logic should be inside Domain Model
        return context.Currency == channel.Currency
               && channel.VipLevels.Contains(context.VipLevel);
    }
}
```

### Domain Language Naming

Use business domain language for naming, not technical terminology:

| Technical Naming | Domain Naming |
|------------------|---------------|
| `CheckVipLevel()` | `IsVipLevelInScope()` |
| `FilterByCondition()` | `IsSupported()` |
| `UpdateAmount()` | `WithAmountLimit()` |
| `GetData()` | `GetCustContextAsync()` |

---

## Principle 6: Interface Segregation Principle (ISP)

### Principle Definition

> Clients should not be forced to depend on interfaces they don't use.

### Project Practice

**Small, Focused Interfaces**:

```csharp
// Focused Repository interfaces
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

### Anti-Pattern Examples

```csharp
// Wrong: Fat interface
public interface IPaymentRepository
{
    // Customer related
    Task<Customer> GetCustInfoAsync(int custId);
    Task<int> GetPointLevelAsync(int custId);

    // Deposit related
    Task<List<DepositChannel>> GetDepositChannels(int siteId);
    Task<List<DepositLimit>> GetDepositLimits(int siteId);

    // Withdrawal related
    Task<List<WithdrawalChannel>> GetWithdrawalChannels(int siteId);

    // Other
    Task<Config> GetConfig(string key);
}

// When used, client is forced to depend on methods it doesn't need
public class DepositQueryService
{
    private readonly IPaymentRepository _repo;  // Depends on entire fat interface
}
```

---

## Principle 7: YAGNI (You Aren't Gonna Need It)

### Principle Definition

> Don't implement functionality until you actually need it. Avoid building features based on speculation about future requirements.

### Why YAGNI Matters

| Problem | Impact |
|---------|--------|
| **Wasted effort** | Time spent building unused features |
| **Increased complexity** | More code to maintain and test |
| **Wrong abstractions** | Premature design may not fit actual needs |
| **Technical debt** | Unused code becomes maintenance burden |

### Project Practice

**Only implement methods with clear current use cases**:

```csharp
// ✅ Good: Only methods that are actually needed
public sealed class ClaimHistory
{
    public bool HasAnyClaim => _records.Count > 0;
    public int Count => _records.Count;

    // These methods have clear business use cases
    public bool HasClaimedBonus(string bonusCode)
        => _records.Any(r => r.BonusCode == bonusCode);

    public bool HasClaimedBonus(int bonusId)
        => _records.Any(r => r.BonusId == bonusId);

    public bool HasClaimedAny(params PromotionTypeEnum[] promotionTypes)
        => _records.Any(r => promotionTypes.Contains(r.PromotionType));
}
```

### Anti-Pattern Examples

```csharp
// ❌ Wrong: Methods built "just in case" without current use cases
public sealed class ClaimHistory
{
    // These methods were built speculatively, not based on actual requirements
    public IEnumerable<ClaimRecord> GetRecords() => _records;  // Exposes internal data
    public MarketDateTime? GetLastClaimDate(string bonusCode) => ...;  // No current use case
    public IEnumerable<ClaimRecord> GetByPromotionTypes(...) => ...;  // No current use case
    public IEnumerable<ClaimRecord> GetByCategoryId(int categoryId) => ...;  // No current use case
}
```

### YAGNI Decision Checklist

Before adding a new method or feature, ask:

| Question | If No, Then... |
|----------|----------------|
| Is there a **current** use case for this? | Don't build it |
| Will this be used in the **current sprint/iteration**? | Defer it |
| Is the requirement **concrete** or speculative? | Wait for concrete requirements |
| Does removing this break **existing functionality**? | Safe to remove |

### When to Apply YAGNI

| Scenario | Apply YAGNI? | Reason |
|----------|--------------|--------|
| Building Domain Model methods | ✅ Yes | Only add methods with clear business use |
| Adding Repository query methods | ✅ Yes | Only add queries that are actually called |
| Designing API endpoints | ✅ Yes | Only expose needed endpoints |
| Creating test helpers | ⚠️ Careful | Test helpers may encourage testing implementation details |

### Benefits of YAGNI

| Benefit | Description |
|---------|-------------|
| **Simpler codebase** | Less code to read, understand, and maintain |
| **Faster development** | Focus on what's needed now |
| **Better abstractions** | Design based on real requirements, not speculation |
| **Easier refactoring** | Less code means easier changes |

### Relationship with Other Principles

| Principle | Relationship with YAGNI |
|-----------|------------------------|
| **SRP** | YAGNI helps avoid adding unnecessary responsibilities |
| **ISP** | YAGNI prevents bloated interfaces |
| **OCP** | Build extension points when needed, not in advance |

---

## Principle Application Summary

### Design Decision Checklist

| Question | Corresponding Principle | Correct Approach |
|----------|------------------------|------------------|
| Where to define interfaces? | DIP | Application Layer (Services/) |
| Where to put caching logic? | SoC, OCP | Decorator |
| When adding new features? | OCP | Extend rather than modify |
| What does this class do? | SRP | Only one thing |
| Where to put business logic? | DDD | Domain Model |
| Is the interface too large? | ISP | Split into smaller interfaces |
| Is this feature needed now? | YAGNI | Only build what's currently needed |

---

## Review Checklist

### Principle Compliance Check

- [ ] Is Repository interface defined in `Services/` namespace? (DIP)
- [ ] Are cross-cutting concerns separated via Decorator/Middleware? (SoC)
- [ ] Are new features implemented through extension rather than modification? (OCP)
- [ ] Does each class have a single responsibility? (SRP)
- [ ] Does Domain Model contain business logic methods? (DDD)
- [ ] Are interfaces small and focused? (ISP)
- [ ] Is every method/feature actually needed right now? (YAGNI)

### Code Quality Check

- [ ] Does Service only coordinate, without containing business logic?
- [ ] Does Domain Model use `init` setter to maintain immutability?
- [ ] Do method names use domain language?

---

## Common Pitfalls for New Developers

### 1. Interface Defined in Wrong Location

```csharp
// Wrong: Interface defined in Repositories namespace
namespace PaymentService.Repositories
{
    public interface ICustomerRepository { }
}

// Correct: Interface defined in Services namespace
namespace PaymentService.Services
{
    public interface ICustomerRepository { }
}
```

### 2. Service Contains Too Much Business Logic

```csharp
// Wrong: Business logic in Service
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        // This logic should be in Domain Model
        return channels.Where(c =>
            c.VipLevels.Contains(custContext.VipLevel) &&
            c.Currency == custContext.Currency
        ).ToList();
    }
}

// Correct: Delegate to Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        return channels.GroupByDepositType(custContext);  // Delegate to Domain Model
    }
}
```

### 3. Modifying Original Code to Add Features

```csharp
// Wrong: Modifying original Repository to add caching
public class CustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.Get(...);  // Modifying original code
        // ...
    }
}

// Correct: Use Decorator to extend
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

---

## TL / Reviewer Checkpoint

### Architecture Principle Review

| Principle | Checkpoint | Warning Signal |
|-----------|------------|----------------|
| DIP | Interface location | `using PaymentService.Repositories` appears in Application Layer |
| SoC | Concern mixing | Repository has `_cache` or `_logger` |
| OCP | Modifying original code | Modifying existing class core logic to add features |
| SRP | Class too large | Class exceeds 200 lines or has more than 5 dependencies |
| DDD | Anemic model | Domain Model only has getter/setter |
| ISP | Fat interface | Interface has more than 7 methods |
| YAGNI | Speculative features | Methods/classes built "just in case" with no current caller |

### Code Review Questions

- [ ] "Why isn't this logic in Domain Model?"
- [ ] "Why modify the original class? Can we use Decorator?"
- [ ] "Is this interface too large? Should it be split?"
- [ ] "Is this Service doing too much?"
- [ ] "Is this method actually being used? What's the current use case?"

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
