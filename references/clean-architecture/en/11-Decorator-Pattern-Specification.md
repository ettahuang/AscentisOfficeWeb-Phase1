# Decorator Pattern Specification

> This document explains the design principles and implementation specifications for the Decorator pattern in the PaymentService project, primarily used for separating cross-cutting concerns such as caching and logging.

---

## Decorator Pattern Overview

### Design Purpose

The Decorator pattern allows dynamically adding new functionality to an object **without modifying the original class**. In the PaymentService project, it's primarily used for:

- **Caching**: Add Redis caching to Repositories
- **Logging**: Record method calls and results
- **Monitoring**: Add performance metric collection

### Architecture Diagram

```
+--------------------------------------------------+
|  Service                                          |
|      | calls ICustomerRepository                  |
+--------------------------------------------------+
|  CustomerRepositoryDecorator (Cache Layer)        |
|      | calls on Cache Miss                        |
+--------------------------------------------------+
|  CustomerRepository (Data Access Layer)           |
|      |                                            |
+--------------------------------------------------+
|  Database                                         |
+--------------------------------------------------+
```

### Comparison with Inheritance

| Aspect | Inheritance | Decorator (Composition) |
|--------|-------------|-------------------------|
| Coupling | High (compile-time binding) | Low (runtime composition) |
| Flexibility | Low (static structure) | High (dynamic composition) |
| Testing | Difficult | Easy (can test separately) |
| Extension | Requires modifying subclass | Just add new Decorator |

---

## Decorator Design Principles

### Principle 1: Only One Layer of Decorator

Avoid multiple layers of nested Decorators, keep architecture simple:

```csharp
// Correct: Only one layer of Decorator
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

```csharp
// Avoid: Multiple layers of Decorator nesting
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CacheDecorator>();      // First layer
services.Decorate<ICustomerRepository, LoggingDecorator>();    // Second layer
services.Decorate<ICustomerRepository, MetricsDecorator>();    // Third layer
// Too complex, hard to maintain
```

### Principle 2: Only Handle Cross-Cutting Concerns

Decorator only handles cross-cutting concerns, no business logic:

```csharp
// Correct: Only handle caching (cross-cutting concern)
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
// Wrong: Decorator contains business logic
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var customer = await _customerRepository.GetCustInfoAsync(custId);

        // Business logic should not be in Decorator
        if (customer.VipLevel < 3)
        {
            customer.Discount = 0;
        }

        return customer;
    }
}
```

### Principle 3: Transparent Delegation

Decorator's interface must be exactly the same as the decorated class:

```csharp
// Interface definition
public interface ICustomerRepository
{
    Task<Customer> GetCustInfoAsync(int custId);
    Task<int> GetPointLevelAsync(int custId);
    Task<CustomerContext> GetCustContextAsync(int custId);
}

// Decorator implements all methods
public class CustomerRepositoryDecorator : ICustomerRepository
{
    private readonly ICustomerRepository _inner;
    private readonly ICacheHelper _cacheHelper;

    // Implement all interface methods
    public async Task<Customer> GetCustInfoAsync(int custId) { ... }
    public async Task<int> GetPointLevelAsync(int custId) { ... }
    public async Task<CustomerContext> GetCustContextAsync(int custId) { ... }
}
```

---

## Cache Decorator Implementation

### Complete Example: CustomerRepositoryDecorator

```csharp
namespace PaymentService.Repositories
{
    /// <summary>
    /// CustomerRepository cache Decorator
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
        /// Cache Key: "CustInfo:{custId}", TTL: 1 minute
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
        /// Cache Key: "PointLevel:{custId}", TTL: 1 minute
        /// Uses RedisDataBase.Shared
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
        /// Cache Key: "CustomerContext:{custId}", TTL: 1 minute
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

### Complete Example: DepositRepositoryDecorator

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
        /// Cache Key: "DepositLimitInfos:{siteId}", TTL: 1 minute
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
        /// Cache Key: "DepositChannels:{siteId}", TTL: 30 seconds
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

## Cache Key Design Specification

### Naming Rules

| Pattern | Example | Use Case |
|---------|---------|----------|
| `{Entity}:{Id}` | `CustInfo:12345` | Single entity |
| `{Entity}s:{ScopeId}` | `DepositChannels:1` | Collection data |
| `{Entity}:{Key1}:{Key2}` | `Limit:CNY:3` | Composite condition |

### Naming Examples

```csharp
// Customer related
$"CustInfo:{custId}"           // Customer information
$"PointLevel:{custId}"         // Point level
$"CustomerContext:{custId}"    // Customer context

// Deposit related
$"DepositChannels:{siteId}"    // Deposit channel list
$"DepositLimitInfos:{siteId}"  // Deposit limit list

// Composite condition
$"DepositLimit:{siteId}:{currency}:{vipLevel}"
```

### Naming to Avoid

```csharp
// Avoid: Too short or unclear
$"c:{custId}"          // Don't know what it is
$"data:{id}"           // Too generic

// Avoid: Contains special characters
$"cust:info:{custId}"  // Multiple colons may cause parsing issues

// Avoid: Using object's ToString()
$"Customer:{customer}" // Might serialize entire object
```

---

## TTL Design Specification

### TTL Setting Guidelines

| Data Type | Recommended TTL | Description |
|-----------|-----------------|-------------|
| High real-time | 10-30 seconds | Deposit channel status, balance |
| Medium frequency | 1-5 minutes | Customer information, VIP level |
| Low frequency change | 10-30 minutes | System settings, static data |
| Rarely changes | 1-24 hours | Currency settings, fixed lists |

### Project Examples

```csharp
// Customer information: 1 minute (medium frequency change)
TimeSpan.FromMinutes(1)

// Deposit channels: 30 seconds (may have real-time status changes)
TimeSpan.FromSeconds(30)

// Deposit limits: 1 minute
TimeSpan.FromMinutes(1)

// Site configuration: 10 minutes (low frequency change)
TimeSpan.FromMinutes(10)
```

---

## DI Registration Method

### Using Scrutor's Decorate Method

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 1. Register original Repository first
    services.AddScoped<ICustomerRepository, CustomerRepository>();

