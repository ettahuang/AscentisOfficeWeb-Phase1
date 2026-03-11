# Repository Pattern

> This document explains the design principles and implementation specifications for the Repository pattern in the PaymentService project, including interface design, DbModel separation, and Decorator caching layer concepts.

---

## Repository Design Principles

### Core Responsibilities

| Responsibility | Description |
|----------------|-------------|
| **Data Access** | Execute database queries (Stored Procedures, SQL) |
| **Model Conversion** | Convert DbModel to Domain Model |
| **Abstract Data Source** | Hide data access details |

### Responsibilities That Should Not Be Included

| Prohibited Item | Reason |
|-----------------|--------|
| Business logic | Should be in Domain Model |
| Cache handling | Should use Decorator separation |
| Logging | Should use Decorator or Middleware |
| HTTP calls | Should be separate Infrastructure service |

---

## Interface Design

### Interface Definition Location

**Important**: Repository interfaces are defined in the `Services/` namespace (Application Layer), not in the `Repositories/` namespace.

```csharp
// Correct: Interface in Services/ namespace
namespace PaymentService.Services
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
        Task<int> GetPointLevelAsync(int custId);
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}

// Correct: Implementation in Repositories/ namespace
namespace PaymentService.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        // Implementation...
    }
}
```

```csharp
// Wrong: Interface in Repositories/ namespace
namespace PaymentService.Repositories
{
    public interface ICustomerRepository { }  // Violates Dependency Inversion Principle!
}
```

### Interface Design Principles

```csharp
namespace PaymentService.Services
{
    /// <summary>
    /// Customer data access interface
    /// </summary>
    public interface ICustomerRepository
    {
        /// <summary>
        /// Get customer basic information
        /// </summary>
        /// <param name="custId">Customer ID</param>
        /// <returns>Customer data, or null if not exists</returns>
        Task<Customer> GetCustInfoAsync(int custId);

        /// <summary>
        /// Get customer point level
        /// </summary>
        Task<int> GetPointLevelAsync(int custId);

        /// <summary>
        /// Get complete customer context
        /// </summary>
        /// <exception cref="CustomerNotFoundException">Thrown when customer doesn't exist</exception>
        Task<CustomerContext> GetCustContextAsync(int custId);
    }
}
```

### Interface Design Checklist

- [ ] Is interface in `Services/` namespace?
- [ ] Is method return type Domain Model?
- [ ] Are there appropriate XML documentation comments?
- [ ] Is interface small and focused (ISP)?

---

## Repository Implementation

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
            // 1. Execute Stored Procedure, get DbModel
            var dbCust = await _mainDbClient.QueryFirstAsync<DbModel.Customer>(
                "Customer_Get",
                new { CustId = custId });

            // 2. Use CreateDomain() to convert to Domain Model
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

            // Business exception: Customer not found
            if (customer == null)
                throw new CustomerNotFoundException(custId);

            var pointLevel = await GetPointLevelAsync(custId);

            // Compose into CustomerContext
            return new CustomerContext(customer, pointLevel);
        }
    }
}
```

### Complete Example: DepositRepository

```csharp
namespace PaymentService.Repositories
{
    public class DepositRepository : IDepositRepository
    {
        private readonly MySqlClient _reportDbClient;
        private readonly MySqlClient _mainDbClient;

        public DepositRepository(IEnumerable<MySqlClient> mySqlClients)
        {
            var sqlClients = mySqlClients.ToList();
            _mainDbClient = sqlClients.First(client => client.DataBase == DataBase.Main);
            _reportDbClient = sqlClients.First(client => client.DataBase == DataBase.Report);
        }

        /// <summary>
        /// Get deposit limit information
        /// </summary>
        public async Task<DepositLimitInfos> GetDepositLimitInfosAsync(int siteId)
        {
            var dbDepositLimitInfos = await _reportDbClient
                .QueryAsync<DbModel.DepositLimitInfo>(
                    "Service_DepositLimitInfo_Get",
                    new { _SiteId = siteId });

            // Convert to Domain Model
            var depositLimitInfos = dbDepositLimitInfos
                .Select(dbInfo => dbInfo.CreateDomain())
                .ToList();

            return new DepositLimitInfos(depositLimitInfos);
        }

