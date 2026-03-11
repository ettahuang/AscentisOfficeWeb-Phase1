# Layer Responsibilities

> This document provides detailed definitions of each layer's responsibilities in Clean Architecture, with actual code examples from the PaymentService project illustrating the correct implementation approach for each layer.

---

## Architecture Layer Overview

```
+-------------------------------------------------------------+
|  Presentation Layer (Controllers/)                          |
|  Responsibility: HTTP request handling, response formatting |
+-------------------------------------------------------------+
|  Application Layer (Services/)                              |
|  Responsibility: Use case coordination, interface           |
|                  definition, business flow orchestration    |
+-------------------------------------------------------------+
|  Domain Layer (Models/Domain/)                              |
|  Responsibility: Core business logic, domain entities,      |
|                  business rules                             |
+-------------------------------------------------------------+
|  Infrastructure Layer (Repositories/)                       |
|  Responsibility: Data access, external service integration, |
|                  technical implementation details           |
+-------------------------------------------------------------+
```

---

## Domain Layer

### Responsibility Definition

| Responsibility | Description |
|----------------|-------------|
| **Business Logic** | Encapsulate core business rules and calculations |
| **Domain Entities** | Define data structures for business concepts |
| **Value Objects** | Define value types without identity |
| **Business Validation** | Validate business rule compliance |

### Project Location

```
PaymentService/Models/Domain/
+-- Customer.cs                    # Customer entity
+-- CustomerContext.cs             # Customer context (composite object)
+-- DepositChannel.cs              # Deposit channel entity
+-- DepositChannels.cs             # Deposit channel collection
+-- DepositChannelsByDepositType.cs # Results grouped by type
+-- DepositLimitInfo.cs            # Deposit limit information
+-- DepositLimitInfos.cs           # Deposit limit collection
+-- DepositUnLimitInfo.cs          # Unlimited deposit information
```

### Complete Example: DepositChannel

```csharp
namespace PaymentService.Models.Domain
{
    /// <summary>
    /// Deposit channel domain model, encapsulates channel business rules
    /// </summary>
    public class DepositChannel
    {
        // ==================== Property Definitions ====================
        // Use init setter to ensure immutability
        public CurrencyEnum Currency { get; init; }
        public DepositTypeEnum DepositType { get; init; }
        public List<int> VipLevels { get; init; }
        public List<int> ExcludeTags { get; init; }
        public int PointLevel { get; init; }
        public decimal MinAmount { get; init; }
        public decimal MaxAmount { get; init; }
        public int Sort { get; init; }

        // ==================== Business Logic Methods ====================

        /// <summary>
        /// Determine if customer is eligible for this deposit channel
        /// </summary>
        public bool IsSupported(CustomerContext custContext)
        {
            return custContext.IsCurrencyOf(Currency)
                   && custContext.IsReachedPointLevel(PointLevel)
                   && custContext.IsVipLevelInScope(VipLevels)
                   && !custContext.IsTagInScope(ExcludeTags);
        }

        /// <summary>
        /// Determine if amount range overlaps with limit
        /// </summary>
        public bool IsOverlappingWith(DepositLimitInfo depositLimitInfo)
        {
            if (depositLimitInfo == null)
                throw new ArgumentNullException(nameof(depositLimitInfo));

            if (!IsValidAmountRange() || !depositLimitInfo.IsValidAmountRange())
                return false;

            return MinAmount <= depositLimitInfo.MaxAmount
                   && MaxAmount >= depositLimitInfo.MinAmount;
        }

        /// <summary>
        /// Apply amount limit, return new instance (maintain immutability)
        /// </summary>
        public DepositChannel WithAmountLimit(DepositLimitInfo depositLimitInfo)
        {
            if (depositLimitInfo == null)
                throw new ArgumentNullException(nameof(depositLimitInfo));

            var newMin = Math.Max(MinAmount, depositLimitInfo.MinAmount);
            var newMax = Math.Min(MaxAmount, depositLimitInfo.MaxAmount);

            if (newMin > newMax)
                throw new InvalidOperationException(
                    "No overlapping range exists. Call IsOverlappingWith() before WithAmountLimit().");

            // Return new instance, do not modify existing instance
            return new DepositChannel(
                Currency, DepositType, ExcludeTags, VipLevels, PointLevel,
                newMin, newMax, Sort);
        }

        // ==================== Private Validation Methods ====================

        private bool IsValidAmountRange()
        {
            return MinAmount <= MaxAmount;
        }
    }
}
```

### Domain Layer Rules

