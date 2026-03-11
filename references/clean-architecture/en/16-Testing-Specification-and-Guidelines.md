# Testing Specification and Guidelines

## Table of Contents

1. [Overview](#overview)
2. [Test Project Structure](#test-project-structure)
3. [Unit Test Specification](#unit-test-specification)
4. [Given-When-Then Pattern](#given-when-then-pattern)
5. [Test Builder Pattern](#test-builder-pattern)
6. [FluentAssertions Usage Guide](#fluentassertions-usage-guide)
7. [NSubstitute Mock Framework](#nsubstitute-mock-framework)
8. [Test Naming Conventions](#test-naming-conventions)
9. [Test Coverage Requirements](#test-coverage-requirements)

---

## Overview

This document defines the testing specifications and best practices for the PaymentService project, ensuring test code has high readability, maintainability, and reliability.

### Core Principles

1. **Test Isolation**: Each test runs independently, not depending on other tests' state
2. **Readability First**: Test code is documentation, use Given-When-Then structure
3. **Fast Feedback**: Unit Tests should complete in milliseconds
4. **Determinism**: Test results must be stable and reproducible

---

## Test Project Structure

```
PaymentService/
├── PaymentService.UnitTests/           # Unit Test Project
│   ├── Models/
│   │   └── Domain/                     # Domain Model Tests
│   │       ├── DepositChannelTests.cs
│   │       ├── DepositChannelsTests.cs
│   │       ├── CustomerTests.cs
│   │       └── CustomerContextTests.cs
│   └── Services/                       # Service Layer Tests
│       └── DepositQueryServiceTests.cs
│
├── PaymentService.IntegrationTests/    # Integration Test Project
│   ├── Fixtures/                       # Test Infrastructure
│   │   ├── MySqlContainerFixture.cs
│   │   └── TestDataManagerBase.cs
│   ├── PrimitiveModels/                # Primitive Data Models
│   │   └── PrimitiveCustomer.cs
│   └── CustomerRepositoryTests.cs
│
└── PaymentService.TestShared/          # Shared Test Utilities
    └── Builders/                       # Test Builders
        ├── Domain/
        │   ├── DepositChannelBuilder.cs
        │   └── CustomerContextBuilder.cs
        └── Constants.cs
```

### Project Responsibility Separation

| Project | Responsibility | Execution Speed |
|---------|----------------|-----------------|
| `UnitTests` | Test Domain Model and Service logic | Milliseconds |
| `IntegrationTests` | Test Repository and database interaction | Seconds |
| `TestShared` | Provide shared Builders and constants | - |

### Repository Testing Strategy

> **Important Rule**: Repositories only require integration tests, not unit tests.

| Component Type | Unit Tests | Integration Tests | Description |
|----------------|------------|-------------------|-------------|
| Domain Model | ✅ Required | ❌ Not required | Verify business logic, immutability |
| Service Layer | ✅ Required | ⚪ Optional | Mock Repository to verify logic |
| **Repository** | ❌ Not required | ✅ Required | Verify SP calls and data conversion |
| Repository Decorator | ✅ Optional | ❌ Not required | Verify caching logic |

For detailed explanation, see [09-Repository-Pattern](./09-Repository-Pattern.md#repository-testing).

---

## Unit Test Specification

### Test Class Structure

```csharp
[TestFixture]
public class DepositChannelTests
{
    #region Constructor Tests
    // Constructor related tests
    #endregion

    #region IsSupported Tests
    // IsSupported method tests
    #endregion

    #region WithAmountLimit Tests
    // WithAmountLimit method tests
    #endregion

    #region Helper Methods
    // Test helper methods
    #endregion
}
```

**Specification Points**:
- Use `#region` to group tests by method
- Helper methods go in `Helper Methods` region
- Each test method tests only one behavior

### SetUp and TearDown

```csharp
[TestFixture]
public class DepositQueryServiceTests
{
    private ICustomerRepository _customerRepository;
    private IDepositRepository _depositRepository;
    private IDepositQueryService _service;

    [SetUp]
    public void SetUp()
    {
        // Create Mock using NSubstitute
        _customerRepository = Substitute.For<ICustomerRepository>();
        _depositRepository = Substitute.For<IDepositRepository>();

        // Create system under test
        _service = new DepositQueryService(_customerRepository, _depositRepository);
    }
}
```

---

## Given-When-Then Pattern

### Basic Structure

```csharp
[Test]
public void IsSupported_WhenAllConditionsMet_ShouldReturnTrue()
{
    // Given - Prepare test data
    var channel = GivenDepositChannel(
        currency: CurrencyEnum.CNY,
        vipLevels: new List<int> { 1, 2, 3 },
        excludeTags: new List<int>(),
        pointLevel: 5);

    var custContext = GivenCustomerContext(
        currency: CurrencyEnum.CNY,
        vipLevel: 2,
        pointLevel: 8,
        tags: new List<int> { 100 });

    // When - Execute method under test
    var result = channel.IsSupported(custContext);

    // Then - Verify result
    result.Should().BeTrue();
}
```

### Given Method Naming Convention

```csharp
// ✅ Correct: use Given prefix
private DepositChannel GivenDepositChannel(...)
private CustomerContext GivenCustomerContext(...)
private DepositLimitInfo GivenDepositLimitInfo(...)

// ❌ Wrong: use Create or other prefixes
private DepositChannel CreateDepositChannel(...)  // Not recommended
private DepositChannel BuildDepositChannel(...)   // Not recommended
```

### Async Tests

```csharp
[Test]
public async Task GetDepositChannelsByDepositTypeAsync_WhenCustomerNotFound_ThrowsException()
{
    // Given
    _customerRepository.GetCustContextAsync(Constants.CustomerId)
        .Returns(Task.FromException<CustomerContext>(
            new CustomerNotFoundException(Constants.CustomerId)));

    // When
    var act = async () => await _service.GetDepositChannelsByDepositTypeAsync(Constants.CustomerId);

    // Then
    await act.Should().ThrowAsync<CustomerNotFoundException>()
        .WithMessage("*custId: 1*");
}
```

---

## Test Builder Pattern

### Builder Design

```csharp
public class DepositChannelBuilder
{
    private DepositTypeEnum _depositType;
    private CurrencyEnum _currency;
    private List<int> _vipLevels = null!;
    private List<int> _excludeTags = null!;
    private int _pointLevel;
    private decimal _maxAmount;
    private decimal _minAmount;
    private int _sort;

    public DepositChannelBuilder With(
        DepositTypeEnum? depositType = null,
        CurrencyEnum? currency = null,
        List<int>? vipLevels = null,
        List<int>? excludeTags = null,
        int? pointLevel = null,
        decimal? minAmount = null,
        decimal? maxAmount = null,
        int? sort = null)
    {
        _depositType = depositType ?? Constants.DefaultDepositType;
        _currency = currency ?? Constants.DefaultCurrency;
        _vipLevels = vipLevels ?? Constants.DefaultVipLevels;
        _excludeTags = excludeTags ?? Constants.DefaultExcludeTags;
        _pointLevel = pointLevel ?? Constants.DefaultPointLevel;
        _minAmount = minAmount ?? Constants.DefaultMinAmount;
        _maxAmount = maxAmount ?? Constants.DefaultMaxAmount;
        _sort = sort ?? Constants.DefaultSort;
        return this;
    }

    public DepositChannel Build()
    {
        return new DepositChannel
        {
            DepositType = _depositType,
            Currency = _currency,
            VipLevels = _vipLevels,
            ExcludeTags = _excludeTags,
            PointLevel = _pointLevel,
            MinAmount = _minAmount,
            MaxAmount = _maxAmount,
            Sort = _sort
        };
    }
}
```

### Builder Usage

```csharp
// In test class Helper Methods
private DepositChannel GivenDepositChannel(
    DepositTypeEnum depositType = DepositTypeEnum.OnlineBanking,
    CurrencyEnum currency = CurrencyEnum.CNY,
    List<int>? vipLevels = null,
    decimal minAmount = 100,
    decimal maxAmount = 5000)
{
    return new DepositChannelBuilder()
        .With(
            depositType: depositType,
            currency: currency,
            vipLevels: vipLevels,
            minAmount: minAmount,
            maxAmount: maxAmount)
        .Build();
}
```

### Shared Constants Definition

```csharp
public static class Constants
{
    // Customer data
    public const int CustomerId = 1;
    public const int CustomerSiteId = 101;
    public const CurrencyEnum CustomerCurrency = CurrencyEnum.MYR;
    public const int CustomerVipLevel = 1;

    // Default values
    public const DepositTypeEnum DefaultDepositType = DepositTypeEnum.OnlineBanking;
    public const CurrencyEnum DefaultCurrency = CurrencyEnum.MYR;
    public const decimal DefaultMinAmount = 300;
    public const decimal DefaultMaxAmount = 99999;
    public const int DefaultPointLevel = 1;

    // JSON format data
    public const string DefaultVipLevelsJson = "[1,2,3,4,5]";
    public static readonly List<int> DefaultVipLevels =
        DefaultVipLevelsJson.ParseJson<List<int>>();
}
```

---

## FluentAssertions Usage Guide

### Basic Assertions

```csharp
// Value comparison
result.Should().Be(expected);
result.Should().NotBe(unexpected);
result.Should().BeTrue();
result.Should().BeFalse();
result.Should().BeNull();
result.Should().NotBeNull();

// Numeric comparison
amount.Should().BeGreaterThan(0);
amount.Should().BeLessOrEqualTo(1000);
amount.Should().BeInRange(100, 500);
```

### Collection Assertions

```csharp
// Collection verification
result.Should().NotBeNull();
result.Should().HaveCount(3);
result.Should().ContainSingle();
result.Should().BeEmpty();
result.Should().NotBeEmpty();

// Collection content
result.Should().Contain(expectedItem);
result.Should().BeEquivalentTo(expectedList);
result.GetDepositTypes().Should().ContainSingle()
    .Which.Should().Be(DepositTypeEnum.OnlineBanking);
```

### Exception Verification

```csharp
// Synchronous method
var act = () => channel.IsOverlappingWith(null);
act.Should().Throw<ArgumentNullException>()
    .WithMessage("*depositLimitInfo*");

// Async method
var act = async () => await service.GetAsync(id);
await act.Should().ThrowAsync<CustomerNotFoundException>()
    .WithMessage("*custId: 1*");
```

### Object Verification

```csharp
// Verify not same instance (confirm it's a new object)
result.Should().NotBeSameAs(original);

// Verify properties
result.DepositType.Should().Be(DepositTypeEnum.OnlineBanking);
result.Currency.Should().Be(CurrencyEnum.CNY);
result.VipLevels.Should().BeEquivalentTo(new List<int> { 1, 2, 3 });

// Assertion with message
result.Should().NotBeNull("customer should exist in database");
result.CustId.Should().Be(TestCustId, "customer ID should match");
```

---

## NSubstitute Mock Framework

### Creating Mocks

```csharp
// Create interface Mock
var customerRepository = Substitute.For<ICustomerRepository>();
var depositRepository = Substitute.For<IDepositRepository>();
```

### Setting Return Values

```csharp
// Simple return
_customerRepository.GetCustContextAsync(Constants.CustomerId)
    .Returns(custContext);

// Different returns on multiple calls
_repository.GetAsync(1).Returns(firstResult, secondResult);

// Throw exception
_customerRepository.GetCustContextAsync(Constants.CustomerId)
    .Returns(Task.FromException<CustomerContext>(
        new CustomerNotFoundException(Constants.CustomerId)));
```

### Verifying Calls

```csharp
// Verify call count
await _customerRepository.Received(1).GetCustContextAsync(Constants.CustomerId);

// Verify not called
await _depositRepository.DidNotReceive().GetDepositChannelsAsync(Arg.Any<int>());

// Use Arg.Any to match any argument
await _repository.Received().SaveAsync(Arg.Any<Customer>());
```

---

## Test Naming Conventions

### Naming Format

```
[MethodUnderTest]_[TestScenario]_[ExpectedResult]
```

### Naming Examples

```csharp
// Correct examples ✅
public void IsSupported_WhenAllConditionsMet_ShouldReturnTrue()
public void IsSupported_WhenCurrencyNotMatch_ShouldReturnFalse()
public void WithAmountLimit_WhenRangesOverlap_ShouldReturnNewInstanceWithIntersectedRange()
public void WithAmountLimit_WhenRangesDoNotOverlap_ShouldThrowInvalidOperationException()
public async Task GetAsync_WhenCustomerNotFound_ThrowsCustomerNotFoundException()

// Wrong examples ❌
public void TestIsSupported()           // Too generic
public void Test1()                     // Meaningless
public void IsSupportedWorks()          // Unclear what's being tested
```

### Common Vocabulary

| When Scenario | Description |
|---------------|-------------|
| `WhenAllConditionsMet` | All conditions satisfied |
| `WhenXxxNotMatch` | Certain condition doesn't match |
| `WhenXxxIsNull` | Certain parameter is null |
| `WhenXxxNotFound` | Certain data not found |
| `WhenRangesOverlap` | Ranges overlap |
| `WhenRangesDoNotOverlap` | Ranges don't overlap |

| Should Result | Description |
|---------------|-------------|
| `ShouldReturnTrue/False` | Returns boolean value |
| `ShouldReturnNull` | Returns null |
| `ShouldReturnNewInstance` | Returns new object |
| `ShouldThrowXxxException` | Throws exception |
| `ShouldNotModifyOriginal` | Doesn't modify original object |

---

## Test Coverage Requirements

### Domain Model Test Focus

1. **Constructor Tests**
   - Default value initialization
   - Required parameter validation

2. **Business Method Tests**
   - Happy path
   - Boundary conditions
   - Error handling

3. **Immutability Verification**
   - Methods return new instances
   - Original object not modified

### Service Layer Test Focus

1. **Dependency injection verification**
2. **Normal flow testing**
3. **Exception handling testing**
4. **Dependency call verification**

### Coverage Targets

| Type | Minimum Coverage |
|------|------------------|
| Domain Model | 90%+ |
| Service Layer | 80%+ |
| Repository | 70%+ (Integration Test) |

---

## Review Checklist

### Test Structure Check
- [ ] Uses Given-When-Then structure
- [ ] Given helper methods start with `Given`
- [ ] Tests grouped by method using `#region`
- [ ] Each test tests only one behavior

### Naming Convention Check
- [ ] Test method names follow `[Method]_[Scenario]_[Expected]` format
- [ ] Method names clearly describe test intent
- [ ] Avoid meaningless names like Test1, Test2

### Assertion Check
- [ ] Uses FluentAssertions
- [ ] Immutability verification confirms return of new instance
- [ ] Exception tests use `.Should().Throw<>()`

### Mock Check
- [ ] Uses NSubstitute to create Mocks
- [ ] Verifies call count for key dependencies
- [ ] Uses `Arg.Any<>()` to match parameters

### Builder Check
- [ ] Uses Test Builder to create test objects
- [ ] Builders are in TestShared project
- [ ] Uses Constants to define shared test data

---

## Common Pitfalls for New Developers

### 1. Given Methods Not Using Builder

```csharp
// ❌ Wrong: directly create object
private DepositChannel GivenDepositChannel()
{
    return new DepositChannel
    {
        DepositType = DepositTypeEnum.OnlineBanking,
        Currency = CurrencyEnum.CNY,
        // ... every property must be set
    };
}

// ✅ Correct: use Builder, only set test-relevant properties
private DepositChannel GivenDepositChannel(
    CurrencyEnum currency = CurrencyEnum.CNY)
{
    return new DepositChannelBuilder()
        .With(currency: currency)
        .Build();
}
```

### 2. Test Without Clear Given-When-Then Separation

```csharp
// ❌ Wrong: mixed together
[Test]
public void TestIsSupported()
{
    var channel = new DepositChannel { Currency = CurrencyEnum.CNY };
    var result = channel.IsSupported(new CustomerContext { Currency = CurrencyEnum.CNY });
    Assert.IsTrue(result);
}

// ✅ Correct: clear separation
[Test]
public void IsSupported_WhenCurrencyMatch_ShouldReturnTrue()
{
    // Given
    var channel = GivenDepositChannel(currency: CurrencyEnum.CNY);
    var custContext = GivenCustomerContext(currency: CurrencyEnum.CNY);

    // When
    var result = channel.IsSupported(custContext);

    // Then
    result.Should().BeTrue();
}
```

### 3. Async Tests Using Wrong Verification

```csharp
// ❌ Wrong: using synchronous Throw
var act = async () => await service.GetAsync(id);
act.Should().Throw<Exception>();  // Won't correctly catch async exception

// ✅ Correct: use ThrowAsync
var act = async () => await service.GetAsync(id);
await act.Should().ThrowAsync<CustomerNotFoundException>();
```

### 4. Forgetting to Verify Mock Calls

```csharp
// ❌ Incomplete: only verify result
[Test]
public async Task GetAsync_ReturnsData()
{
    _repository.GetAsync(1).Returns(expectedData);

    var result = await _service.GetAsync(1);

    result.Should().Be(expectedData);
    // Didn't verify if repository was actually called
}

// ✅ Complete: verify both result and calls
[Test]
public async Task GetAsync_ReturnsData()
{
    _repository.GetAsync(1).Returns(expectedData);

    var result = await _service.GetAsync(1);

    result.Should().Be(expectedData);
    await _repository.Received(1).GetAsync(1);
}
```

### 5. Test Data Not Reusable

```csharp
// ❌ Wrong: using static mutable object
private static List<int> testTags = new List<int> { 1, 2, 3 };

// ✅ Correct: create new test data each time
private List<int> GivenTags() => new List<int> { 1, 2, 3 };
```

---

## TL/Reviewer Checkpoint

### 1. Test Coverage Completeness

- [ ] Is happy path tested?
- [ ] Are boundary conditions tested?
- [ ] Is error handling tested?
- [ ] Are null parameters tested?

### 2. Test Quality

- [ ] Is the test actually testing business logic? (not just testing Mock setup)
- [ ] Is the test deterministic? (not depending on time, random numbers)
- [ ] Is the test independent? (not depending on other tests' execution order)

### 3. Code Quality

- [ ] Are there duplicate test setups that can be extracted?
- [ ] Is Builder in the correct project location?
- [ ] Are constants defined in Constants class?

### 4. Maintainability

- [ ] Is the failure message clear when test fails?
- [ ] Is test intent easy to understand?
- [ ] Is there excessive Mock setup?

### 5. Special Attention

```csharp
// Confirm immutability test
result.Should().NotBeSameAs(original);

// Confirm collection not null verification
result.Tags.Should().NotBeNull();
result.Tags.Should().BeEquivalentTo(expectedTags);

// Confirm exception message contains key information
.WithMessage("*custId: 1*");
```
