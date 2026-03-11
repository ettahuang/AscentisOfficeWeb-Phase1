# Service Layer Design

> This document explains the design principles and implementation specifications for the Service layer in the PaymentService project, including when Service is needed, Service responsibility boundaries, and how to correctly delegate business logic to Domain Models.

---

## Service Layer Position

### Position in Clean Architecture

```
+--------------------------------------------+
|  Controller (Presentation)                  |
|         | calls                             |
+--------------------------------------------+
|  Service (Application)  <- You are here     |
|         | coordinates                       |
+--------------------------------------------+
|  Repository Interface (Application)         |
|         | implements                        |
+--------------------------------------------+
|  Repository (Infrastructure)                |
+--------------------------------------------+
```

### Service Layer Core Responsibilities

| Responsibility | Description | Example |
|----------------|-------------|---------|
| **Coordinate Multiple Repositories** | Call multiple data sources | Get Customer and DepositChannels simultaneously |
| **Orchestrate Business Flow** | Determine call order | Verify customer exists first, then query channels |
| **Delegate Business Logic** | Hand off computation to Domain Model | `depositChannels.GroupByDepositType()` |
| **Assemble Results** | Combine data from multiple sources | Create `DepositChannelsByDepositType` |

---

## When Is Service Layer Needed?

### Scenarios That Need Service

| Scenario | Description |
|----------|-------------|
| Coordinate multiple Repositories | Need to access Customer and Deposit data simultaneously |
| Cross-aggregate operations | Operations involving multiple aggregate roots |
| Complex flow orchestration | Multi-step business flows |
| Transaction boundary control | Need to maintain transaction consistency across operations |

### Scenarios That Don't Need Service

| Scenario | Recommended Approach |
|----------|---------------------|
| Single Repository CRUD | Controller directly calls Repository |
| Pure data query | Controller directly calls Repository |
| Simple data transformation | Handle in Controller or Domain Model |

---

## Service Design Principles

### Principle 1: Only Coordinate, Don't Handle Business Logic

```csharp
// Correct: Service only coordinates, business logic in Domain Model
public class DepositQueryService : IDepositQueryService
{
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
```

```csharp
// Wrong: Service contains business logic
public class DepositQueryService : IDepositQueryService
{
    public async Task<List<DepositChannel>> GetChannelsAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var channels = await _depositRepository.GetChannelsAsync(custContext.Customer.SiteId);

        // This logic should be in Domain Model!
        return channels
            .Where(c => c.VipLevels.Contains(custContext.Customer.VipLevel))
            .Where(c => c.Currency == custContext.Customer.Currency)
            .Where(c => !c.ExcludeTags.Intersect(custContext.Customer.Tags).Any())
            .Where(c => c.PointLevel <= custContext.PointLevel)
            .ToList();
    }
}
```

### Principle 2: Depend on Interfaces, Not Implementations

```csharp
public class DepositQueryService : IDepositQueryService
{
    // Depend on interfaces
    private readonly ICustomerRepository _customerRepository;
    private readonly IDepositRepository _depositRepository;

    public DepositQueryService(
        ICustomerRepository customerRepository,   // Interface
        IDepositRepository depositRepository)     // Interface
    {
        _customerRepository = customerRepository;
        _depositRepository = depositRepository;
    }
}
```

```csharp
// Wrong: Depend on concrete implementations
public class DepositQueryService
{
    private readonly CustomerRepository _customerRepository;  // Concrete class
    private readonly DepositRepository _depositRepository;    // Concrete class
}
```

### Principle 3: Don't Handle Cross-Cutting Concerns

| Cross-Cutting Concern | Correct Handling |
|----------------------|------------------|
| Caching | Repository Decorator |
| Logging | Middleware / Decorator |
| Transactions | Unit of Work Pattern |
| Validation | Domain Model / Controller |

---

## Complete Service Implementation Example