| Rule | Description |
|------|-------------|
| **Immutability** | Use `init` setter, return new instance on modification |
| **No External Dependencies** | Do not depend on Repository, HttpClient, DbContext |
| **Business Language Naming** | Use terms like `IsSupported()`, `WithAmountLimit()` |
| **Self-Validation** | Validate business rules within methods |

### Domain Layer Prohibitions

```csharp
// Prohibited: Injecting external services
public class DepositChannel
{
    private readonly IDepositRepository _repo;  // Wrong!
    private readonly ILogger _logger;            // Wrong!
}

// Prohibited: Depending on DbModel
public class DepositChannel
{
    public DbModel.DepositChannel DbModel { get; set; }  // Wrong!
}

// Prohibited: Using mutable setter
public class DepositChannel
{
    public decimal MinAmount { get; set; }  // Should use init
}
```

---

## Application Layer

### Responsibility Definition

| Responsibility | Description |
|----------------|-------------|
| **Use Case Coordination** | Coordinate multiple Repositories to complete business flows |
| **Interface Definition** | Define Repository and Service interfaces |
| **Flow Orchestration** | Determine call order and data flow |
| **Delegate Business Logic** | Delegate business computation to Domain Model |

### Project Location

```
PaymentService/Services/
+-- ICustomerRepository.cs         # Repository interface
+-- IDepositRepository.cs          # Repository interface
+-- IDepositQueryService.cs        # Service interface
+-- DepositQueryService.cs         # Service implementation
```

### Complete Example: DepositQueryService

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// Deposit query service, coordinates Repositories to complete deposit channel query use case
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
        /// Get customer's available deposit channels (grouped by deposit type)
        /// </summary>
        public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
        {
            // 1. Coordinate: Get customer context
            var custContext = await _customerRepository.GetCustContextAsync(custId);

            // 2. Coordinate: Get deposit channels
            var siteId = custContext.Customer.SiteId;
            var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

            // 3. Delegate: Business logic to Domain Model
            return depositChannels.GroupByDepositType(custContext);
        }
    }
}
```

### Repository Interface Definition Example

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// Customer data access interface (defined in Application Layer)
    /// </summary>
    public interface ICustomerRepository
    {
        /// <summary>
        /// Get customer basic information
        /// </summary>
        Task<Customer> GetCustInfoAsync(int custId);

        /// <summary>
        /// Get customer point level
        /// </summary>
        Task<int> GetPointLevelAsync(int custId);

        /// <summary>
        /// Get complete customer context (including point level)
        /// </summary>
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}
```

### Application Layer Rules

| Rule | Description |
|------|-------------|
| **Only Coordinate** | Do not contain business logic computation |
| **Depend on Interfaces** | Depend on Repository interfaces, not implementations |
| **Delegate to Domain** | Delegate business computation to Domain Model |
| **Define Interfaces** | Repository interfaces defined in this layer |

### Application Layer Prohibitions

```csharp
// Prohibited: Containing business logic
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        // This logic should be in Domain Model!
        return channels.Where(c =>
            c.VipLevels.Contains(context.VipLevel) &&
            c.Currency == context.Currency &&
            c.MinAmount <= limit.MaxAmount
        ).ToList();
    }
}

// Prohibited: Direct database access
public class DepositQueryService
{
    private readonly DbContext _dbContext;  // Wrong!

    public async Task<Customer> GetCustomer(int id)
    {
        return await _dbContext.Customers.FindAsync(id);  // Wrong!
    }
}

// Prohibited: Handling cache
public class DepositQueryService
{
    private readonly ICacheHelper _cache;  // Wrong!
}
```

---

## Infrastructure Layer

### Responsibility Definition

| Responsibility | Description |
|----------------|-------------|
| **Data Access** | Implement Repository interfaces, execute database operations |
| **Model Conversion** | Convert DbModel to Domain Model |
| **External Service Integration** | Integrate third-party APIs, message queues, etc. |
| **Cross-Cutting Concerns** | Implement caching, logging via Decorator |

### Project Location

```
PaymentService/Repositories/
+-- CustomerRepository.cs          # Repository implementation
+-- CustomerRepositoryDecorator.cs # Cache Decorator
+-- DepositRepository.cs           # Repository implementation
+-- DepositRepositoryDecorator.cs  # Cache Decorator

PaymentService/Models/DbModel/
+-- Customer.cs                    # Database mapping model
+-- DepositChannel.cs              # Database mapping model
+-- DepositLimitInfo.cs            # Database mapping model
```

### Complete Example: CustomerRepository