        /// <summary>
        /// Get deposit channels (including limit information)
        /// </summary>
        public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
        {
            // Parallel query optimization
            var queryTask = _mainDbClient.QueryAsync<DbModel.DepositChannel>(
                "Service_Integrate_PayInfo_Get",
                new { _SiteId = siteId, _DepositType = (int)DepositTypeEnum.Undefined });

            var getDepositLimitInfosTask = GetDepositLimitInfosAsync(siteId);

            await Task.WhenAll(queryTask, getDepositLimitInfosTask);

            var dbDepositChannels = await queryTask;
            var depositLimitInfos = await getDepositLimitInfosTask;

            // Convert to Domain Model
            var depositChannelList = dbDepositChannels
                .Select(dbChannel => dbChannel.CreateDomain())
                .ToList();

            return new DepositChannels(depositChannelList, depositLimitInfos);
        }
    }
}
```

---

## DbModel and Domain Model Separation

### Necessity of Separation

| Aspect | DbModel | Domain Model |
|--------|---------|--------------|
| **Responsibility** | Database column mapping | Business logic encapsulation |
| **Types** | Primitive types (int, string) | Strong types (Enum, List) |
| **Mutability** | Mutable | Immutable |
| **Dependencies** | None | No external dependencies |

### DbModel Design

```csharp
namespace PaymentService.Models.DbModel
{
    /// <summary>
    /// Database mapping model (corresponds to Stored Procedure return columns)
    /// </summary>
    public class DepositChannel
    {
        // Database columns (primitive types)
        public int? SysId { get; init; }
        public string BankCode { get; init; }
        public string BankName { get; init; }
        public int PayId { get; init; }
        public int DepositType { get; init; }         // int
        public int PointLevel { get; init; }
        public string VipLevel { get; init; }          // JSON string
        public string TagExcludeList { get; init; }    // JSON string
        public int CurrencyId { get; init; }           // int
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
                Currency = (CurrencyEnum)CurrencyId,              // int -> Enum
                DepositType = (DepositTypeEnum)DepositType,       // int -> Enum
                ExcludeTags = TagExcludeList.ParseJson<List<int>>(), // JSON -> List
                VipLevels = VipLevel.ParseJson<List<int>>(),      // JSON -> List
                PointLevel = PointLevel,
                MinAmount = MinAmount,
                MaxAmount = MaxAmount,
                Sort = Sort
            };
        }
    }
}
```

### CreateDomain Conversion Key Points

| Conversion Type | Example |
|-----------------|---------|
| int -> Enum | `(CurrencyEnum)CurrencyId` |
| JSON -> List | `VipLevel.ParseJson<List<int>>()` |
| JSON -> Object | `ConfigJson.ParseJson<Config>()` |
| Nullable handling | `dbModel?.CreateDomain()` |

---

## Decorator Pattern Caching Layer

### Design Principles

Use Decorator pattern to separate caching logic from data access logic:

```
+----------------------------------------+
| DepositRepositoryDecorator (Cache)      |
| +------------------------------------+ |
| | DepositRepository (Data Access)    | |
| +------------------------------------+ |
+----------------------------------------+
```

### Decorator Implementation

```csharp
namespace PaymentService.Repositories
{
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

