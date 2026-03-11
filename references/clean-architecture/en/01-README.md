# Clean Architecture Project Rules and Implementation Guide

> This knowledge base is extracted from the PaymentService project refactoring implementation (AAZ-1753), providing the team with standard specifications and guidelines for Clean Architecture practices.

---

## Document Navigation

### Part 1: Fundamentals (Required Reading)

| No. | Document | Description |
|-----|----------|-------------|
| 02 | [Architecture-Overview](./02-Architecture-Overview.md) | Project architecture migration status, legacy architecture problem analysis, new architecture design |
| 03 | [Architecture-Diagrams](./03-Architecture-Diagrams.md) | Concentric circle architecture diagram, complete flow diagrams, design pattern architecture diagrams |
| 04 | [Project-Directory-Structure](./04-Project-Directory-Structure.md) | Directory depth rules, naming conventions, complete directory tree examples |

### Part 2: Clean Architecture Principles

| No. | Document | Description |
|-----|----------|-------------|
| 05 | [Clean-Architecture-Core-Principles](./05-Clean-Architecture-Core-Principles.md) | Six core principles, dependency inversion, separation of concerns |
| 06 | [Layer-Responsibilities](./06-Layer-Responsibilities.md) | Domain/Application/Infrastructure layer responsibilities |
| 07 | [TDD-and-Tidy-First-Guide](./07-TDD-and-Tidy-First-Guide.md) | Red-Green-Refactor, structural/behavioral change separation, commit discipline |

### Part 3: Domain Design

| No. | Document | Description |
|-----|----------|-------------|
| 08 | [Domain-Model-Design-Guide](./08-Domain-Model-Design-Guide.md) | Rich Model, entity design, immutability, CreateDomain pattern, Value Object |
| 09 | [Repository-Pattern](./09-Repository-Pattern.md) | Repository design, Decorator caching layer, DbModel separation |

### Part 4: Application Services

| No. | Document | Description |
|-----|----------|-------------|
| 10 | [Service-Layer-Design](./10-Service-Layer-Design.md) | Service responsibilities, coordinating Repositories, parallel query optimization |
| 11 | [Decorator-Pattern-Specification](./11-Decorator-Pattern-Specification.md) | Decorator design principles, Cache Key design, DI registration |
| 12 | [Feature-Toggle-Specification](./12-Feature-Toggle-Specification.md) | Dispatcher Pattern, Handler design, V1/V2 comparison mechanism |

### Part 5: Cross-Cutting Concerns

| No. | Document | Description |
|-----|----------|-------------|
| 13 | [Exception-Handling-and-Error-Management](./13-Exception-Handling-and-Error-Management.md) | PaymentServiceException, GlobalExceptionMiddleware, PaymentError |
| 14 | [Middleware-Specification](./14-Middleware-Specification.md) | Entry point handling, Request/Response logging, registration order |
| 15 | [DelegatingHandler-Specification](./15-DelegatingHandler-Specification.md) | Exit point handling, Retry/Timeout Handler |

### Part 6: Testing

| No. | Document | Description |
|-----|----------|-------------|
| 16 | [Testing-Specification-and-Guidelines](./16-Testing-Specification-and-Guidelines.md) | Given-When-Then, Test Builders, FluentAssertions |
| 17 | [MySQL-Testcontainers-Quick-Reference](./17-MySQL-Testcontainers-Quick-Reference.md) | Integration Tests, Docker Compose, Fixture design |

### Part 7: Coding Standards

| No. | Document | Description |
|-----|----------|-------------|
| 18 | [CSharp-Coding-Conventions](./18-CSharp-Coding-Conventions.md) | Class member ordering, region usage policy, namespace conventions |
| 20 | [Code-Review-Checklist](./20-Code-Review-Checklist.md) | Implementation plan compliance, SOLID/DRY, documentation, architecture boundary |

> **Note**: Git Commit Message Conventions has been moved to [git-workflow skill](../../git-workflow/commit-message-conventions.md).

### Appendix

| No. | Document | Description |
|-----|----------|-------------|
| A1 | [GetDepositOptionsAsync-API-Review-Report](./A1-GetDepositOptionsAsync-API-Review-Report.md) | Actual refactoring example, architecture compliance assessment, benchmark case |
| A2 | [GetPromotionListV3-Refactoring-Review-Report](./A2-GetPromotionListV3-Refactoring-Review-Report.md) | Handler/Dispatcher pattern, incremental migration strategy, V1/V2 comparison mechanism |

---

## Quick Start Guide

### Recommended Reading Order for New Developers

