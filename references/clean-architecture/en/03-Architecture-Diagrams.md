# Architecture Diagrams

> This document provides various architecture visualization diagrams for the PaymentService project, using Mermaid syntax to support Confluence and GitHub rendering.

---

## Concentric Circle Architecture Diagram

### Clean Architecture Layering Illustration

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#e1f5fe', 'secondaryColor': '#fff3e0', 'tertiaryColor': '#f3e5f5'}}}%%
flowchart TB
    subgraph Infrastructure["Infrastructure Layer"]
        subgraph Application["Application Layer"]
            subgraph Domain["Domain Layer"]
                DM[Domain Models<br/>Customer, DepositChannel<br/>DepositChannels]
            end
            SVC[Services<br/>DepositQueryService]
            INT[Interfaces<br/>ICustomerRepository<br/>IDepositRepository]
        end
        REPO[Repositories<br/>CustomerRepository<br/>DepositRepository]
        DEC[Decorators<br/>CustomerRepositoryDecorator<br/>DepositRepositoryDecorator]
        DB[(Database)]
        CACHE[(Redis Cache)]
    end

    DM --> INT
    SVC --> INT
    INT -.->|implements| REPO
    INT -.->|implements| DEC
    REPO --> DB
    DEC --> CACHE
```

### Dependency Direction Diagram

```mermaid
flowchart LR
    subgraph Outer["Outer (Infrastructure)"]
        REPO[Repository Implementation]
        DEC[Decorator]
    end

    subgraph Middle["Middle (Application)"]
        SVC[Service]
        IFACE[Interface]
    end

    subgraph Inner["Inner (Domain)"]
        DOM[Domain Model]
    end

    REPO -->|depends on| IFACE
    DEC -->|depends on| IFACE
    SVC -->|depends on| IFACE
    SVC -->|depends on| DOM
    IFACE -->|depends on| DOM

    style Inner fill:#c8e6c9
    style Middle fill:#fff9c4
    style Outer fill:#ffcdd2
```

**Key Principle**: Dependency direction is always from outside to inside; inner layers don't know outer layers exist.

---

## Complete Request Flow Diagram

### GetDepositOptionsAsync API Flow

```mermaid
sequenceDiagram
    participant Client
    participant MW as Middleware
    participant Ctrl as Controller
    participant Svc as DepositQueryService
    participant CustRepo as CustomerRepository
    participant DepRepo as DepositRepository
    participant Cache as Redis
    participant DB as MySQL

    Client->>MW: HTTP Request
    MW->>MW: GlobalExceptionMiddleware
    MW->>Ctrl: GetDepositOptions(custId)

    Ctrl->>Svc: GetDepositChannelsByDepositTypeAsync(custId)

    Svc->>CustRepo: GetCustContextAsync(custId)
    Note over CustRepo: Decorator Layer
    CustRepo->>Cache: TryGet("CustomerContext:{custId}")

    alt Cache Hit
        Cache-->>CustRepo: CustomerContext
    else Cache Miss
        CustRepo->>DB: Customer_Get SP
        DB-->>CustRepo: DbModel.Customer
        Note over CustRepo: CreateDomain() conversion
        CustRepo->>Cache: Set("CustomerContext:{custId}")
    end

    CustRepo-->>Svc: CustomerContext

    Svc->>DepRepo: GetDepositChannelsAsync(siteId)
    Note over DepRepo: Decorator Layer
    DepRepo->>Cache: TryGet("DepositChannels:{siteId}")

    alt Cache Hit
        Cache-->>DepRepo: DepositChannels
    else Cache Miss
        DepRepo->>DB: DepositChannel_Get SP
        DB-->>DepRepo: List<DbModel.DepositChannel>
        Note over DepRepo: CreateDomain() conversion
        DepRepo->>Cache: Set("DepositChannels:{siteId}")
    end

    DepRepo-->>Svc: DepositChannels

    Note over Svc: Delegate business logic to Domain Model
    Svc->>Svc: depositChannels.GroupByDepositType(custContext)

    Svc-->>Ctrl: DepositChannelsByDepositType
    Ctrl-->>MW: ApiResult
    MW-->>Client: HTTP Response
