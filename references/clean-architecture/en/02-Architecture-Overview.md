# Architecture Overview

> This document explains the PaymentService project's architecture migration background, legacy architecture problem analysis, and the design philosophy and implementation approach of the new architecture (Clean Architecture).

---

## Project Architecture Migration Status

### Migration Background

The PaymentService project is migrating from a traditional three-tier architecture (Controller → BLL → DAL) to Clean Architecture. This refactoring uses the `GetDepositOptionsAsync` API as a benchmark case, establishing architecture specifications for the team to follow.

### Migration Scope

| Phase | Status | Description |
|-------|--------|-------------|
| Deposit-related APIs | ✅ Completed | `GetDepositOptionsAsync` fully refactored |
| Customer-related queries | ✅ Completed | `CustomerRepository`, `CustomerContext` |
| Withdrawal-related APIs | 🔄 In Progress | Following the Deposit pattern |
| Other legacy APIs | ⏳ Planned | Maintaining current state, gradual migration |

### Legacy and New Architecture Coexistence Strategy

```
PaymentService/
├── Service.BLL/          ← Legacy architecture BLL (maintain as-is)
├── Service.DAL/          ← Legacy architecture DAL (maintain as-is)
├── Models/Domain/        ← New architecture Domain Layer
├── Services/             ← New architecture Application Layer
└── Repositories/         ← New architecture Infrastructure Layer
```

---

## Legacy Architecture Problem Analysis

### Problem 1: Controller Overloaded with Responsibilities

**Symptom**: Controller contains business logic, data transformation, error handling, and multiple other responsibilities.

```csharp
// ❌ Legacy architecture: Controller doing too much
public class DepositController
{
    public async Task<IActionResult> GetDepositOptions(int custId)
    {
        // 1. Query customer data
        var cust = await _custService.GetCust(custId);

        // 2. Business logic judgment (should not be in Controller)
        if (cust.VipLevel < 3 && cust.PointLevel < 100)
        {
            return BadRequest("Qualification not met");
        }

        // 3. Query deposit channels
        var channels = await _depositService.GetChannels();

        // 4. Complex filtering logic (should not be in Controller)
        var filtered = channels.Where(c =>
            c.VipLevels.Contains(cust.VipLevel) &&
            !c.ExcludeTags.Intersect(cust.Tags).Any() &&
            c.MinAmount <= limit.MaxAmount
        ).ToList();

        return Ok(filtered);
    }
}
```

**Problems**:
- Controller exceeds 200 lines
- Difficult to write unit tests
- Business logic scattered everywhere, hard to maintain

### Problem 2: Confused Data Models

**Symptom**: A single class serves as database mapping, business logic carrier, and API response format simultaneously.

```csharp
// ❌ Legacy architecture: One class for multiple purposes
public class PayChannel
{
    // Database fields
    public int SysId { get; set; }
    public string VipLevel { get; set; } // JSON string

    // Business logic methods
    public bool IsAvailable(Customer cust) { ... }

    // API serialization attributes
    [JsonIgnore]
    public string InternalField { get; set; }
}
```

**Problems**:
- Database changes affect API responses
- Business logic testing requires mocking database
- Hard to understand the class's true responsibility

### Problem 3: Lack of Dependency Inversion

**Symptom**: High-level modules directly depend on low-level implementations.

```csharp
// ❌ Legacy architecture: Direct dependency on implementation
public class PayBLL
{
    private readonly PayService _payService; // Direct dependency on concrete class

    public PayBLL(PayService payService)
    {
        _payService = payService;
    }
}
```

**Problems**:
- Cannot replace implementation (e.g., for mocking)
- Unit testing is difficult
- High coupling, changes in one place affect many others

### Problem 4: Scattered Cross-Cutting Concerns

**Symptom**: Caching, logging, exception handling logic scattered across layers.