```
Week 1: Architecture Fundamentals
├── 02-Architecture-Overview.md          ← Understand overall project architecture
├── 04-Project-Directory-Structure.md    ← Familiarize with project structure
├── 05-Core-Principles.md                ← Master design principles
└── 06-Layer-Responsibilities.md         ← Understand each layer's responsibilities

Week 2: Development Methodology and Domain Design
├── 07-TDD-and-Tidy-First.md             ← Learn TDD and commit discipline
├── 08-Domain-Model-Design.md            ← Learn Domain Model design
├── 09-Repository-Pattern.md             ← Understand data access patterns
└── 10-Service-Layer-Design.md           ← Master Service coordination logic

Week 3: Testing and Implementation
├── 16-Testing-Specification.md          ← Learn test writing
└── A1-Review-Report.md                  ← Reference actual cases
```

### Quick Reference for Senior Developers

| Task Scenario | Reference Document |
|---------------|-------------------|
| Adding a new Domain Model | [08-Domain-Model-Design-Guide](./08-Domain-Model-Design-Guide.md) |
| Implementing a Repository | [09-Repository-Pattern](./09-Repository-Pattern.md) |
| Adding caching mechanism | [11-Decorator-Pattern-Specification](./11-Decorator-Pattern-Specification.md) |
| Handling exception scenarios | [13-Exception-Handling-and-Error-Management](./13-Exception-Handling-and-Error-Management.md) |
| Writing unit tests | [16-Testing-Specification-and-Guidelines](./16-Testing-Specification-and-Guidelines.md) |
| TDD and Commit Discipline | [07-TDD-and-Tidy-First-Guide](./07-TDD-and-Tidy-First-Guide.md) |

---

## Development Checklist

### Domain Model Development Checklist

- [ ] Use `init` setter to ensure immutability
- [ ] Business logic is encapsulated within the Domain Model
- [ ] Do not directly depend on DbModel (convert via `CreateDomain()`)
- [ ] Validation logic is placed in Domain Model construction
- [ ] Use domain language naming (e.g., `IsSupported()`, `WithAmountLimit()`)

### Repository Development Checklist

- [ ] Return Domain Model, not DbModel or DTO
- [ ] Interface defined in `Services/` namespace (dependency inversion)
- [ ] Implementation located in `Repositories/` namespace
- [ ] Use `CreateDomain()` for model conversion
- [ ] Caching implemented through Decorator pattern, not mixed into Repository

### Service Layer Development Checklist

- [ ] Only coordinate multiple Repository calls
- [ ] Business logic delegated to Domain Model
- [ ] No direct database or cache access
- [ ] Use `Task.WhenAll()` for parallel query optimization

### Controller Development Checklist

- [ ] Only responsible for HTTP-related processing (Request/Response)
- [ ] Contains no business logic
- [ ] Input validation uses Data Annotations
- [ ] Returns unified `ApiResult` format

### Exception Handling Checklist

- [ ] Business exceptions inherit from `PaymentServiceException`
- [ ] Use predefined `PaymentError` constants
- [ ] Do not swallow exceptions in catch blocks
- [ ] Let `GlobalExceptionMiddleware` handle uniformly

### Test Development Checklist

- [ ] Use Given-When-Then pattern
- [ ] Use Test Builder to create test data
- [ ] Use FluentAssertions for verification
- [ ] Test method naming: `Method_WhenCondition_ShouldResult`

---

## Project Architecture Overview

```
PaymentService/
├── Models/
│   ├── Domain/           ← Domain Models (core business logic)
│   │   ├── Customer.cs
│   │   ├── DepositChannel.cs
│   │   └── DepositChannels.cs
│   ├── DbModel/          ← Database Models (database mapping)
│   │   ├── Customer.cs
│   │   └── DepositChannel.cs
│   ├── Enum/             ← Enumeration definitions
│   └── Payload/          ← API Request/Response Models
├── Services/             ← Application Layer (interface definitions + Service implementations)
│   ├── ICustomerRepository.cs
│   ├── IDepositRepository.cs
│   ├── IDepositQueryService.cs
│   └── DepositQueryService.cs
├── Repositories/         ← Infrastructure Layer (Repository implementations)
│   ├── CustomerRepository.cs
│   ├── CustomerRepositoryDecorator.cs
│   └── DepositRepository.cs
├── Controllers/          ← Presentation Layer
├── Middlewares/          ← Cross-cutting concerns (entry point)
└── Exceptions/           ← Custom exceptions
```

---

## FAQ

### Q1: Why should Domain Model and DbModel be separated?

**A:** The purpose of separation is to let Domain Model focus on business logic without being affected by database structure. DbModel is responsible for interacting with the database, converting to Domain Model through the `CreateDomain()` method. This allows:
- Business logic changes do not affect database structure
- Database column renaming does not affect business logic
- Easier to write unit tests

