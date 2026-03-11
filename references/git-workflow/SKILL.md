---
name: git-workflow
description: |
  GitLab Feature Branch Workflow 開發規範，包含分支命名、合併策略、Commit Message 規範。
  Use when: 討論 Git 分支策略、建立 MR、處理 hotfix，
  或需要 Git commit message 格式指引時。
---

# Git Workflow Conventions

## Overview

This skill provides GitLab Feature Branch Workflow guidelines for Azeroth development teams.

**Key Topics**:
- Branch naming conventions
- Feature branch workflow
- Merge request process
- Commit message format
- Environment deployment strategy

## Language Policy

- **AI responds**: Default to Traditional Chinese unless the user specifies otherwise

## When to Apply

- Creating new feature branches
- Preparing merge requests
- Writing commit messages
- Handling hotfix branches
- Managing environment branches (uat)
- Code deployment planning

## Detailed Documentation

| Language | File |
|----------|------|
| English | [en/feature-branch-workflow.md](en/feature-branch-workflow.md), [en/commit-message-conventions.md](en/commit-message-conventions.md) |
| 繁體中文 | [zh-TW/功能分支工作流程.md](zh-TW/功能分支工作流程.md), [zh-TW/Git-Commit-訊息規範.md](zh-TW/Git-Commit-訊息規範.md) |

## Quick Reference

### Branch Types

| Type | Current Name | Future Name | Example |
|------|--------------|-------------|---------|
| Main | `PRD` | `main` | Production branch |
| Feature | `feature/` | `feature/` | `feature/user_authentication` |
| Hotfix | `hotfix/` | `hotfix/` | `hotfix/security_vulnerability` |
| UAT | `DEV` | `uat` | Testing environment |
| Release | `RLS` (optional) | `release` | Release preparation |

### Commit Message Format

```
<type>: <subject>

<body>
```

**Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

### Deployment Sequence

```
local -> uat -> prod
```

For complete guidelines, refer to [en/feature-branch-workflow.md](en/feature-branch-workflow.md) or [zh-TW/功能分支工作流程.md](zh-TW/功能分支工作流程.md).
