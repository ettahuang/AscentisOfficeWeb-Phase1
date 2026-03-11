# Code Review Checklist

This document provides a standardized checklist for code reviews, ensuring code quality and architectural compliance.

---

## Review Checklist Overview

| # | Check Item | Description |
|---|------------|-------------|
| 1 | [Implementation Plan Compliance](#1-implementation-plan-compliance) | Code matches the approved implementation plan |
| 2 | [SOLID & DRY Principles](#2-solid--dry-principles) | Follows SOLID, DRY, and other design principles |
| 3 | [Public API Documentation](#3-public-api-documentation) | Public methods/properties have English XML comments |
| 4 | [Architecture Boundary](#4-architecture-boundary) | New architecture does not reference legacy code |
| 5 | [Code Formatting](#5-code-formatting) | Code follows formatting conventions |

---

## 1. Implementation Plan Compliance

### Checklist

- [ ] Code implementation matches the approved plan/spec document
- [ ] All planned features are implemented
- [ ] No unplanned features added without approval
- [ ] API contracts match the specification
- [ ] Database schema changes match the plan

### Review Questions

| Question | Expected |
|----------|----------|
| Does the PR reference the plan document? | Yes, link in PR description |
| Are there deviations from the plan? | If yes, documented and approved |
| Are all acceptance criteria met? | Yes |

### How to Check

1. Open the referenced plan/spec document
2. Compare each planned item with the implementation
3. Verify API signatures match the specification
4. If deviations exist, confirm they were discussed and approved

---

## 2. SOLID & DRY Principles

### Checklist

- [ ] **S**ingle Responsibility: Each class has one reason to change
- [ ] **O**pen-Closed: Extended through abstraction, not modification
- [ ] **L**iskov Substitution: Subtypes are substitutable for base types
- [ ] **I**nterface Segregation: Small, focused interfaces
- [ ] **D**ependency Inversion: Depends on abstractions, not concretions
- [ ] **DRY**: No duplicated logic (Don't Repeat Yourself)

### Warning Signals

| Principle | Warning Signal |
|-----------|----------------|
| SRP Violation | Class has multiple unrelated methods, >300 lines |
| OCP Violation | Adding features requires modifying existing classes |
| LSP Violation | Subclass throws NotImplementedException |
| ISP Violation | Interface has >5 methods, implementers leave methods empty |
| DIP Violation | Direct `new` of dependencies, no interface injection |
| DRY Violation | Copy-pasted code blocks, similar logic in multiple places |

### Reference

See [05-Clean-Architecture-Core-Principles](./05-Clean-Architecture-Core-Principles.md) for detailed examples.

---

## 3. Public API Documentation

### Checklist

- [ ] All `public` methods have XML documentation comments
- [ ] All `public` properties have XML documentation comments
- [ ] All `public` classes have XML documentation comments
- [ ] Comments are written in **English**
- [ ] Comments describe **what** and **why**, not just **how**

### Required Format

```csharp
/// <summary>
/// Gets the customer information by customer ID.
/// </summary>
/// <param name="customerId">The unique identifier of the customer.</param>
/// <returns>The customer domain model, or null if not found.</returns>
/// <exception cref="ArgumentException">Thrown when customerId is invalid.</exception>
public async Task<Customer?> GetCustomerAsync(int customerId)
{
    // Implementation
}
```

### Documentation Requirements by Member Type

| Member Type | Required Tags |
|-------------|---------------|
| Class | `<summary>` |
| Method | `<summary>`, `<param>`, `<returns>` |
| Property | `<summary>` |
| Exception-throwing method | `<summary>`, `<param>`, `<returns>`, `<exception>` |

### Anti-Patterns

```csharp
// ❌ No documentation
public async Task<Customer> GetCustomerAsync(int customerId)

// ❌ Non-English documentation
/// <summary>
/// 取得客戶資訊
/// </summary>
public async Task<Customer> GetCustomerAsync(int customerId)

// ❌ Meaningless documentation (just repeating the name)
/// <summary>
/// Get customer.
/// </summary>
public async Task<Customer> GetCustomerAsync(int customerId)

// ✅ Proper documentation
/// <summary>
/// Retrieves the customer information including VIP level and account status.
/// Returns null if the customer does not exist.
/// </summary>
/// <param name="customerId">The unique identifier of the customer.</param>
/// <returns>The customer domain model with populated VIP information, or null if not found.</returns>
public async Task<Customer?> GetCustomerAsync(int customerId)
```

---

## 4. Architecture Boundary

### Checklist

- [ ] New architecture code does **NOT** reference legacy BLL classes
- [ ] New architecture code does **NOT** reference legacy DAL classes
- [ ] Domain models do **NOT** depend on infrastructure (DbModel, Repository implementations)
- [ ] No `using` statements pointing to legacy namespaces in new code

### Forbidden References in New Architecture

| New Architecture Layer | Must NOT Reference |
|------------------------|-------------------|
| Domain Models | `*.BLL`, `*.DAL`, `*.DbModel`, `*.Repositories` |
| Services (Application) | `*.BLL`, `*.DAL` |
| Repositories (Infrastructure) | `*.BLL` |
| Handlers | `*.BLL`, `*.DAL` |

### How to Check

1. Search for forbidden `using` statements:
   ```
   using BonusService.Service.BLL;
   using BonusService.Service.DAL;
   ```

2. Check constructor injections - should inject interfaces, not legacy classes:
   ```csharp
   // ❌ Wrong: Injecting legacy BLL
   public MyHandler(PromotionBLL promotionBll)

   // ✅ Correct: Injecting interface
   public MyHandler(IPromotionRepository promotionRepository)
   ```

3. Verify Domain models have no infrastructure dependencies:
   ```csharp
   // ❌ Wrong: Domain depends on DbModel
   public class Promotion
   {
       public DbModel.Promotion DbModel { get; set; }
   }

   // ✅ Correct: Pure domain model
   public class Promotion
   {
       public int Id { get; init; }
       public string Name { get; init; }
   }
   ```

### Reference

See [02-Architecture-Overview](./02-Architecture-Overview.md) for architecture diagrams and boundaries.

---

## 5. Code Formatting

### Checklist

- [ ] Class members ordered correctly (constants → fields → constructors → properties → methods)
- [ ] No `#region` in production code
- [ ] Uses file-scoped namespace
- [ ] `using` statements properly ordered
- [ ] Static methods marked as `static` when not using instance state

### Reference

See [18-CSharp-Coding-Conventions](./18-CSharp-Coding-Conventions.md) for detailed formatting rules.

---

## Quick Reference Card

For quick reviews, use this condensed checklist:

```
□ Implementation matches plan document
□ SOLID/DRY principles followed
□ Public APIs have English XML comments
□ No legacy (BLL/DAL) references in new code
□ Code formatting follows conventions
```

---

## Review Process

### Before Approving

1. ✅ All checklist items passed
2. ✅ All CI checks passed
3. ✅ No unresolved comments
4. ✅ Test coverage adequate

### When Issues Found

1. Add specific comments pointing to the issue
2. Reference this document for standards
3. Request changes with clear action items
4. Re-review after fixes

---

> **Document Version**: v1.0
> **Last Updated**: 2024-12