### Q2: Why should Repository interfaces be placed in Services/ instead of Repositories/?

**A:** This is the practice of the **Dependency Inversion Principle (DIP)**. Interfaces belong to the Application Layer, defined by Domain/Application Layer to specify "what is needed," while Infrastructure Layer is responsible for "how to implement." This way, Application Layer does not depend on Infrastructure Layer.

### Q3: When should the Service layer be used?

**A:** When an operation needs to **coordinate multiple Repositories** or requires **cross-aggregate business logic**. For example:
- `DepositQueryService` coordinates `ICustomerRepository` and `IDepositRepository`
- If it's just single Repository CRUD, Controller can directly call Repository

### Q4: Why shouldn't caching logic be placed inside Repository?

**A:** Using the **Decorator pattern** separates concerns. Repository focuses on data access, Decorator handles caching. This way:
- Repository maintains single responsibility
- Cache strategy can be flexibly replaced
- Cache logic can be tested independently

---

## Review Checklist

### After reading this knowledge base, please confirm:

- [ ] I have read all content in "Architecture Fundamentals"
- [ ] I understand the reason for separating Domain Model and DbModel
- [ ] I know which namespace Repository interfaces should be defined in
- [ ] I understand the application of Decorator pattern in the project
- [ ] I can distinguish the responsibilities of each layer (Domain/Application/Infrastructure)
- [ ] I know how to write tests using Given-When-Then pattern

---

## Common Pitfalls for New Developers

### 1. Using DbModel directly in Domain Model

```csharp
// ❌ Wrong: Domain Model directly depends on DbModel
public class DepositChannel
{
    public DbModel.DepositChannel DbModel { get; set; } // Wrong!
}

// ✅ Correct: Use CreateDomain() for conversion
public class DbModel.DepositChannel
{
    public Domain.DepositChannel CreateDomain()
    {
        return new Domain.DepositChannel
        {
            Currency = (CurrencyEnum)CurrencyId,
            DepositType = (DepositTypeEnum)DepositType,
            // ...
        };
    }
}
```

### 2. Mixing caching logic into Repository

```csharp
// ❌ Wrong: Repository mixed with caching
public class CustomerRepository : ICustomerRepository
{
    public async Task<Customer> GetCustInfoAsync(int custId)
    {
        var cached = await _cache.GetAsync($"Cust:{custId}"); // Wrong!
        if (cached != null) return cached;
        // ...
    }
}

// ✅ Correct: Use Decorator to handle caching
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

### 3. Service layer containing too much business logic

```csharp
// ❌ Wrong: Service contains business logic
public class DepositQueryService
{
    public async Task<List<DepositChannel>> GetChannels(int custId)
    {
        var channels = await _repo.GetChannels();
        // Business logic should not be in Service
        return channels.Where(c =>
            c.VipLevels.Contains(custContext.VipLevel) &&
            c.MinAmount <= limit.MaxAmount).ToList();
    }
}

// ✅ Correct: Delegate to Domain Model
public class DepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);
        return depositChannels.GroupByDepositType(custContext); // Delegate to Domain Model
    }
}
```

---

## TL / Reviewer Checkpoint

### Architecture Breach Check

| Check Item | Warning Signal |
|------------|----------------|
| Domain layer dependency | Domain Model has `using PaymentService.Repositories` |
| DbModel leakage | Repository returns `DbModel.XXX` instead of Domain Model |
| Caching mixed in | Repository has `_cacheHelper` or `_redis` injection |

### Responsibility Boundary Check

| Layer | Should Not Appear |
|-------|-------------------|
| Controller | Complex if-else business logic, direct database operations |
| Service | SQL queries, cache operations, HTTP Client calls |
| Repository | Business rule judgments, cross-Repository coordination |
| Domain Model | `DbContext`, `HttpClient`, `ILogger` injection |

### Coupling Check

- [ ] When adding new features, do you only need to modify a few files?
- [ ] Do Repository interface changes affect Controller?
- [ ] Do Domain Model changes require synchronous DbModel modifications?

### Maintainability Risk

- [ ] Are there classes exceeding 200 lines?
- [ ] Are there methods with more than 5 parameters?
- [ ] Is there duplicate code (copy-paste)?
- [ ] Is test coverage below 80%?

---

> **Document Version**: v1.1
> **Source Extraction**: Commit b671f069 ~ 6b5804c1 (17 commits total)
> **Last Updated**: 2025-01
> **Change Notes**: Reorganized document structure, added TDD and Tidy First Guide