```

---

## Decorator Pattern Architecture Diagram

### Repository Decorator Structure

```mermaid
classDiagram
    class ICustomerRepository {
        <<interface>>
        +GetCustInfoAsync(custId) Task~Customer~
        +GetPointLevelAsync(custId) Task~int~
        +GetCustContextAsync(custId) Task~CustomerContext~
    }

    class CustomerRepository {
        -MySqlClient _mainDbClient
        +GetCustInfoAsync(custId) Task~Customer~
        +GetPointLevelAsync(custId) Task~int~
        +GetCustContextAsync(custId) Task~CustomerContext~
    }

    class CustomerRepositoryDecorator {
        -ICustomerRepository _customerRepository
        -ICacheHelper _cacheHelper
        +GetCustInfoAsync(custId) Task~Customer~
        +GetPointLevelAsync(custId) Task~int~
        +GetCustContextAsync(custId) Task~CustomerContext~
    }

    ICustomerRepository <|.. CustomerRepository : implements
    ICustomerRepository <|.. CustomerRepositoryDecorator : implements
    CustomerRepositoryDecorator --> ICustomerRepository : wraps
```

### DI Registration and Call Flow

```mermaid
flowchart LR
    subgraph DI["DI Container"]
        REG1[AddScoped&lt;ICustomerRepository, CustomerRepository&gt;]
        REG2[Decorate&lt;ICustomerRepository, CustomerRepositoryDecorator&gt;]
    end

    subgraph Runtime["Runtime"]
        SVC[Service]
        DEC[CustomerRepositoryDecorator]
        REPO[CustomerRepository]
        CACHE[(Redis)]
        DB[(MySQL)]
    end

    REG1 --> REG2
    SVC -->|inject ICustomerRepository| DEC
    DEC -->|wraps| REPO
    DEC --> CACHE
    REPO --> DB

    style DEC fill:#fff9c4
    style REPO fill:#c8e6c9
```

---

## Domain Model Structure Diagram

### Deposit-Related Domain Models

```mermaid
classDiagram
    class Customer {
        +int CustId
        +int SiteId
        +int VipLevel
        +List~int~ Tags
        +CurrencyEnum Currency
        +IsVipLevelInScope(scopeVipLevels) bool
        +IsTagInScope(scopeTags) bool
        +IsCurrencyOf(currency) bool
    }

    class CustomerContext {
        +Customer Customer
        +int PointLevel
        +IsCurrencyOf(currency) bool
        +IsReachedPointLevel(requiredLevel) bool
        +IsVipLevelInScope(scopeVipLevels) bool
        +IsTagInScope(scopeTags) bool
    }

    class DepositChannel {
        +CurrencyEnum Currency
        +DepositTypeEnum DepositType
        +List~int~ VipLevels
        +List~int~ ExcludeTags
        +int PointLevel
        +decimal MinAmount
        +decimal MaxAmount
        +IsSupported(custContext) bool
        +IsOverlappingWith(limitInfo) bool
        +WithAmountLimit(limitInfo) DepositChannel
    }

    class DepositChannels {
        +List~DepositChannel~ Items
        +GroupByDepositType(custContext) DepositChannelsByDepositType
        +FilterSupported(custContext) DepositChannels
    }

    class DepositLimitInfo {
        +CurrencyEnum Currency
        +DepositTypeEnum DepositType
        +int VipLevel
        +decimal MinAmount
        +decimal MaxAmount
        +IsValidAmountRange() bool
    }

    CustomerContext --> Customer : contains
    DepositChannels --> DepositChannel : contains many
    DepositChannel ..> CustomerContext : uses
    DepositChannel ..> DepositLimitInfo : uses