### Interface Definition

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// Deposit query service interface
    /// </summary>
    public interface IDepositQueryService
    {
        /// <summary>
        /// Get customer's available deposit channels (grouped by deposit type)
        /// </summary>
        /// <param name="custId">Customer ID</param>
        /// <returns>Deposit channels grouped by deposit type</returns>
        /// <exception cref="CustomerNotFoundException">Thrown when customer doesn't exist</exception>
        Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId);
    }
}
```

### Implementation

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// Deposit query service
    /// Coordinates CustomerRepository and DepositRepository to complete deposit channel query use case
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
            // Step 1: Get customer context (includes verifying customer exists)
            var custContext = await _customerRepository.GetCustContextAsync(custId);

            // Step 2: Get deposit channels for this site
            var siteId = custContext.Customer.SiteId;
            var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

            // Step 3: Delegate to Domain Model for business logic processing
            // - Filter channels applicable to customer
            // - Group by deposit type
            // - Apply deposit limits
            return depositChannels.GroupByDepositType(custContext);
        }
    }
}
```

---

## Delegating Business Logic to Domain Model

### Correct Delegation Pattern

```csharp
// Service layer
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

        // Delegate to Domain Model
        return depositChannels.GroupByDepositType(custContext);
    }
}

// Domain Model layer
public class DepositChannels
{
    public DepositChannelsByDepositType GroupByDepositType(CustomerContext custContext)
    {
        var channelsByType = new Dictionary<DepositTypeEnum, IList<DepositChannel>>();

        // Business logic is here
        var payInfoGrouping = DepositChannelList
            .Where(channel => channel.IsSupported(custContext))  // Delegate to DepositChannel
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

### Delegation Hierarchy

```
Service.GetDepositChannelsByDepositTypeAsync()
    | delegate
DepositChannels.GroupByDepositType()
    | delegate
DepositChannel.IsSupported()
DepositChannel.IsOverlappingWith()
DepositChannel.WithAmountLimit()
DepositLimitInfos.TryResolveLimit()
```

---

## Parallel Query Optimization

### When to Use Parallel Queries

When Service needs to call multiple **independent** Repository methods, use `Task.WhenAll()` for parallel processing.

### Example: Parallel Query

```csharp
public class DepositQueryService : IDepositQueryService
{
    public async Task<DepositSummary> GetDepositSummaryAsync(int custId)
    {
        // First get customer info (subsequent queries need siteId)
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var siteId = custContext.Customer.SiteId;

        // Parallel query independent data
        var channelsTask = _depositRepository.GetDepositChannelsAsync(siteId);
        var historyTask = _depositRepository.GetDepositHistoryAsync(custId);
        var configTask = _configRepository.GetSiteConfigAsync(siteId);

        await Task.WhenAll(channelsTask, historyTask, configTask);

        var channels = await channelsTask;
        var history = await historyTask;
        var config = await configTask;

        // Assemble result
        return new DepositSummary(
            channels.GroupByDepositType(custContext),
            history,
            config);
    }
}
```

### Important Notes

```csharp
// Wrong: Queries with dependencies cannot be parallel
var custContextTask = _customerRepository.GetCustContextAsync(custId);
var channelsTask = _depositRepository.GetDepositChannelsAsync(siteId);  // Needs siteId!
await Task.WhenAll(custContextTask, channelsTask);  // siteId not obtained yet!

// Correct: Handle dependencies sequentially
var custContext = await _customerRepository.GetCustContextAsync(custId);
var siteId = custContext.Customer.SiteId;  // Get siteId
var channels = await _depositRepository.GetDepositChannelsAsync(siteId);
```

---

## Service and Controller Interaction

### Controller Calling Service

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
        // Controller only calls Service, doesn't handle business logic
        var result = await _depositQueryService
            .GetDepositChannelsByDepositTypeAsync(request.CustId);

        return Ok(ApiResult.Success(result));
    }
}
```

### Responsibility Division

| Layer | Responsibility |
|-------|----------------|
| **Controller** | HTTP handling, input validation, response formatting |
| **Service** | Coordinate Repository, orchestrate flow, delegate to Domain |
| **Repository** | Data access, model conversion |
| **Domain Model** | Business logic, business rule validation |

