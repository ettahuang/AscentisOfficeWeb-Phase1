# TDD and Tidy First Practice Guide

> This document is based on Kent Beck's Test-Driven Development (TDD) and Tidy First principles, explaining the team's development methodology. These are core practices for ensuring code quality and maintainability.

---

## Core Development Principles

- Always follow the TDD cycle: Red → Green → Refactor
- Write the simplest failing test first
- Implement the minimum code needed to make tests pass
- Refactor only after tests are passing
- Follow "Tidy First" approach: separate structural changes from behavioral changes
- Maintain high code quality throughout development

---

## TDD Methodology

### Red → Green → Refactor Cycle

```
Red
    │ Write a failing test
    ▼
Green
    │ Write just enough code to pass the test
    ▼
Refactor
    │ Improve code structure while keeping tests passing
    ▼
Repeat cycle
```

### TDD Practice Points

| Principle | Description |
|-----------|-------------|
| **One test at a time** | Start with a failing test that defines a small increment of functionality |
| **Meaningful test names** | Describe behavior, e.g., `ShouldSumTwoPositiveNumbers` |
| **Clear failure messages** | Make test failures informative about the problem |
| **Minimal implementation** | Write only the code needed to pass the test, no more |
| **Refactor after green** | Ensure safety net exists before improving structure |

### Bug Fixing Workflow

```
Bug discovered
    │
    ├─ 1. First write an API-level failing test
    │      └─ Confirm bug can be caught by test
    │
    ├─ 2. Then write the smallest unit test to reproduce the problem
    │      └─ Precisely locate the issue
    │
    └─ 3. Fix the bug, make both tests pass
```

---

## Tidy First Approach

### Change Type Separation

Separate all changes into two types, **never mix them**:

| Type | Description | Examples |
|------|-------------|----------|
| **Structural Changes** | Rearranging code without changing behavior | Renaming, extracting methods, moving code, formatting |
| **Behavioral Changes** | Adding or modifying actual functionality | New features, bug fixes, business logic changes |

### Why Separate?

| Benefit | Description |
|---------|-------------|
| **Easy Code Review** | Reviewers can quickly confirm structural changes don't alter behavior |
| **Easy Tracking** | Git history clearly records the intent of each change |
| **Easy Rollback** | Can precisely rollback specific changes when issues arise |
| **Lower Risk** | Separate handling reduces risk of introducing bugs |

### Tidy First Workflow

```
When both structural and behavioral changes are needed:
    │
    ├─ 1. Make structural changes first
    │      └─ Run tests to verify behavior unchanged
    │
    ├─ 2. Commit structural changes
    │      └─ commit message: "refactor: ..."
    │
    ├─ 3. Then make behavioral changes
    │      └─ Run tests to verify new behavior
    │
    └─ 4. Commit behavioral changes
           └─ commit message: "feat: ..." or "fix: ..."
```

### Practical Example

**Scenario**: Need to add a feature to `DepositService`, but existing code needs refactoring first.

```
❌ Wrong approach: Single commit mixing structural and behavioral changes

git commit -m "feat: add deposit validation and refactor service"
```

```
✅ Correct approach: Separate commits

# Step 1: Structural change
git commit -m "refactor: extract validation logic to separate method"

# Step 2: Behavioral change
git commit -m "feat: add deposit amount validation"
```

---

## Commit Discipline

### Commit Conditions

Only commit when all conditions are met:

- [ ] All tests are passing
- [ ] All compiler/linter warnings are resolved
- [ ] The change represents a single logical unit of work
- [ ] Commit message clearly states whether it's structural or behavioral change

### Commit Principles

| Principle | Description |
|-----------|-------------|
| **Small and frequent** | Prefer over large, infrequent commits |
| **Single responsibility** | One commit does one thing |
| **Type indication** | Clearly indicate change type |
| **Independently runnable** | Project should work after each commit |

### Commit Message and Change Type Mapping

| Change Type | Commit Prefix | Example |
|-------------|---------------|---------|
| Structural | `refactor:` | `refactor: rename GetCustInfo to GetCustomerById` |
| Structural | `style:` | `style: format code according to guidelines` |
| Behavioral | `feat:` | `feat: add VIP level validation` |
| Behavioral | `fix:` | `fix: correct deposit limit calculation` |

---

## Code Quality Standards