```csharp
namespace PaymentService.Repositories
{
    /// <summary>
    /// Customer data access implementation
    /// </summary>
    public class CustomerRepository : ICustomerRepository
    {
        private readonly MySqlClient _mainDbClient;

        public CustomerRepository(IEnumerable<MySqlClient> mySqlClients)
        {
            var sqlClients = mySqlClients.ToList();
            _mainDbClient = sqlClients.First(client => client.DataBase == DataBase.Main);
        }

        /// <summary>
        /// Get customer data
        /// </summary>
        public async Task<Customer> GetCustInfoAsync(int custId)
        {
            // 1. Execute database query, get DbModel
            var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
                "Customer_Get",
                new { CustId = custId });

            // 2. Convert to Domain Model via CreateDomain()
            return dbCust?.CreateDomain();
        }

        /// <summary>
        /// Get customer point level
        /// </summary>
        public async Task<int> GetPointLevelAsync(int custId)
        {
            return await _mainDbClient.ExecuteScalarAsync<int>(
                "Member_PointLevel_Get",
                new { CustId = custId });
        }

        /// <summary>
        /// Get complete customer context
        /// </summary>
        public async Task<CustomerContext> GetCustContextAsync(int custId)
        {
            var customer = await GetCustInfoAsync(custId);
            if (customer == null)
                throw new CustomerNotFoundException(custId);

            var pointLevel = await GetPointLevelAsync(custId);
            return new CustomerContext(customer, pointLevel);
        }
    }
}
```

### DbModel and CreateDomain Pattern

```csharp
namespace PaymentService.Models.DbModel
{
    /// <summary>
    /// Database mapping model (corresponds to database columns)
    /// </summary>
    public class Customer
    {
        public int? SysId { get; init; }
        public int CustId { get; init; }
        public int SiteId { get; init; }
        public byte VipLevel { get; init; }
        public string Tags { get; init; }     // JSON string
        public int CurrencyId { get; init; }   // int corresponds to Enum

        /// <summary>
        /// Convert to Domain Model
        /// </summary>
        public Domain.Customer CreateDomain()
        {
            return new Domain.Customer
            {
                CustId = CustId,
                SiteId = SiteId,
                VipLevel = VipLevel,
                Tags = Tags.ParseJson<List<int>>(),        // JSON to List
                Currency = (CurrencyEnum)CurrencyId        // int to Enum
            };
        }
    }
}
```

### Decorator Implementing Cache

```csharp
namespace PaymentService.Repositories
{
    /// <summary>
    /// Customer Repository cache Decorator
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

        public async Task<Customer> GetCustInfoAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"CustInfo:{custId}",           // Cache Key
                TimeSpan.FromMinutes(1),         // TTL
                async () => await _customerRepository.GetCustInfoAsync(custId)
            );
        }

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

### Infrastructure Layer Rules

| Rule | Description |
|------|-------------|
| **Implement Interfaces** | Implement interfaces defined by Application Layer |
| **Return Domain Model** | Use `CreateDomain()` for conversion |
| **Decorator Separation** | Caching, logging implemented via Decorator |
| **Only Handle Technical Details** | Do not contain business logic judgments |

---

## Presentation Layer

### Responsibility Definition

| Responsibility | Description |
|----------------|-------------|
| **HTTP Handling** | Handle HTTP Request/Response |
| **Input Validation** | Use Data Annotations for input validation |
| **Format Conversion** | Convert Domain Model to API Response |
| **Route Definition** | Define API endpoints |

### Project Location

```
PaymentService/Controllers/
+-- CustomerController.cs

PaymentService/Models/Payload/
+-- GetDepositOptionsRequest.cs
```

### Complete Example: Controller

```csharp
namespace PaymentService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerController : ControllerBase
    {
        private readonly IDepositQueryService _depositQueryService;

        public CustomerController(IDepositQueryService depositQueryService)
        {
            _depositQueryService = depositQueryService;
        }

        /// <summary>
        /// Get customer's available deposit options
        /// </summary>
        [HttpPost("GetDepositOptions")]
        public async Task<IActionResult> GetDepositOptions(
            [FromBody] GetDepositOptionsRequest request)
        {
            // 1. Call Service (don't handle business logic)
            var result = await _depositQueryService
                .GetDepositChannelsByDepositTypeAsync(request.CustId);

            // 2. Return unified format
            return Ok(ApiResult.Success(result));
        }
    }
}
```

### Request Model Validation

```csharp
namespace PaymentService.Models.Payload
{
    /// <summary>
    /// Request model for getting deposit options
    /// </summary>
    public class GetDepositOptionsRequest
    {
        /// <summary>
        /// Customer ID
        /// </summary>
        [Required(ErrorMessage = "CustId is required")]
        [Range(1, int.MaxValue, ErrorMessage = "CustId must be greater than 0")]
        public int CustId { get; set; }
    }
}
```

### Presentation Layer Prohibitions

```csharp
// Prohibited: Containing business logic
[HttpPost("GetDepositOptions")]
public async Task<IActionResult> GetDepositOptions(int custId)
{
    var cust = await _custRepo.GetCust(custId);

    // This logic should not be in Controller!
    if (cust.VipLevel < 3)
        return BadRequest("VIP level insufficient");

    var channels = await _depositRepo.GetChannels();
    var filtered = channels.Where(c => c.VipLevels.Contains(cust.VipLevel));

    return Ok(filtered);
}

