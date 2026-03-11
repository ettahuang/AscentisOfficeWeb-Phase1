# Project Directory Structure Specification

> This document explains the directory structure specification for Clean Architecture projects (e.g., PaymentService, BonusService), including directory responsibility definitions, naming conventions, and how to correctly place new classes.

---

## Directory Structure Overview

```
{ProjectName}/
├── Controllers/                    # Presentation Layer
│   └── CustomerController.cs
│
├── Models/
│   ├── Domain/                     # Domain Layer - Core Business Logic
│   │   ├── Customer.cs
│   │   ├── CustomerContext.cs
│   │   ├── DepositChannel.cs
│   │   ├── DepositChannels.cs
│   │   ├── DepositChannelsByDepositType.cs
│   │   ├── DepositLimitInfo.cs
│   │   ├── DepositLimitInfos.cs
│   │   └── DepositUnLimitInfo.cs
│   │
│   ├── ValueObject/                # Value Objects - Identity-less value types
│   │   ├── Period.cs
│   │   ├── VisibilityRules.cs
│   │   ├── LocalizedContent.cs
│   │   └── AntifraudRules.cs
│   │
│   ├── DbModel/                    # Infrastructure - Database Mapping
│   │   ├── Customer.cs
│   │   ├── DepositChannel.cs
│   │   └── DepositLimitInfo.cs
│   │
│   ├── Enum/                       # Shared Enumerations
│   │   ├── CurrencyEnum.cs
│   │   ├── DepositTypeEnum.cs
│   │   ├── ErrorCategoryEnum.cs
│   │   └── ErrorSeverityEnum.cs
│   │
│   ├── Payload/                    # API Request/Response Models
│   │   └── GetDepositOptionsRequest.cs
│   │
│   ├── ApiResult.cs                # Unified API Response Format
│   ├── PaymentError.cs             # Error Definitions
│   └── EmptyFactory.cs             # Empty Value Factory
│
├── Services/                       # Application Layer
│   ├── Abstractions/               # (Optional) Interface definitions subdirectory
│   │   ├── ICustomerRepository.cs
│   │   └── IDepositRepository.cs
│   │
│   ├── ICustomerRepository.cs      # Or directly in Services/
│   ├── IDepositRepository.cs
│   ├── IDepositQueryService.cs     # Service Interface
│   └── DepositQueryService.cs      # Service Implementation
│
├── Repositories/                   # Infrastructure Layer
│   ├── CustomerRepository.cs       # Repository Implementation
│   ├── CustomerRepositoryDecorator.cs
│   ├── DepositRepository.cs
│   └── DepositRepositoryDecorator.cs
│
├── ApiClients/                     # Infrastructure Layer - External Communication
│   ├── Payload/                    # ApiClient-specific Request/Response models
│   │   ├── PaymentGatewayRequest.cs
│   │   └── PaymentGatewayResponse.cs
│   ├── PaymentGatewayApiClient.cs
│   └── NotificationApiClient.cs
│
├── Adapters/                       # Infrastructure Layer - SDK/DLL Integration
│   ├── ExcelAdapter.cs
│   └── QrCodeAdapter.cs
│
├── Middlewares/                    # Cross-Cutting Concerns - Entry Point
│   └── GlobalExceptionMiddleware.cs
│
├── Exceptions/                     # Custom Exceptions
│   ├── PaymentServiceException.cs
│   └── CustomerNotFoundException.cs
│
├── Extensions/                     # Extension Methods
│   ├── StringExtensions.cs
│   └── MiddlewareExtensions.cs
│
└── Service.BLL/                    # Legacy Architecture (maintain as-is)
    Service.DAL/                    # Legacy Architecture (maintain as-is)
```

---

## Directory Depth Rules

### Rule: Directory Depth ≤ 3 Levels

```
PaymentService/           # Level 1
├── Models/               # Level 2
│   ├── Domain/           # Level 3
│   │   └── Customer.cs   # File (doesn't count as level)
```

### Correct Examples

```
✅ PaymentService/Models/Domain/Customer.cs          (3 levels)
✅ PaymentService/Services/DepositQueryService.cs    (2 levels)
✅ PaymentService/Repositories/CustomerRepository.cs (2 levels)
```

