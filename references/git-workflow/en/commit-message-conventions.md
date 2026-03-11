# Git Commit Message Conventions

This document defines the Git commit message format and conventions for this project, based on [Conventional Commits](https://www.conventionalcommits.org/) specification.

---

## Commit Message Structure

```
<type>: <subject>

<body>

<footer>
```

### Structure Overview

| Part | Required | Description |
|------|----------|-------------|
| Type | ✅ Yes | Category of the change |
| Subject | ✅ Yes | Short description (imperative mood) |
| Body | ⚠️ Recommended | Detailed explanation of changes |
| Footer | ❌ Optional | Breaking changes, issue references |

---

## Type Prefixes

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add promotion eligibility check` |
| `fix` | Bug fix | `fix: correct VIP level calculation` |
| `refactor` | Code refactoring (no behavior change) | `refactor: implement Phase 3 Domain Models` |
| `docs` | Documentation changes | `docs: add Phase 9 implementation plan` |
| `test` | Adding or updating tests | `test: add CustomerRepository unit tests` |
| `chore` | Maintenance tasks | `chore: update NuGet packages` |
| `style` | Code style changes (formatting, no logic change) | `style: fix indentation in Handler classes` |
| `perf` | Performance improvements | `perf: optimize database query with index` |
| `ci` | CI/CD configuration changes | `ci: add integration test workflow` |

---

## Subject Line Rules

### Format

```
<type>: <imperative verb> <what was done>
```

### Rules

| Rule | ✅ Good | ❌ Bad |
|------|---------|--------|
| Use imperative mood | `add customer validation` | `added customer validation` |
| Don't capitalize first letter | `add new feature` | `Add new feature` |
| No period at the end | `fix null reference` | `fix null reference.` |
| Keep under 72 characters | Short and concise | Long rambling description... |
| Be specific | `add VIP level check to eligibility` | `update code` |

### Examples

```
✅ refactor: implement Phase 9F Customer domain model and repository
✅ feat: add promotion amount type to bonus terms
✅ fix: correct IPv6 resolution issue with localhost
✅ docs: add migration scripts documentation

❌ Refactor: Implemented Phase 9F Customer domain model and repository.
❌ refactor: changes
❌ updated stuff
```

---

## Body Format

The body provides detailed explanation of **what** and **why** (not how - the code shows how).

### Structure for Feature/Refactor Commits

```
<Phase/Feature Name>:
- <Change 1>
- <Change 2>
- <Change 3>

<Additional Section (if needed)>:
- <Change 4>
- <Change 5>
```

### Example

```
refactor: implement Phase 9G ResultMapper and Phase 9H V2 Handler

Phase 9G - ResultMapper:
- Add ToLocalUnixTimeSeconds() method to MarketDateTime for legacy API conversion
- Add PromotionAmountType to BonusTerms for bonus calculation type
- Add IResultMapper interface for V2 to legacy model conversion
- Add ResultMapper implementation with enum and reference mapping
- Add ResultMapperTests with comprehensive coverage

Phase 9H - GetSpecialPromotionListV2Handler:
- Add V2 Handler integrating all Clean Architecture components
- Implement BuildViewerContext, GetVisiblePromotions, CheckEligibility, MapToLegacy flow
- Support guest and authenticated user flows with proper eligibility handling
- Register IResultMapper and V2 Handler in Startup.cs DI container

Supporting changes:
- Update PromotionData DbModel with PeriodType field
- Update PromotionList and FreeBetPromotion tests
```

### Body Guidelines

| Guideline | Description |
|-----------|-------------|
| Use bullet points | Start each item with `-` for readability |
| Group related changes | Use section headers like `Phase X:`, `Supporting changes:` |
| Be specific | Mention file names, class names, method names |
| Explain why | If the reason isn't obvious, explain the motivation |
| Wrap at 72 characters | For readability in terminal |

---

## Multi-Phase Commits

When implementing multiple phases in a single commit:

```
refactor: implement Phase 9G ResultMapper and Phase 9H V2 Handler

Phase 9G - ResultMapper:
- <changes for Phase 9G>

Phase 9H - GetSpecialPromotionListV2Handler:
- <changes for Phase 9H>

Supporting changes:
- <shared or infrastructure changes>
```

---

## Documentation Commits

```
docs: add Phase 9 implementation plan with sub-phases 9A-9J
```

Or with body:

```
docs: restructure refactoring plan with TDD + Tidy First methodology

- Reorganize phases for incremental delivery
- Add sub-phase breakdown for complex phases
- Include test strategy for each phase
- Add rollback procedures
```

---

## Quick Reference

### Commit Message Template

```
<type>: <short description in imperative mood>

<Section Name>:
- <Specific change with class/method names>
- <Another specific change>

<Another Section (if needed)>:
- <Change>
```

### Checklist Before Committing

- [ ] Type prefix is correct (`feat`, `fix`, `refactor`, `docs`, etc.)
- [ ] Subject is in imperative mood ("add" not "added")
- [ ] Subject is under 72 characters
- [ ] Subject doesn't end with period
- [ ] Body explains what changed (with specific names)
- [ ] Related changes are grouped with section headers

---

## Examples from This Project

### Refactor Commit (Single Phase)

```
refactor: implement Phase 9F Customer domain model and repository

- Add Customer domain model with WalletBalance, VipLevel, AffiliateCode properties
- Add Customer DbModel for database mapping (stored procedure result)
- Add ICustomerRepository interface for customer data retrieval
- Add CustomerRepository implementation using Report DB
- Add Bonus_Customer_Get SP script for customer retrieval
- Register ICustomerRepository in Startup.cs DI container
- Add CustomerTests unit tests for domain model validation
- Update phase9 implementation plan documentation
```

### Refactor Commit (Multiple Phases)

```
refactor: implement Phase 9G ResultMapper and Phase 9H V2 Handler

Phase 9G - ResultMapper:
- Add ToLocalUnixTimeSeconds() method to MarketDateTime
- Add IResultMapper interface for V2 to legacy model conversion
- Add ResultMapper implementation with enum and reference mapping
- Add ResultMapperTests with comprehensive coverage

Phase 9H - GetSpecialPromotionListV2Handler:
- Add V2 Handler integrating all Clean Architecture components
- Register IResultMapper and V2 Handler in Startup.cs DI container
- Add GetSpecialPromotionListV2HandlerTests

Supporting changes:
- Update PromotionData DbModel with PeriodType field
```

### Docs Commit

```
docs: add Phase 9 implementation plan with sub-phases 9A-9J
```

### Infrastructure Commit

```
refactor: implement Phase 0A integration test container management

Phase 0A - Container Reuse Infrastructure:
- Add ContainerMetadata class for persisting container state to disk
- Add MigrationRunner class for branch-specific SQL migration execution
- Update MySqlContainerFixture with container reuse logic (12-hour validity)
- Support FORCE_RECREATE_CONTAINER, CONTAINER_MAX_AGE_HOURS env vars

Migration Scripts:
- Add 001_Bonus_Customer_Get.sql for customer data retrieval
- Add 002_Bonus_PromotionList_Get.sql for promotion list queries

Supporting changes:
- Update .csproj to copy migration SQL files to output directory
- Use 127.0.0.1 instead of localhost to avoid IPv6 resolution issues
```

---

> **Document Version**: v1.0
> **Last Updated**: 2024-12