// Prohibited: Directly calling Repository
public class CustomerController
{
    private readonly ICustomerRepository _customerRepository;
    private readonly IDepositRepository _depositRepository;

    // Should call Service, not directly call multiple Repositories
}
```

---

## Layer Responsibility Comparison Summary

| Layer | Should Do | Should Not Do |
|-------|-----------|---------------|
| **Domain** | Business logic, validation rules, immutability | Data access, HTTP, caching, logging |
| **Application** | Coordinate Repository, define interfaces, delegate to Domain | Business logic, data access, caching |
| **Infrastructure** | Data access, model conversion, Decorator | Business logic, HTTP handling |
| **Presentation** | HTTP handling, input validation, response formatting | Business logic, data access |

---

## Review Checklist

### Domain Layer Check

- [ ] Use `init` setter instead of `set`?
- [ ] Are business logic methods inside Domain Model?
- [ ] No external dependencies (Repository, HttpClient)?
- [ ] Method naming uses business language?

### Application Layer Check

- [ ] Does Service only coordinate?
- [ ] Is business logic delegated to Domain Model?
- [ ] Are Repository interfaces defined in this layer?
- [ ] Depends on interfaces not implementations?

### Infrastructure Layer Check

- [ ] Does Repository return Domain Model?
- [ ] Uses `CreateDomain()` for conversion?
- [ ] Is caching implemented via Decorator?
- [ ] Only handles technical details?

### Presentation Layer Check

- [ ] Does Controller only handle HTTP?
- [ ] Input validation uses Data Annotations?
- [ ] Calls Service instead of directly calling Repository?
- [ ] Uses unified response format (ApiResult)?

---

## Common Pitfalls for New Developers

### 1. Business Logic in Wrong Layer

```csharp
// Wrong: Business logic in Controller
public class CustomerController
{
    public async Task<IActionResult> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        // This is business logic, should be in Domain Model!
        var filtered = channels.Where(c => c.VipLevels.Contains(vipLevel));
        return Ok(filtered);
    }
}

// Correct: Business logic in Domain Model
public class DepositChannels
{
    public DepositChannels FilterSupported(CustomerContext custContext)
    {
        var filtered = Items.Where(c => c.IsSupported(custContext));
        return new DepositChannels(filtered);
    }
}
```

### 2. Repository Returning DbModel

```csharp
// Wrong: Returning DbModel
public async Task<DbModel.Customer> GetCustInfoAsync(int custId)
{
    return await _db.QueryFirstAsync<DbModel.Customer>(...);
}

// Correct: Returning Domain Model
public async Task<Customer> GetCustInfoAsync(int custId)
{
    var dbModel = await _db.QueryFirstAsync<DbModel.Customer>(...);
    return dbModel?.CreateDomain();
}
```

### 3. Service Directly Accessing Database

```csharp
// Wrong: Service directly using DbContext
public class DepositQueryService
{
    private readonly DbContext _dbContext;

    public async Task<Customer> GetCustomer(int id)
    {
        return await _dbContext.Customers.FindAsync(id);
    }
}

// Correct: Through Repository interface
public class DepositQueryService
{
    private readonly ICustomerRepository _customerRepository;

    public async Task<CustomerContext> GetContext(int id)
    {
        return await _customerRepository.GetCustContextAsync(id);
    }
}
```

---

## TL / Reviewer Checkpoint

### Responsibility Boundary Review

| Issue Found | Possible Cause | Suggested Action |
|-------------|----------------|------------------|
| Controller exceeds 50 lines | Business logic mixed in | Extract to Service/Domain |
| Service has Where/Select | Business logic not delegated | Move to Domain Model |
| Repository has if-else business logic | Responsibility confusion | Move to Domain Model |
| Domain Model has `_repo` field | Wrong dependency | Remove external dependency |

### Dependency Direction Review

- [ ] Does Domain Layer have `using PaymentService.Repositories`?
- [ ] Does Application Layer have `using PaymentService.Models.DbModel`?
- [ ] Does Controller directly depend on Repository implementation?

### Naming Review

- [ ] Do Domain Model methods use business language?
- [ ] Do interfaces start with `I`?
- [ ] Are DbModel and Domain Model in correct namespaces?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