### Incorrect Examples

```
❌ PaymentService/Models/Domain/Customer/Entities/Customer.cs  (5 levels)
❌ PaymentService/Features/Deposit/Handlers/V1/Handler.cs       (5 levels)
```

### Exceptions

If deeper levels are truly needed (such as Feature directories), reevaluate the structure or use namespaces to differentiate:

```
// Use namespaces to differentiate instead of deep directories
namespace PaymentService.Features.Deposit.Handlers
{
    public class GetDepositOptionsV1Handler { }
    public class GetDepositOptionsV2Handler { }
}
```

---

## Directory Responsibility Definitions

### Controllers/

| Item | Description |
|------|-------------|
| **Responsibility** | HTTP request handling, input validation, response formatting |
| **Contents** | Controller classes |
| **Naming Convention** | `{Entity}Controller.cs` |

```csharp
// Controllers/CustomerController.cs
namespace PaymentService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CustomerController : ControllerBase
    {
        // HTTP endpoint definitions
    }
}
```

### Models/Domain/

| Item | Description |
|------|-------------|
| **Responsibility** | Core business logic, domain entities, business rules |
| **Contents** | Domain Model classes |
| **Naming Convention** | `{Entity}.cs`, `{Entity}s.cs` (collection) |

```csharp
// Models/Domain/DepositChannel.cs
namespace PaymentService.Models.Domain
{
    public class DepositChannel
    {
        // Properties + Business methods
    }
}

// Models/Domain/DepositChannels.cs (collection)
namespace PaymentService.Models.Domain
{
    public class DepositChannels
    {
        // Collection operation methods
    }
}
```

### Models/ValueObject/

| Item | Description |
|------|-------------|
| **Responsibility** | Value Objects - Identity-less immutable value types |
| **Contents** | Classes that determine equality by property values |
| **Naming Convention** | `{Name}.cs` (noun, describing the concept) |