    // 2. Use Decorate to wrap with Decorator
    services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

    // DepositRepository likewise
    services.AddScoped<IDepositRepository, DepositRepository>();
    services.Decorate<IDepositRepository, DepositRepositoryDecorator>();

    // Service registration (depends on Repository interfaces)
    services.AddScoped<IDepositQueryService, DepositQueryService>();
}
```

### Registration Order Explanation

```
1. AddScoped<ICustomerRepository, CustomerRepository>()
   -> In container: ICustomerRepository = CustomerRepository

2. Decorate<ICustomerRepository, CustomerRepositoryDecorator>()
   -> In container: ICustomerRepository = CustomerRepositoryDecorator
   -> CustomerRepositoryDecorator internally holds original CustomerRepository
```

### Runtime Dependency Relationship

```
DepositQueryService
    | inject ICustomerRepository
CustomerRepositoryDecorator
    | internally holds ICustomerRepository
CustomerRepository
    |
Database
```

---

## Decorator Testing

### Unit Testing Decorator

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
                factory());  // Simulate Cache Miss, call factory

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

## Review Checklist

### Decorator Design Check

- [ ] Is there only one layer of Decorator?
- [ ] Does Decorator only handle cross-cutting concerns (caching, logging)?
- [ ] Does Decorator implement complete interface?
- [ ] Uses `services.Decorate()` for registration?

### Cache Key Check

- [ ] Does Cache Key naming follow `{Entity}:{Id}` pattern?
- [ ] Is Cache Key unique, no collisions?
- [ ] Avoids special characters?

### TTL Check

- [ ] Is TTL setting appropriate for data change frequency?
- [ ] Do high-frequency change data use shorter TTL?
- [ ] Is there documentation recording each Cache Key's TTL?

---

## Common Pitfalls for New Developers

### 1. Adding Business Logic in Decorator

```csharp
// Wrong: Decorator contains business logic
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var customer = await _cacheHelper.TryGetOrCreateAsync(...);

        // Business logic should not be here
        if (customer.VipLevel >= 5)
        {
            customer.IsVip = true;
        }

        return customer;
    }
}

// Correct: Decorator only handles caching
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

### 2. Forgetting to Implement All Interface Methods

```csharp
// Wrong: Only implement some methods
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cacheHelper.TryGetOrCreateAsync(...);
    }

    // Missing GetPointLevelAsync
    // Missing GetCustContextAsync
}

// Correct: Implement all methods
public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId) { ... }
    public async Task<int> GetPointLevelAsync(int custId) { ... }
    public async Task<CustomerContext> GetCustContextAsync(int custId) { ... }
}
```

### 3. Cache Key Inconsistency or Collision

```csharp
// Wrong: Different methods use same Cache Key pattern
public async Task<Customer> GetCustInfoAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"Cust:{custId}", ...);
}

public async Task<CustomerContext> GetCustContextAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"Cust:{custId}", ...);  // Collision!
}

// Correct: Use different Cache Keys
public async Task<Customer> GetCustInfoAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"CustInfo:{custId}", ...);
}

public async Task<CustomerContext> GetCustContextAsync(int custId)
{
    return await _cacheHelper.TryGetOrCreateAsync($"CustomerContext:{custId}", ...);
}
```

### 4. Using AddScoped Instead of Decorate

```csharp
// Wrong: Using AddScoped to override
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.AddScoped<ICustomerRepository, CustomerRepositoryDecorator>();  // Override, not wrap

// Correct: Use Decorate
services.AddScoped<ICustomerRepository, CustomerRepository>();
services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();
```

---

## TL / Reviewer Checkpoint

### Architecture Review

| Check Item | Warning Signal |
|------------|----------------|
| Multiple layer Decorator | More than one Decorate call |
| Business logic mixed in | Decorator has if-else business logic |
| Incomplete interface | Decorator doesn't implement all interface methods |

### Cache Review

- [ ] Is there potential Cache Key collision risk?
- [ ] Is TTL setting reasonable?
- [ ] Is there cache invalidation strategy (e.g., clear on data update)?

### Performance Review

- [ ] Is there unnecessary caching (e.g., already fast queries)?
- [ ] Is cached data too large?
- [ ] Is cache penetration considered?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
