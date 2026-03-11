---
name: clean-architecture
description: |
  Clean Architecture 開發規範與最佳實踐指南。
  Use when: 設計系統架構、建立新專案結構、進行架構審查、
  討論依賴方向、分層設計、領域驅動設計(DDD)、
  或任何涉及 Clean Architecture 原則的開發工作。
---

# Clean Architecture Guidelines

## Overview

This skill provides comprehensive Clean Architecture guidelines for software development projects.

## Language Policy

- **AI reads**: Always read documentation from `en/` directory
- **AI responds**: Default to Traditional Chinese (繁體中文) unless the user specifies otherwise

## When to Apply

- Designing new project architecture
- Reviewing existing architecture
- Implementing domain-driven design patterns
- Setting up layer boundaries and dependencies
- Code review focusing on architectural concerns
- Writing commit messages (refer to Git Commit Message Conventions)
- Applying TDD and Tidy First principles

## Documentation Index

For detailed guidelines, read from `en/` directory:

| Topic | File |
|-------|------|
| Overview | [en/01-README.md](en/01-README.md) |
| Architecture Overview | [en/02-Architecture-Overview.md](en/02-Architecture-Overview.md) |
| Architecture Diagrams | [en/03-Architecture-Diagrams.md](en/03-Architecture-Diagrams.md) |
| Project Structure | [en/04-Project-Directory-Structure.md](en/04-Project-Directory-Structure.md) |
| Core Principles | [en/05-Clean-Architecture-Core-Principles.md](en/05-Clean-Architecture-Core-Principles.md) |
| Layer Responsibilities | [en/06-Layer-Responsibilities.md](en/06-Layer-Responsibilities.md) |
| TDD & Tidy First | [en/07-TDD-and-Tidy-First-Guide.md](en/07-TDD-and-Tidy-First-Guide.md) |
| Domain Model Design | [en/08-Domain-Model-Design-Guide.md](en/08-Domain-Model-Design-Guide.md) |
| Repository Pattern | [en/09-Repository-Pattern.md](en/09-Repository-Pattern.md) |
| Service Layer | [en/10-Service-Layer-Design.md](en/10-Service-Layer-Design.md) |
| Decorator Pattern | [en/11-Decorator-Pattern-Specification.md](en/11-Decorator-Pattern-Specification.md) |
| Feature Toggle | [en/12-Feature-Toggle-Specification.md](en/12-Feature-Toggle-Specification.md) |
| Exception Handling | [en/13-Exception-Handling-and-Error-Management.md](en/13-Exception-Handling-and-Error-Management.md) |
| Middleware | [en/14-Middleware-Specification.md](en/14-Middleware-Specification.md) |
| DelegatingHandler | [en/15-DelegatingHandler-Specification.md](en/15-DelegatingHandler-Specification.md) |
| Testing Guidelines | [en/16-Testing-Specification-and-Guidelines.md](en/16-Testing-Specification-and-Guidelines.md) |
| MySQL Testcontainers | [en/17-MySQL-Testcontainers-Quick-Reference.md](en/17-MySQL-Testcontainers-Quick-Reference.md) |
| C# Coding Conventions | [en/18-CSharp-Coding-Conventions.md](en/18-CSharp-Coding-Conventions.md) |
| Git Commit Conventions | [git-workflow/commit-message-conventions.md](../git-workflow/commit-message-conventions.md) |
| Code Review Checklist | [en/20-Code-Review-Checklist.md](en/20-Code-Review-Checklist.md) |

For human readers (繁體中文), refer to `zh-TW/` directory.

## Quick Reference Guides

Role-based quick reference documents:

| Guide | Target Audience | File |
|-------|-----------------|------|
| AI Workflow Guide | AI Developers | [aaz-ai-workflow-guide.md](aaz-ai-workflow-guide.md) |
| AI Development Standards | AI Assistant | [ai-development-standards.md](ai-development-standards.md) |
| Code Review Checklist | Code Reviewers | [code-review-checklist.md](code-review-checklist.md) |
| Developer Guide | Junior/Mid Developers | [developer-guide.md](developer-guide.md) |
| Senior Developer Guide | Senior Developers & Team Leads | [senior-developer-guide.md](senior-developer-guide.md) |

## Core Principles

1. **Dependency Rule**: Dependencies point inward only
2. **Layer Separation**: Clear boundaries between layers
3. **Domain Centricity**: Business logic at the core
4. **Framework Independence**: Core doesn't depend on frameworks

## Architecture Layers

1. **Entities** - Enterprise business rules
2. **Use Cases** - Application business rules
3. **Interface Adapters** - Controllers, Presenters, Gateways
4. **Frameworks & Drivers** - External interfaces

## Quick Reference

### Layer Dependencies (Allowed)

```
Controllers → Services → Domain Models
     ↓            ↓
Repositories → Database
```

### Layer Dependencies (NOT Allowed)

```
Domain Models → Services (❌ Inner layer depends on outer)
Domain Models → Controllers (❌ Inner layer depends on outer)
```

### Key Design Patterns

- **Repository Pattern**: Abstract data access
- **Decorator Pattern**: Add behavior without modification
- **Feature Toggle**: Runtime feature control
- **Domain Model**: Encapsulate business logic

For complete documentation, refer to the files in `en/` directory.
