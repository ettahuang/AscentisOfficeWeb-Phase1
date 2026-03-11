# C# Coding Conventions

This document defines the coding standards and formatting guidelines for C# code in this project.

---

## Class Member Ordering

Class members should be arranged in the following order:

| Order | Member Type | Description |
|-------|-------------|-------------|
| 1 | Constants | `const` constants |
| 2 | Static readonly fields | `static readonly` fields |
| 3 | Instance fields | Instance fields (`readonly` first) |
| 4 | Static constructor | Static constructor |
| 5 | Constructors | Instance constructors (public → protected → private) |
| 6 | Public properties | Public properties |
| 7 | Public methods | Public methods |
| 8 | Protected/Internal methods | Protected/Internal methods |
| 9 | Private methods | Private methods |
| 10 | Nested types | Nested classes/structs/enums |

### Example

```csharp
public class CustomerService : ICustomerService
{
    // 1. Constants
    private const int MaxRetryCount = 3;
    private const string CacheKeyPrefix = "Customer:";

    // 2. Static readonly fields
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    // 3. Instance fields (readonly first)
    private readonly ICustomerRepository _customerRepository;
    private readonly ILogger<CustomerService> _logger;
    private int _retryCount;

    // 4. Static constructor (if needed)
    static CustomerService()
    {
        // Static initialization
    }

    // 5. Constructors
    public CustomerService(
        ICustomerRepository customerRepository,
        ILogger<CustomerService> logger)
    {
        _customerRepository = customerRepository;
        _logger = logger;
    }

    // 6. Public properties
    public int RetryCount => _retryCount;

    // 7. Public methods
    public async Task<Customer> GetCustomerAsync(int customerId)
    {
        // Implementation
    }

    // 8. Private methods
    private string GenerateCacheKey(int customerId)
    {
        return $"{CacheKeyPrefix}{customerId}";
    }
}
```

---

## Region Usage Guidelines

### Production Code: Do NOT use `#region`

**Reasons:**
- `#region` hides complexity rather than solving it
- Needing `#region` to organize code usually indicates the class should be split
- Modern IDEs (VS/Rider) provide structure view, outline, and navigation features
- Adds maintenance burden - must keep region names consistent with code

```csharp
// ❌ Not recommended in Production Code
#region Database Operations
public async Task<Customer> GetCustomerAsync(int id) { }
public async Task SaveCustomerAsync(Customer customer) { }
#endregion

// ✅ Recommended: Organize through good method naming and class splitting
public async Task<Customer> GetCustomerAsync(int id) { }
public async Task SaveCustomerAsync(Customer customer) { }
```

### Test Code: MAY use `#region`

Test code may use `#region` because:
- Test classes often have lengthy setup/arrange code
- Not refactored as frequently as production code
- `#region` helps quickly navigate to specific test sections

```csharp
// ✅ Test code may use region
public class CustomerServiceTests
{
    #region GetCustomerAsync Tests

    [Test]
    public async Task GetCustomerAsync_WhenCustomerExists_ShouldReturnCustomer()
    {
        // Test implementation
    }

    [Test]
    public async Task GetCustomerAsync_WhenCustomerNotFound_ShouldReturnNull()
    {
        // Test implementation
    }

    #endregion

    #region SaveCustomerAsync Tests
    // ...
    #endregion
}
```

### Test Infrastructure Code: Do NOT use `#region`

Test infrastructure code (Fixtures, Test Utilities) is closer to production code in nature and should follow the same standards:

```csharp
// ❌ Test Fixture should not use region
public class MySqlContainerFixture : IAsyncDisposable
{
    #region Fields
    // ...
    #endregion
}

// ✅ Test Fixture should arrange members in order
public class MySqlContainerFixture : IAsyncDisposable
{
    private const string ContainerName = "test-mysql";
    private readonly Dictionary<string, string> _connectionStrings = new();
    // ...
}
```

---

## Namespace Declaration

Use file-scoped namespace to reduce indentation levels:

```csharp
// ✅ Recommended: File-scoped namespace
namespace BonusService.Services;

public class CustomerService
{
    // Implementation
}

// ❌ Not recommended: Block-scoped namespace
namespace BonusService.Services
{
    public class CustomerService
    {
        // Implementation
    }
}
```

---

## Using Statement Ordering

Using statements should be arranged in the following order, with no blank lines between groups:

1. System namespaces
2. Microsoft namespaces
3. Third-party namespaces (alphabetically)
4. Project namespaces

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using NSubstitute;
using BonusService.Models.Domain;
using BonusService.Services;
```

---

## Static Modifier

If a method does not depend on instance state, it should be marked as `static`:

```csharp
// ✅ Methods not depending on instance state should be static
private static bool IsValidEmail(string email)
{
    return email.Contains("@");
}

private static int CalculateDiscount(decimal amount, decimal rate)
{
    return (int)(amount * rate);
}
```

---

## Summary Checklist

### Formatting Check

- [ ] Class members arranged in specified order
- [ ] Production code does not use `#region`
- [ ] Uses file-scoped namespace
- [ ] Using statements correctly ordered
- [ ] Methods not depending on instance state marked as `static`

### Code Review Focus Points

| Check Item | Warning Signal |
|------------|----------------|
| Class too large | Over 300 lines, needs `#region` to organize |
| Member order chaotic | Public method appears before private field |
| Missing static | Utility methods not marked as static |

---

> **Document Version**: v1.0
> **Last Updated**: 2024-12