```csharp
// ❌ Legacy architecture: Caching logic mixed into business code
public class PayService
{
    public async Task<List<Channel>> GetChannels(int siteId)
    {
        var cacheKey = $"Channels:{siteId}";
        var cached = await _redis.GetAsync<List<Channel>>(cacheKey);
        if (cached != null) return cached;

        var data = await _db.Query("...");
        await _redis.SetAsync(cacheKey, data, TimeSpan.FromMinutes(5));
        return data;
    }
}
```

**Problems**:
- Every method needs to handle caching
- Inconsistent caching strategies
- Difficult to globally adjust caching behavior

---

## New Architecture Design (Clean Architecture)

### Concentric Circle Architecture Concept

```
        ┌─────────────────────────────────────┐
        │         Infrastructure              │
        │  ┌─────────────────────────────┐    │
        │  │       Application           │    │
        │  │  ┌─────────────────────┐    │    │
        │  │  │      Domain         │    │    │
        │  │  │  (Core Business Logic)    │    │
        │  │  └─────────────────────┘    │    │
        │  │   Services, Use Cases       │    │
        │  └─────────────────────────────┘    │
        │   Repositories, External APIs       │
        └─────────────────────────────────────┘
                        ↑
              Dependency Direction: Outside to Inside
```

### Layer Mapping to Project Structure

| Layer | Project Path | Responsibility |
|-------|--------------|----------------|
| **Domain** | `Models/Domain/` | Core business logic, entities, value objects |
| **Application** | `Services/` | Use Cases, interface definitions, coordination logic |
| **Infrastructure** | `Repositories/` | Data access, external service integration |
| **Presentation** | `Controllers/` | HTTP request handling, response formatting |

### Dependency Direction

```
Controller → IDepositQueryService → ICustomerRepository
                                 → IDepositRepository
                                         ↓
                               CustomerRepository (Implementation)
                               DepositRepository (Implementation)
```

**Key Points**:
- Controller depends on Application Layer interfaces
- Application Layer defines Repository interfaces
- Infrastructure Layer implements these interfaces
- **Dependency direction is from outside to inside, inner layers don't know outer layers exist**

---

## New Architecture Implementation Examples

### Domain Layer

```csharp
// Models/Domain/DepositChannel.cs
public class DepositChannel
{
    public CurrencyEnum Currency { get; init; }
    public DepositTypeEnum DepositType { get; init; }
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

    // Immutability: Return new instance
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

### Application Layer

```csharp
// Services/ICustomerRepository.cs (Interface Definition)
public interface ICustomerRepository
{
    Task<Customer> GetCustInfoAsync(int custId);
    Task<CustomerContext> GetCustContextAsync(int custId);
}

// Services/DepositQueryService.cs (Use Case Implementation)
public class DepositQueryService : IDepositQueryService
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IDepositRepository _depositRepository;

    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        // Coordinate multiple Repositories
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(custContext.Customer.SiteId);

        // Delegate business logic to Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}
```

### Infrastructure Layer

```csharp
// Repositories/CustomerRepository.cs
public class CustomerRepository : ICustomerRepository
{
    private readonly MySqlClient _mainDbClient;

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
            "Customer_Get", new { CustId = custId });

        // Convert via CreateDomain()
        return dbCust?.CreateDomain();
    }
}

// Repositories/CustomerRepositoryDecorator.cs (Caching Layer)
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _customerRepository;
    private readonly ICacheHelper _cacheHelper;

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

### DI Registration (Decorator Pattern)

```csharp
// Startup.cs
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

services.AddScoped<IDepositRepository, DepositRepository>();
services.Decorate<IDepositRepository, DepositRepositoryDecorator>();
```

---

## Cross-Cutting Concerns Design

### Middleware (Entry Point Handling)

Handles all HTTP requests entering the system:

```
HTTP Request → [GlobalExceptionMiddleware] → [RequestLogMiddleware] → Controller
                        ↓
               Unified exception handling, logging
```

### DelegatingHandler (Exit Point Handling)

Handles all external HTTP calls:

```
HttpClient → [LoggingHandler] → [RetryHandler] → [TimeoutHandler] → External API
                  ↓
        Request logging, retry mechanism, timeout control
```

---

## Legacy vs New Architecture Comparison Summary

| Aspect | Legacy Architecture | New Architecture |
|--------|---------------------|------------------|
| **Business Logic Location** | Scattered in Controller, BLL | Centralized in Domain Model |
| **Data Models** | Single class for multiple purposes | Domain/DbModel/DTO separation |
| **Dependency Direction** | High-level depends on low-level implementation | Dependency inversion, depends on interfaces |
| **Cache Handling** | Mixed into business code | Separated via Decorator pattern |
| **Testing Difficulty** | High (requires mocking database) | Low (can mock interfaces) |
| **Maintainability** | Changes in one place affect many | Each layer is independent, minimal impact |

---

## Migration Strategy

### Gradual Migration Principles

1. **New Features**: Use new architecture directly
2. **Bug Fixes**: Evaluate whether to refactor along the way
3. **Major Changes**: Plan complete refactoring

### Migration Checklist

- [ ] Identify existing code's Domain Models
- [ ] Separate DbModel from Domain Model
- [ ] Define Repository interfaces in Application Layer
- [ ] Implement Repository in Infrastructure Layer
- [ ] Use Decorator pattern for caching
- [ ] Write unit tests to verify business logic
- [ ] Update DI registration

---

## Review Checklist

### Architecture Migration Review

- [ ] Does new code follow Clean Architecture layering?
- [ ] Does Domain Model contain business logic methods?
- [ ] Is Repository interface defined in `Services/` namespace?
- [ ] Does Repository implementation return Domain Model (not DbModel)?
- [ ] Is caching implemented through Decorator pattern?
- [ ] Are there unit tests covering core business logic?

### Dependency Direction Review

- [ ] Does Domain Layer have any external dependencies?
- [ ] Does Application Layer only depend on Domain Layer?
- [ ] Does Infrastructure Layer only implement interfaces defined by Application Layer?

---

## Common Pitfalls for New Developers

### 1. Placing New Code in Wrong Location

```csharp
// ❌ Wrong: Adding Clean Architecture code in legacy architecture directory
Service.DAL/NewCustomerRepository.cs  // Incorrect!

// ✅ Correct: Use new architecture directory
Repositories/CustomerRepository.cs
```

### 2. Mixing Legacy and New Architecture

```csharp
// ❌ Wrong: New architecture Service directly depends on legacy architecture DAL
public class DepositQueryService
{
    private readonly PayService _payService; // Legacy architecture
}

// ✅ Correct: Abstract through interface
public class DepositQueryService
{
    private readonly IDepositRepository _depositRepository; // New architecture interface
}
```

### 3. Ignoring CreateDomain Conversion

```csharp
// ❌ Wrong: Directly returning DbModel
public async Task<DbModel.Customer> GetCustInfoAsync(int custId)
{
    return await _db.QueryFirstAsync<DbModel.Customer>(...);
}

// ✅ Correct: Convert to Domain Model
public async Task<Customer> GetCustInfoAsync(int custId)
{
    var dbModel = await _db.QueryFirstAsync<DbModel.Customer>(...);
    return dbModel?.CreateDomain();
}
```

---

## TL / Reviewer Checkpoint

### Architecture Consistency

| Checkpoint | Pass Condition |
|------------|----------------|
| Correct layering | New code is in correct directory structure |
| Interface location | Repository interface in `Services/`, implementation in `Repositories/` |
| Dependency direction | Inner layer doesn't depend on outer layer |

### Technical Debt Management

- [ ] Does it introduce new technical debt?
- [ ] Is there an opportunity to refactor related legacy code?
- [ ] Is the boundary between legacy and new architecture clear?

### Team Consistency

- [ ] Does it follow patterns already established by the team?
- [ ] Does naming follow existing conventions?
- [ ] Does knowledge base documentation need updating?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