| Standard | Description | Practice |
|----------|-------------|----------|
| **Eliminate duplication** | Ruthlessly eliminate duplicate code | Extract shared methods, use inheritance or composition |
| **Express intent** | Clearly express intent through naming and structure | Use domain language for naming |
| **Explicit dependencies** | Make dependencies obvious | Inject dependencies through constructor |
| **Small and focused** | Keep methods small, focused on single responsibility | One method does one thing |
| **Minimal state** | Minimize state and side effects | Prefer immutable objects |
| **Simplest solution** | Use the simplest solution that could possibly work | Avoid over-engineering |

---

## Refactoring Guidelines

### When to Refactor

| Timing | Description |
|--------|-------------|
| ✅ **Green phase** | Refactor only after tests pass |
| ✅ **Duplication found** | When you see duplicate code |
| ✅ **Unclear naming** | When names don't express intent |
| ❌ **Tests failing** | First make tests pass, then refactor |
| ❌ **Under time pressure** | Refactoring needs time and focus |

### Refactoring Principles

| Principle | Description |
|-----------|-------------|
| **Use correct names** | Use established refactoring patterns with proper names (e.g., Extract Method) |
| **One at a time** | Make one refactoring change at a time |
| **Test frequently** | Run tests after each refactoring step |
| **Prioritize** | Prioritize refactorings that remove duplication or improve clarity |

### Common Refactoring Patterns

| Pattern | Description | When to Use |
|---------|-------------|-------------|
| **Extract Method** | Extract a method | Method too long or has duplicate logic |
| **Rename** | Rename | Name doesn't express intent |
| **Move Method** | Move a method | Method is in wrong class |
| **Extract Class** | Extract a class | Class has too many responsibilities |
| **Inline** | Inline | Abstraction level unnecessary |

---

## Workflow Examples

### Implementing New Feature

```
1. Write a simple failing test for a small part of the feature
    ↓
2. Implement the minimum code to make the test pass
    ↓
3. Run tests to confirm passing (Green)
    ↓
4. Evaluate if refactoring is needed
   ├─ Yes → Make structural changes, run tests, commit
   └─ No → Continue to next step
    ↓
5. Commit behavioral changes
    ↓
6. Add test for next small increment of functionality
    ↓
7. Repeat until feature is complete
```

### Fixing a Bug

```
1. Write a test that reproduces the bug (confirm test fails)
    ↓
2. Fix the bug (make test pass)
    ↓
3. Evaluate if refactoring is needed to prevent similar bugs
   ├─ Yes → Separate commits: fix first, then refactor
   └─ No → Commit fix directly
    ↓
4. Commit changes
```

---

## Integration with Existing Guidelines

| Guideline | Relationship with TDD/Tidy First |
|-----------|----------------------------------|
| **Git Commit Message Guidelines** | Use `refactor:` for structural changes, `feat:`/`fix:` for behavioral changes |
| **Code Review Checklist** | Verify structural and behavioral changes are separated |
| **Testing Guidelines** | TDD is the core testing methodology |
| **CSharp Coding Conventions** | Follow coding conventions when refactoring |

---

## FAQ

### Q: Do small changes also need to separate structural and behavioral changes?

**A**: Yes, even small changes should be separated. This habit makes Git history clearer and saves more time in the long run.

### Q: What if I discover behavioral changes are needed during refactoring?

**A**: Stop, commit the current structural changes first, then start the behavioral change. Don't mix them in the same commit.

### Q: Does TDD slow down development?

**A**: It might be slightly slower short-term, but faster long-term. TDD reduces debugging time, lowers bug rate, and gives confidence when refactoring.

---

## Review Checklist

### TDD Check

- [ ] Was a failing test written before implementing the feature?
- [ ] Do test names clearly describe behavior?
- [ ] Was only the minimum code implemented to pass the test?

### Tidy First Check

- [ ] Are structural and behavioral changes committed separately?
- [ ] Can each commit run independently with all tests passing?
- [ ] Does commit message correctly indicate change type?

### Code Quality Check

- [ ] Has duplicate code been eliminated?
- [ ] Do names clearly express intent?
- [ ] Are methods small and focused?

---

> **Document Version**: v1.0
> **Last Updated**: 2025-01
> **Reference**: [Kent Beck's CLAUDE.md](https://github.com/KentBeck/BPlusTree3/blob/main/rust/docs/CLAUDE.md)