---

## DI Registration

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // Repository registration
    services.AddScoped<ICustomerRepository, CustomerRepository>();
    services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

    services.AddScoped<IDepositRepository, DepositRepository>();
    services.Decorate<IDepositRepository, DepositRepositoryDecorator>();

    // Service registration
    services.AddScoped<IDepositQueryService, DepositQueryService>();
}
```

---

## Service Testing

### Unit Tests

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

## Review Checklist

### Service Design Check

- [ ] Does Service only coordinate, not contain business logic?
- [ ] Is business logic delegated to Domain Model?
- [ ] Depends on interfaces not implementations?
- [ ] Uses `Task.WhenAll()` to optimize parallel queries?

### Responsibility Boundary Check

- [ ] Does Service have Where/Select and other LINQ business logic?
- [ ] Does Service have cache handling?
- [ ] Does Service have logging?
- [ ] Is Service method too long (exceeds 30 lines)?

### Interface Design Check

- [ ] Do interface method names clearly express intent?
- [ ] Are there appropriate XML documentation comments?
- [ ] Is return type Domain Model?

---

## Common Pitfalls for New Developers

### 1. Writing Business Logic in Service

```csharp
// Wrong: Service contains business logic
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannelsAsync(int custId)
    {
        var context = await _customerRepo.GetCustContextAsync(custId);
        var channels = await _depositRepo.GetChannelsAsync(context.Customer.SiteId);

        // This should be in Domain Model!
        return channels
            .Where(c => c.VipLevels.Contains(context.Customer.VipLevel))
            .Where(c => c.Currency == context.Customer.Currency)
            .ToList();
    }
}

// Correct: Delegate to Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetChannelsAsync(int custId)
    {
        var context = await _customerRepo.GetCustContextAsync(custId);
        var channels = await _depositRepo.GetChannelsAsync(context.Customer.SiteId);

        return channels.GroupByDepositType(context);  // Delegate!
    }
}
```

### 2. Directly Depending on Repository Implementation

```csharp
// Wrong: Depend on concrete class
public class DepositQueryService
{
    private readonly CustomerRepository _customerRepository;

    public DepositQueryService(CustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }
}

// Correct: Depend on interface
public class DepositQueryService
{
    private readonly ICustomerRepository _customerRepository;

    public DepositQueryService(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }
}
```

### 3. Handling Cache in Service

```csharp
// Wrong: Service handles cache
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

// Correct: Cache handled in Repository Decorator
// Service doesn't need to know about caching
```

### 4. Not Using Parallel Queries

```csharp
// Worse performance: Sequential query
var channels = await _depositRepo.GetChannelsAsync(siteId);
var history = await _depositRepo.GetHistoryAsync(custId);
var config = await _configRepo.GetConfigAsync(siteId);

// Better performance: Parallel query
var channelsTask = _depositRepo.GetChannelsAsync(siteId);
var historyTask = _depositRepo.GetHistoryAsync(custId);
var configTask = _configRepo.GetConfigAsync(siteId);
await Task.WhenAll(channelsTask, historyTask, configTask);
```

---

## TL / Reviewer Checkpoint

### Responsibility Review

| Issue Found | Possible Cause | Suggested Action |
|-------------|----------------|------------------|
| Service has Where/Select | Business logic not delegated | Move to Domain Model |
| Service has ICacheHelper | Cache not separated | Use Repository Decorator |
| Service exceeds 50 lines | Doing too much | Split or delegate to Domain |
| Multiple if-else judgments | Business logic mixed in | Move to Domain Model |

### Design Review

- [ ] Can Service be unit tested?
- [ ] Can Repository dependencies be mocked?
- [ ] Is there an unnecessary Service layer (single Repository operation)?

### Common Review Questions

- "Why isn't this Where condition in Domain Model's method?"
- "Can these two Repository calls be parallel?"
- "Is this Service necessary? Can Controller call Repository directly?"

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