```

### DbModel and Domain Model Separation

```mermaid
flowchart LR
    subgraph Database
        DBCust[DbModel.Customer<br/>SysId, CustId, VipLevel<br/>Tags JSON, CurrencyId]
        DBChannel[DbModel.DepositChannel<br/>SysId, PayId, VipLevel JSON<br/>TagExcludeList JSON]
    end

    subgraph Domain
        DomCust[Domain.Customer<br/>CustId, VipLevel<br/>Tags List, Currency Enum]
        DomChannel[Domain.DepositChannel<br/>DepositType, VipLevels List<br/>ExcludeTags List]
    end

    DBCust -->| CreateDomain | DomCust
    DBChannel -->| CreateDomain | DomChannel

    style Database fill:#ffcdd2
    style Domain fill:#c8e6c9
```

---

## Exception Handling Flow Diagram

### GlobalExceptionMiddleware Processing Flow

```mermaid
flowchart TD
    REQ[HTTP Request] --> MW[GlobalExceptionMiddleware]
    MW --> TRY{try}
    TRY -->|normal| NEXT[Next Middleware / Controller]
    NEXT --> RESP[HTTP Response]

    TRY -->|Exception| CATCH{Exception Type?}

    CATCH -->|PaymentServiceException| BIZ[Business Exception Handling]
    BIZ --> BIZ_LOG[Log Warning/Error]
    BIZ --> BIZ_RESP[HTTP 200<br/>+ Business Error Code]

    CATCH -->|Other Exception| SYS[System Exception Handling]
    SYS --> SYS_LOG[Log Error]
    SYS --> SYS_RESP[HTTP 500<br/>+ SystemError]

    BIZ_RESP --> JSON[JSON Response<br/>ApiResult.Failure]
    SYS_RESP --> JSON
```

### PaymentError Structure

```mermaid
classDiagram
    class PaymentError {
        +int Code
        +string Key
        +string MessageTemplate
        +ErrorCategoryEnum Category
        +ErrorSeverityEnum Severity
        +FormatMessage(args) string
        +GetLogLevel() LogLevel
    }

    class PaymentServiceException {
        +PaymentError Error
        +object[] Args
        +string Message
    }

    class ErrorCategoryEnum {
        <<enumeration>>
        System
        Customer
        Deposit
        Withdrawal
    }

    class ErrorSeverityEnum {
        <<enumeration>>
        None
        Warning
        Error
        Critical
    }

    PaymentServiceException --> PaymentError : contains
    PaymentError --> ErrorCategoryEnum : uses
    PaymentError --> ErrorSeverityEnum : uses
```

---

## Testing Architecture Diagram

### Test Project Structure

```mermaid
flowchart TB
    subgraph TestProjects["Test Projects"]
        UT[PaymentService.UnitTests<br/>Unit Tests]
        IT[PaymentService.IntegrationTests<br/>Integration Tests]
        TS[PaymentService.TestShared<br/>Shared Test Resources]
    end

    subgraph UnitTests["Unit Test Scope"]
        DT[Domain Model Tests]
        ST[Service Tests]
    end

    subgraph IntegrationTests["Integration Test Scope"]
        RT[Repository Tests]
        TC[Testcontainers<br/>MySQL]
    end

    subgraph SharedResources["Shared Resources"]
        BD[Test Builders<br/>Domain/DbModel]
        CN[Constants]
    end

    UT --> UnitTests
    IT --> IntegrationTests
    TS --> SharedResources

    UnitTests -.->|uses| SharedResources
    IntegrationTests -.->|uses| SharedResources
```

### Test Builder Pattern

```mermaid
classDiagram
    class DepositChannelBuilder {
        -DepositTypeEnum _depositType
        -CurrencyEnum _currency
        -List~int~ _vipLevels
        -decimal _minAmount
        -decimal _maxAmount
        +With(...) DepositChannelBuilder
        +Build() DepositChannel
    }

    class CustomerContextBuilder {
        -CurrencyEnum _currency
        -int _vipLevel
        -int _pointLevel
        -List~int~ _tags
        +With(...) CustomerContextBuilder
        +Build() CustomerContext
    }

    class DepositChannel {
        <<Domain Model>>
    }

    class CustomerContext {
        <<Domain Model>>
    }

    DepositChannelBuilder ..> DepositChannel : creates
    CustomerContextBuilder ..> CustomerContext : creates