> For detailed Value Object design guidelines, see [08-Domain-Model-Design-Guide](./08-Domain-Model-Design-Guide.md#value-objects-design)

```csharp
// Models/ValueObject/Period.cs
namespace PaymentService.Models.ValueObject
{
    /// <summary>
    /// Time range value object
    /// </summary>
    public record Period
    {
        public DateTime StartTime { get; init; }
        public DateTime EndTime { get; init; }

        public bool Contains(DateTime dateTime)
        {
            return dateTime >= StartTime && dateTime <= EndTime;
        }
    }
}

// Models/ValueObject/VisibilityRules.cs
namespace PaymentService.Models.ValueObject
{
    /// <summary>
    /// Visibility rules value object
    /// </summary>
    public record VisibilityRules
    {
        public bool RequiresLogin { get; init; }
        public IReadOnlyList<int> AllowedVipLevels { get; init; }

        public bool IsVisibleTo(ViewerContext viewer) { ... }
    }
}
```

### Models/DbModel/

| Item | Description |
|------|-------------|
| **Responsibility** | Database column mapping |
| **Contents** | Classes corresponding to Stored Procedure results |
| **Naming Convention** | `{Entity}.cs` (same name as Domain Model, different namespace) |

```csharp
// Models/DbModel/DepositChannel.cs
namespace PaymentService.Models.DbModel
{
    public class DepositChannel
    {
        // Database columns
        public int DepositType { get; init; }  // int
        public string VipLevel { get; init; }   // JSON string

        // Conversion method
        public Domain.DepositChannel CreateDomain() { ... }
    }
}
```

### Models/Enum/

| Item | Description |
|------|-------------|
| **Responsibility** | Enumeration definitions |
| **Contents** | All Enum classes |
| **Naming Convention** | `{Name}Enum.cs` |

```csharp
// Models/Enum/CurrencyEnum.cs
namespace PaymentService.Models.Enum
{
    public enum CurrencyEnum
    {
        CNY = 1,
        USD = 2,
        // ...
    }
}
```

### Models/Payload/

| Item | Description |
|------|-------------|
| **Responsibility** | API Request/Response models |
| **Contents** | DTO classes |
| **Naming Convention** | `{Action}Request.cs`, `{Action}Response.cs` |

```csharp
// Models/Payload/GetDepositOptionsRequest.cs
namespace PaymentService.Models.Payload
{
    public class GetDepositOptionsRequest
    {
        [Required]
        public int CustId { get; set; }
    }
}
```

### Services/

| Item | Description |
|------|-------------|
| **Responsibility** | Application Layer - Interface definitions + Service implementations |
| **Contents** | Repository interfaces, Service interfaces and implementations |
| **Naming Convention** | `I{Entity}Repository.cs`, `I{Name}Service.cs`, `{Name}Service.cs` |

#### Interface Placement Options

There are two organization approaches. Projects can choose based on scale:

| Approach | Applicable Scenario | Structure |
|----------|---------------------|-----------|
| **Directly in Services/** | Small projects, few interfaces | `Services/ICustomerRepository.cs` |
| **Use Abstractions/ subdirectory** | Medium/large projects, many interfaces | `Services/Abstractions/ICustomerRepository.cs` |

```csharp
// Option 1: Directly in Services/ (small projects)
// Services/ICustomerRepository.cs
namespace PaymentService.Services
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
    }
}

// Option 2: Use Abstractions/ subdirectory (medium/large projects)
// Services/Abstractions/ICustomerRepository.cs
namespace PaymentService.Services.Abstractions
{
    public interface ICustomerRepository
    {
        Task<Customer> GetCustInfoAsync(int custId);
    }
}

// Service implementation (same location regardless of approach)
// Services/DepositQueryService.cs
namespace PaymentService.Services
{
    public class DepositQueryService : IDepositQueryService
    {
        // ...
    }
}
```

### Repositories/

| Item | Description |
|------|-------------|
| **Responsibility** | Infrastructure Layer - Repository implementations |
| **Contents** | Repository implementation classes, Decorators |
| **Naming Convention** | `{Entity}Repository.cs`, `{Entity}RepositoryDecorator.cs` |

```csharp
// Repositories/CustomerRepository.cs
namespace PaymentService.Repositories
{
    public class CustomerRepository : ICustomerRepository
    {
        // Data access implementation
    }
}

// Repositories/CustomerRepositoryDecorator.cs
namespace PaymentService.Repositories
{
    public class CustomerRepositoryDecorator : ICustomerRepository
    {
        // Cache Decorator
    }
}
```

### ApiClients/

| Item | Description |
|------|-------------|
| **Responsibility** | Network communication with internal/external systems (HTTP, Socket, gRPC, etc.) |
| **Contents** | API client classes |
| **Naming Convention** | `{ServiceName}ApiClient.cs` |

```csharp
// ApiClients/PaymentGatewayApiClient.cs
namespace PaymentService.ApiClients
{
    public class PaymentGatewayApiClient : IPaymentGatewayApiClient
    {
        private readonly HttpClient _httpClient;

        public PaymentGatewayApiClient(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request)
        {
            // HTTP request implementation
        }
    }
}

// ApiClients/NotificationApiClient.cs
namespace PaymentService.ApiClients
{
    public class NotificationApiClient : INotificationApiClient
    {
        public async Task SendNotificationAsync(NotificationMessage message)
        {
            // gRPC or other protocol communication
        }
    }
}
```

### ApiClients/Payload/

| Item | Description |
|------|-------------|
| **Responsibility** | ApiClient-specific Request/Response models (DTOs for external system communication) |
| **Contents** | Request and response classes used when ApiClient calls external APIs |
| **Naming Convention** | `{ServiceName}Request.cs`, `{ServiceName}Response.cs` |

> **Difference from Models/Payload/**: `Models/Payload/` stores API models exposed by this service; `ApiClients/Payload/` stores models used when calling external services.

```csharp
// ApiClients/Payload/PaymentGatewayRequest.cs
namespace PaymentService.ApiClients.Payload
{
    public class PaymentGatewayRequest
    {
        public string MerchantId { get; set; }
        public decimal Amount { get; set; }
        public string Currency { get; set; }
        public string CallbackUrl { get; set; }
    }
}

// ApiClients/Payload/PaymentGatewayResponse.cs
namespace PaymentService.ApiClients.Payload
{
    public class PaymentGatewayResponse
    {
        public string TransactionId { get; set; }
        public string Status { get; set; }
        public string RedirectUrl { get; set; }
    }
}
```

### Adapters/

| Item | Description |
|------|-------------|
| **Responsibility** | Wrap third-party SDK/DLL usage, providing unified interfaces |
| **Contents** | Adapter classes |
| **Naming Convention** | `{Name}Adapter.cs` |

```csharp
// Adapters/ExcelAdapter.cs
namespace PaymentService.Adapters
{
    public class ExcelAdapter : IExcelAdapter
    {
        public byte[] GenerateExcel<T>(IEnumerable<T> data, string sheetName)
        {
            // Wrap EPPlus / NPOI SDK operations
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add(sheetName);
            // ...
            return package.GetAsByteArray();
        }

        public IEnumerable<T> ParseExcel<T>(Stream excelStream)
        {
            // Wrap EPPlus / NPOI SDK operations
        }
    }
}

// Adapters/QrCodeAdapter.cs
namespace PaymentService.Adapters
{
    public class QrCodeAdapter : IQrCodeAdapter
    {
        public byte[] GenerateQrCode(string content, int pixelsPerModule = 20)
        {
            // Wrap QRCoder SDK operations
            using var qrGenerator = new QRCodeGenerator();
            var qrCodeData = qrGenerator.CreateQrCode(content, QRCodeGenerator.ECCLevel.Q);
            using var qrCode = new PngByteQRCode(qrCodeData);
            return qrCode.GetGraphic(pixelsPerModule);
        }
    }
}
```

### Middlewares/

| Item | Description |
|------|-------------|
| **Responsibility** | HTTP pipeline middleware |
| **Contents** | Middleware classes |
| **Naming Convention** | `{Name}Middleware.cs` |

```csharp
// Middlewares/GlobalExceptionMiddleware.cs
namespace PaymentService.Middlewares
{
    public class GlobalExceptionMiddleware
    {
        public async Task InvokeAsync(HttpContext context) { ... }
    }
}
```

### Exceptions/

| Item | Description |
|------|-------------|
| **Responsibility** | Custom exception classes |
| **Contents** | Exception classes |
| **Naming Convention** | `{Name}Exception.cs` |

```csharp
// Exceptions/CustomerNotFoundException.cs
namespace PaymentService.Exceptions
{
    public class CustomerNotFoundException : PaymentServiceException
    {
        public CustomerNotFoundException(int custId)
            : base(PaymentError.CustomerNotFound, custId) { }
    }
}
```

### Extensions/

| Item | Description |
|------|-------------|
| **Responsibility** | Extension methods |
| **Contents** | static Extension classes |
| **Naming Convention** | `{Type}Extensions.cs` |

```csharp
// Extensions/StringExtensions.cs
namespace PaymentService.Extensions
{
    public static class StringExtensions
    {
        public static T ParseJson<T>(this string json) { ... }
    }
}
```

---

## Naming Conventions

### File Naming

| Type | Naming Convention | Example |
|------|-------------------|---------|
| Domain Model | `{Entity}.cs` | `Customer.cs` |
| Domain Model Collection | `{Entity}s.cs` or `{Entity}List.cs` | `DepositChannels.cs`, `PromotionList.cs` |
| Value Object | `{Name}.cs` | `Period.cs`, `VisibilityRules.cs` |
| DbModel | `{Entity}.cs` | `Customer.cs` (different namespace) |
| Enum | `{Name}Enum.cs` | `CurrencyEnum.cs` |
| Repository Interface | `I{Entity}Repository.cs` | `ICustomerRepository.cs` |
| Repository Implementation | `{Entity}Repository.cs` | `CustomerRepository.cs` |
| Decorator | `{Entity}RepositoryDecorator.cs` | `CustomerRepositoryDecorator.cs` |
| ApiClient Interface | `I{ServiceName}ApiClient.cs` | `IPaymentGatewayApiClient.cs` |
| ApiClient Implementation | `{ServiceName}ApiClient.cs` | `PaymentGatewayApiClient.cs` |
| ApiClient Payload | `{ServiceName}Request.cs`, `{ServiceName}Response.cs` | `PaymentGatewayRequest.cs` |
| Adapter Interface | `I{Name}Adapter.cs` | `IExcelAdapter.cs` |
| Adapter Implementation | `{Name}Adapter.cs` | `ExcelAdapter.cs` |
| Service Interface | `I{Name}Service.cs` | `IDepositQueryService.cs` |
| Service Implementation | `{Name}Service.cs` | `DepositQueryService.cs` |
| Controller | `{Entity}Controller.cs` | `CustomerController.cs` |
| Middleware | `{Name}Middleware.cs` | `GlobalExceptionMiddleware.cs` |
| Exception | `{Name}Exception.cs` | `CustomerNotFoundException.cs` |
| Extension | `{Type}Extensions.cs` | `StringExtensions.cs` |

### Enum Suffix Rule

All enumeration classes must have the `Enum` suffix:

```csharp
// ✅ Correct: has Enum suffix
public enum CurrencyEnum { }
public enum DepositTypeEnum { }
public enum ErrorSeverityEnum { }

// ❌ Wrong: missing Enum suffix
public enum Currency { }
public enum DepositType { }
```

---

## Decision Flow for Adding New Classes

### Decision Flow Chart

```
New Class
    │
    ├─ Is it a business entity with identity?
    │   ├─ Yes → Models/Domain/
    │   └─ No ↓
    │
    ├─ Is it an identity-less value type? (e.g., time range, rule set)
    │   ├─ Yes → Models/ValueObject/
    │   └─ No ↓
    │
    ├─ Is it database mapping?
    │   ├─ Yes → Models/DbModel/
    │   └─ No ↓
    │
    ├─ Is it API Request/Response?
    │   ├─ Yes → Models/Payload/
    │   └─ No ↓
    │
    ├─ Is it an enumeration?
    │   ├─ Yes → Models/Enum/
    │   └─ No ↓
    │
    ├─ Is it a Repository interface?
    │   ├─ Yes → Services/ or Services/Abstractions/
    │   └─ No ↓
    │
    ├─ Is it a Repository implementation?
    │   ├─ Yes → Repositories/
    │   └─ No ↓
    │
    ├─ Is it an external system communication client? (HTTP, Socket, gRPC)
    │   ├─ Yes → ApiClients/
    │   └─ No ↓
    │
    ├─ Is it a Request/Response model for calling external APIs?
    │   ├─ Yes → ApiClients/Payload/
    │   └─ No ↓
    │
    ├─ Is it a wrapper for third-party SDK/DLL?
    │   ├─ Yes → Adapters/
    │   └─ No ↓
    │
    ├─ Is it a Service?
    │   ├─ Yes → Services/
    │   └─ No ↓
    │
    ├─ Is it a Controller?
    │   ├─ Yes → Controllers/
    │   └─ No ↓
    │
    ├─ Is it Middleware?
    │   ├─ Yes → Middlewares/
    │   └─ No ↓
    │
    ├─ Is it an Exception?
    │   ├─ Yes → Exceptions/
    │   └─ No ↓
    │
    └─ Is it an Extension?
        ├─ Yes → Extensions/
        └─ No → Evaluate if new directory is needed
```

### Quick Reference Table

| I want to add... | Where to put it? | Naming Convention |
|------------------|------------------|-------------------|
| New Domain Model | `Models/Domain/` | `{Entity}.cs` |
| Value Object (no ID) | `Models/ValueObject/` | `{Name}.cs` |
| DbModel for SP result | `Models/DbModel/` | `{Entity}.cs` |
| API request model | `Models/Payload/` | `{Action}Request.cs` |
| New enumeration | `Models/Enum/` | `{Name}Enum.cs` |
| Repository interface | `Services/` or `Services/Abstractions/` | `I{Entity}Repository.cs` |
| Repository implementation | `Repositories/` | `{Entity}Repository.cs` |
| Cache Decorator | `Repositories/` | `{Entity}RepositoryDecorator.cs` |
| ApiClient interface | `Services/` or `Services/Abstractions/` | `I{ServiceName}ApiClient.cs` |
| ApiClient implementation | `ApiClients/` | `{ServiceName}ApiClient.cs` |
| ApiClient-specific Payload | `ApiClients/Payload/` | `{ServiceName}Request.cs` |
| Adapter interface | `Services/` or `Services/Abstractions/` | `I{Name}Adapter.cs` |
| Adapter implementation | `Adapters/` | `{Name}Adapter.cs` |
| Service | `Services/` | `{Name}Service.cs` |
| Controller | `Controllers/` | `{Entity}Controller.cs` |
| Custom exception | `Exceptions/` | `{Name}Exception.cs` |

---

## Review Checklist

### Directory Structure Check

- [ ] Is the new class in the correct directory?
- [ ] Is directory depth ≤ 3 levels?
- [ ] Does naming follow conventions?
- [ ] Do Enums have `Enum` suffix?

### Namespace Check

- [ ] Is the namespace consistent with directory structure?
- [ ] Is the Repository interface in `Services` (or `Services.Abstractions`) namespace?
- [ ] Is the Repository implementation in `Repositories` namespace?

### Responsibility Check

- [ ] Is Domain Model (has ID) in `Models/Domain/`?
- [ ] Is Value Object (no ID) in `Models/ValueObject/`?
- [ ] Is DbModel in `Models/DbModel/`?
- [ ] Is there business logic in the wrong location?

---

## Common Pitfalls for New Developers

### 1. Repository Interface in Repositories Directory

```
❌ Wrong:
Repositories/
├── ICustomerRepository.cs    # Interface should not be here
└── CustomerRepository.cs

✅ Correct:
Services/
└── ICustomerRepository.cs    # Interface in Services
Repositories/
└── CustomerRepository.cs     # Implementation in Repositories
```

### 2. Forgetting Enum Suffix

```csharp
// ❌ Wrong: missing Enum suffix
public enum Currency { CNY, USD }

// ✅ Correct: add Enum suffix
public enum CurrencyEnum { CNY, USD }
```

### 3. Directory Depth Too Deep

```
❌ Wrong: 5 level directory
PaymentService/Models/Domain/Customer/Entities/Customer.cs

✅ Correct: 3 level directory
PaymentService/Models/Domain/Customer.cs
```

### 4. Adding Clean Architecture Classes to Legacy Architecture Directory

```
❌ Wrong: add to legacy architecture directory
Service.DAL/CustomerRepository.cs

✅ Correct: add to new architecture directory
Repositories/CustomerRepository.cs
```

### 5. Mixing DbModel and Domain Model

```csharp
// ❌ Wrong: Domain Model in DbModel directory
namespace PaymentService.Models.DbModel
{
    public class Customer  // This is a Domain Model!
    {
        public bool IsVipLevelInScope(...) { ... }  // Business method
    }
}

// ✅ Correct: separate placement
namespace PaymentService.Models.DbModel
{
    public class Customer
    {
        public int VipLevel { get; init; }
        public Domain.Customer CreateDomain() { ... }
    }
}

namespace PaymentService.Models.Domain
{
    public class Customer
    {
        public int VipLevel { get; init; }
        public bool IsVipLevelInScope(...) { ... }
    }
}
```

---

## TL / Reviewer Checkpoint

### Structure Review

| Check Item | Warning Signal |
|------------|----------------|
| Directory depth | Directory structure exceeding 3 levels |
| Interface location | `IXxxRepository.cs` in `Repositories/` directory |
| Legacy architecture mixing | New classes in `Service.DAL/` or `Service.BLL/` |
| Inconsistent naming | Enum missing `Enum` suffix |

### Namespace Review

- [ ] Is the class namespace consistent with file path?
- [ ] Is there cross-layer using (e.g., Domain referencing Repositories)?

### Responsibility Boundary Review

- [ ] Do classes in `Models/Domain/` only contain business logic?
- [ ] Do classes in `Models/DbModel/` only have data mapping?
- [ ] Does `Services/` only have interfaces and Service implementations?

---

> **Document Version**: v1.4
> **Last Updated**: 2026-01
> **Changes**: Added `ApiClients/Payload/` directory (ApiClient-specific Request/Response models)
