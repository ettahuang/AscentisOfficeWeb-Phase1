---
name: csharp-style
description: |
  C# 編碼風格與命名規範指南。
  Use when: 撰寫 C# 程式碼、進行 code review、
  討論命名規範、格式化風格、或任何 C# 開發最佳實踐。
---

# C# Coding Guidelines

## Overview

This skill provides C# coding style and naming conventions for consistent and maintainable code.

## Language Policy

- **AI responds**: Default to Traditional Chinese (繁體中文) unless the user specifies otherwise

## When to Apply

- Writing new C# code
- Reviewing C# pull requests
- Discussing naming conventions
- Setting up code formatting rules
- Refactoring existing code

## Detailed Documentation

| Language | File |
|----------|------|
| English | [en/CSharpCodingGuidelines.md](en/CSharpCodingGuidelines.md) |
| 繁體中文 | [zh-TW/CSharp程式碼編寫規範.md](zh-TW/CSharp程式碼編寫規範.md) |

## Quick Reference

## Naming Conventions

### General Rules

| Element | Convention | Example |
|---------|------------|---------|
| Namespace | PascalCase | `Company.Project.Core` |
| Class | PascalCase | `DataService` |
| Interface | I + PascalCase | `IDataService` |
| Method | PascalCase | `GetDataAsync` |
| Property | PascalCase | `RequestId` |
| Public Field | PascalCase | `MaxRetryCount` |
| Private Field | _camelCase | `_connectionId` |
| Parameter | camelCase | `userId` |
| Local Variable | camelCase | `itemCount` |
| Constant | PascalCase | `DefaultTimeout` |

### Async Methods

- Always suffix async methods with `Async`
- Example: `GetDataAsync`, `ProcessItemsAsync`

## Class Structure Order

1. Constants
2. Private readonly fields
3. Private mutable fields
4. Constructor(s)
5. Public properties
6. Public methods
7. Private methods

## Code Style

### File-Scoped Namespaces (Preferred)

```csharp
namespace Company.Project.Core;

public class DataService
{
    // ...
}
```

### Expression-Bodied Members

```csharp
// Property
public string Name => _name;

// Method (single statement)
public int Calculate() => _value * 2;
```

### Records for DTOs

```csharp
public record CustomerDto(int Id, string Name, string Email);
```

### Init-Only Properties

```csharp
public class Config
{
    public string ConnectionString { get; init; }
    public int Timeout { get; init; }
}
```

## Best Practices

1. **Prefer `readonly`** for fields that don't change after construction
2. **Use `var`** when the type is obvious from the right side
3. **Prefer pattern matching** over type checking and casting
4. **Use string interpolation** over concatenation
5. **Prefer `nameof()`** over hardcoded strings for member names
6. **Use `using` declarations** instead of `using` blocks when possible

## Error Handling

```csharp
try
{
    await ProcessDataAsync(data);
}
catch (ValidationException ex)
{
    _logger.LogWarning(ex, "Validation failed for {DataType}", typeof(T).Name);
    throw;
}
catch (Exception ex)
{
    _logger.LogError(ex, "Unexpected error processing {DataType}", typeof(T).Name);
    throw;
}
```

## Testing Conventions

### Test Method Naming

```
MethodName_Scenario_ExpectedResult
```

Example:
- `GetUser_WithValidId_ReturnsUser`
- `ProcessPayment_WithInsufficientFunds_ThrowsException`

### Test Structure (AAA Pattern)

```csharp
[Fact]
public async Task GetUser_WithValidId_ReturnsUser()
{
    // Arrange
    var userId = 1;
    var expected = new User { Id = userId };

    // Act
    var result = await _service.GetUserAsync(userId);

    // Assert
    result.Should().BeEquivalentTo(expected);
}
```

For complete guidelines, refer to [en/CSharpCodingGuidelines.md](en/CSharpCodingGuidelines.md) or [zh-TW/CSharp程式碼編寫規範.md](zh-TW/CSharp程式碼編寫規範.md).