```

---

## Project Directory Structure Diagram

```
PaymentService/
├── Controllers/                    # Presentation Layer
│   └── CustomerController.cs
│
├── Models/
│   ├── Domain/                     # Domain Layer
│   │   ├── Customer.cs
│   │   ├── CustomerContext.cs
│   │   ├── DepositChannel.cs
│   │   ├── DepositChannels.cs
│   │   ├── DepositChannelsByDepositType.cs
│   │   ├── DepositLimitInfo.cs
│   │   └── DepositLimitInfos.cs
│   │
│   ├── DbModel/                    # Database Mapping
│   │   ├── Customer.cs
│   │   ├── DepositChannel.cs
│   │   └── DepositLimitInfo.cs
│   │
│   ├── Enum/                       # Enumerations
│   │   ├── CurrencyEnum.cs
│   │   ├── DepositTypeEnum.cs
│   │   ├── ErrorCategoryEnum.cs
│   │   └── ErrorSeverityEnum.cs
│   │
│   ├── Payload/                    # API Models
│   │   └── GetDepositOptionsRequest.cs
│   │
│   ├── ApiResult.cs
│   └── PaymentError.cs
│
├── Services/                       # Application Layer
│   ├── ICustomerRepository.cs      # Interface
│   ├── IDepositRepository.cs       # Interface
│   ├── IDepositQueryService.cs     # Interface
│   └── DepositQueryService.cs      # Implementation
│
├── Repositories/                   # Infrastructure Layer
│   ├── CustomerRepository.cs
│   ├── CustomerRepositoryDecorator.cs
│   ├── DepositRepository.cs
│   └── DepositRepositoryDecorator.cs
│
├── Middlewares/                    # Cross-Cutting Concerns
│   └── GlobalExceptionMiddleware.cs
│
├── Exceptions/                     # Custom Exceptions
│   ├── PaymentServiceException.cs
│   └── CustomerNotFoundException.cs
│
└── Extensions/                     # Extension Methods
    ├── StringExtensions.cs
    └── MiddlewareExtensions.cs
```

---

## Review Checklist

### Diagram Reading Confirmation

- [ ] I understand the concentric circle architecture dependency direction (outside to inside)
- [ ] I can identify where Decorator acts in the flow diagram
- [ ] I understand when Domain Model and DbModel conversion occurs
- [ ] I know the exception handling classification logic (business exception vs system exception)

### Architecture Understanding Confirmation

- [ ] I can explain why Repository interfaces are defined in the Services/ directory
- [ ] I can explain how Decorator pattern achieves cache separation
- [ ] I can describe how a complete API request flows through each layer

---

## Common Pitfalls for New Developers

### 1. Misunderstanding Dependency Direction

```
❌ Wrong Understanding:
Domain → Application → Infrastructure (inside to outside)

✅ Correct Understanding:
Infrastructure → Application → Domain (outside to inside)
Dependency direction: Outer layers depend on inner layers, inner layers don't know outer layers exist
```

### 2. Confusing Decorator with Inheritance

```mermaid
flowchart LR
    subgraph Wrong["❌ Wrong: Inheritance"]
        BASE[CustomerRepository]
        CHILD[CachedCustomerRepository]
        BASE -->|inherits| CHILD
    end

    subgraph Correct["✅ Correct: Composition"]
        IFACE[ICustomerRepository]
        IMPL[CustomerRepository]
        DEC[CustomerRepositoryDecorator]
        IFACE -.->|implements| IMPL
        IFACE -.->|implements| DEC
        DEC -->|wraps| IFACE
    end
```

### 3. Handling Exceptions at the Wrong Layer

```
❌ Wrong: Catch in Repository and return null
✅ Correct: Let exception propagate up, let GlobalExceptionMiddleware handle uniformly
```

---

## TL / Reviewer Checkpoint

### Architecture Diagram Consistency

- [ ] Can new feature classes be correctly placed in existing architecture diagrams?
- [ ] Do dependency relationships violate layering principles?
- [ ] Are there any cross-layer direct dependencies?

### Flow Completeness

- [ ] Is the exception handling path complete?
- [ ] Is the caching strategy consistent?
- [ ] Are there any missing cross-cutting concerns?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