        public async Task<int> GetPointLevelAsync(int custId)
        {
            return await _cacheHelper.TryGetOrCreateAsync(
                $"PointLevel:{custId}",
                TimeSpan.FromMinutes(1),
                async () => await _customerRepository.GetPointLevelAsync(custId),
                RedisDataBase.Shared  // Specify Redis DB
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

### DI Registration

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 1. Register original Repository
    services.AddScoped<ICustomerRepository, CustomerRepository>();

    // 2. Use Decorate to add Decorator
    services.Decorate<ICustomerRepository, CustomerRepositoryDecorator>();

    // DepositRepository likewise
    services.AddScoped<IDepositRepository, DepositRepository>();
    services.Decorate<IDepositRepository, DepositRepositoryDecorator>();
}
```

### Cache Key Design Specification

| Pattern | Example | Description |
|---------|---------|-------------|
| `{Entity}:{Id}` | `CustInfo:12345` | Single entity |
| `{Entity}s:{SiteId}` | `DepositChannels:1` | Collection data |
| `{Entity}:{Composite}` | `DepositLimit:1:CNY:3` | Composite condition |

### TTL Design Recommendations

| Data Type | Recommended TTL | Description |
|-----------|-----------------|-------------|
| High frequency change | 30 seconds | Deposit channel status |
| Medium frequency change | 1-5 minutes | Customer information |
| Low frequency change | 10-30 minutes | Configuration data |

---

## Performance Optimization

### Parallel Queries

When querying multiple independent data sources, use `Task.WhenAll()` for parallel processing:

```csharp
public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
{
    // Parallel query
    var channelsTask = _mainDbClient.QueryAsync<DbModel.DepositChannel>(
        "Service_Integrate_PayInfo_Get", new { _SiteId = siteId });

    var limitsTask = GetDepositLimitInfosAsync(siteId);

    // Wait for both queries to complete simultaneously
    await Task.WhenAll(channelsTask, limitsTask);

    var channels = await channelsTask;
    var limits = await limitsTask;

    return new DepositChannels(
        channels.Select(c => c.CreateDomain()).ToList(),
        limits);
}
```

```csharp
// Wrong: Sequential query
public async Task<DepositChannels> GetDepositChannelsAsync(int siteId)
{
    var channels = await _mainDbClient.QueryAsync<DbModel.DepositChannel>(...);
    var limits = await GetDepositLimitInfosAsync(siteId);  // Waits for previous to complete

    return new DepositChannels(...);
}
```

### Query Optimization Recommendations

| Optimization Item | Description |
|-------------------|-------------|
| Query only needed columns | SELECT specific columns instead of * |
| Use indexes | Ensure query conditions have corresponding indexes |
| Batch queries | Avoid N+1 problems |
| Cache hot data | Use Decorator caching |

---

## Repository Testing

### Testing Strategy

> **Important Rule**: Repositories only require integration tests, not unit tests.

| Test Type | Repository | Reason |
|-----------|------------|--------|
| ❌ Unit Tests | Not required | Repository's core responsibility is database access; mocking database cannot verify real behavior |
| ✅ Integration Tests | Required | Verify SP calls, parameter passing, and DbModel → Domain conversion correctness |

**Why no unit tests?**

1. **Mocks cannot verify real behavior**: Repository's value lies in correctly calling Stored Procedures and converting results; mocking MySqlClient only tests the mock setup
2. **High maintenance cost**: Unit tests require maintaining mock setups; when SP parameters or return structures change, unit tests may still pass but actual code is broken
3. **Integration tests are more valuable**: Using Testcontainers can verify end-to-end data flow, including SP execution results

**When are exceptions allowed?**

- If Repository contains complex query condition assembly logic (like dynamic SQL concatenation), unit tests can be written for that logic
- Decorators (like caching layer) can have unit tests to verify caching logic

### Integration Tests (Testcontainers)

```csharp
[TestFixture]
public class CustomerRepositoryTests
{
    private MySqlContainerFixture _fixture;
    private CustomerRepository _repository;

    [OneTimeSetUp]
    public async Task Setup()
    {
        _fixture = await new MySqlContainerFixtureBuilder()
            .WithDatabase(DatabaseNames.Main)
            .BuildAsync();

        _repository = new CustomerRepository(_fixture.GetMySqlClients());
    }

    [Test]
    public async Task GetCustInfoAsync_WhenCustomerExists_ShouldReturnCustomer()
    {
        // Given
        var custId = await _fixture.InsertTestCustomer();

        // When
        var result = await _repository.GetCustInfoAsync(custId);

        // Then
        result.Should().NotBeNull();
        result.CustId.Should().Be(custId);
    }
}
```

---

## Review Checklist

### Interface Design Check

- [ ] Is interface defined in `Services/` namespace?
- [ ] Is method return type Domain Model (not DbModel)?
- [ ] Are there appropriate XML documentation comments?
- [ ] Is interface small and focused?

### Implementation Check

- [ ] Uses `CreateDomain()` for model conversion?
- [ ] Handles null cases?
- [ ] Uses `Task.WhenAll()` to optimize parallel queries?
- [ ] Is caching separated via Decorator?

### Decorator Check

- [ ] Is Cache Key naming consistent?
- [ ] Is TTL setting reasonable?
- [ ] Is DI using `services.Decorate()` for registration?

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

### 2. Returning DbModel Instead of Domain Model

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

### 3. Caching Logic Mixed Into Repository

```csharp
// Wrong: Repository directly handling cache
public class CustomerRepository : ICustomerRepository
{
    private readonly ICacheHelper _cache;  // Should not have this

    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}");
        if (cached != null) return cached;

        var data = await _db.Query(...);
        await _cache.SetAsync($"Cust:{custId}", data);
        return data;
    }
}

// Correct: Use Decorator to handle caching
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var dbModel = await _db.QueryFirstAsync<DbModel.Customer>(...);
        return dbModel?.CreateDomain();
    }
}

public class CustomerRepositoryDecorator : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        return await _cache.TryGetOrCreateAsync(
            $"CustInfo:{custId}",
            TimeSpan.FromMinutes(1),
            () => _repo.GetCustInfoAsync(custId));
    }
}
```

### 4. Forgetting to Use Task.WhenAll

```csharp
// Wrong: Sequential query
var customer = await _customerRepo.GetCustInfoAsync(custId);
var pointLevel = await _customerRepo.GetPointLevelAsync(custId);

// Correct: Parallel query
var customerTask = _customerRepo.GetCustInfoAsync(custId);
var pointLevelTask = _customerRepo.GetPointLevelAsync(custId);
await Task.WhenAll(customerTask, pointLevelTask);

var customer = await customerTask;
var pointLevel = await pointLevelTask;
```

---

## TL / Reviewer Checkpoint

### Architecture Review

| Check Item | Warning Signal |
|------------|----------------|
| Interface location | `using PaymentService.Services` appears in Repository interface definition file |
| DbModel leakage | Repository method returns `DbModel.XXX` |
| Cache mixed in | Repository has `ICacheHelper` dependency |
| Responsibility violation | Repository has business logic judgments |

### Performance Review

- [ ] Are there N+1 query problems?
- [ ] Is `Task.WhenAll()` used for parallelization?
- [ ] Is there Cache Key collision risk?
- [ ] Is TTL set reasonably?

### Testing Review

- [ ] Can Repository be mocked?
- [ ] Are there integration tests covering it?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
