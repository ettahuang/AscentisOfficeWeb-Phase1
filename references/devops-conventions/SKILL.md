---
name: devops-conventions
description: |
  DevOps 開發規範，包含 Docker Image Registry、CI/CD Pipeline 相關規範。
  Use when: 處理 Docker 映像標籤、CI/CD 配置，
  或討論部署流程與映像生命週期管理時。
---

# DevOps Conventions

## Overview

This skill provides DevOps-related conventions for container image management and CI/CD pipelines.

**Key Topics**:
- Docker image naming and tagging
- Image registry management
- Lifecycle policies
- Deployment workflows

## Language Policy

- **AI responds**: Default to Traditional Chinese unless the user specifies otherwise

## When to Apply

- Creating Dockerfile configurations
- Setting up GitLab CI/CD pipelines
- Managing container image tags
- Planning deployment strategies
- Reviewing docker-compose configurations

## Detailed Documentation

| Language | File |
|----------|------|
| English | [en/image-registry-rules.md](en/image-registry-rules.md) |
| 繁體中文 | [zh-TW/映像檔庫規則.md](zh-TW/映像檔庫規則.md) |

## Quick Reference

### Image Tag Strategy

| Environment | Tag Format | Retention |
|-------------|------------|-----------|
| Development | `dev-YYYYMMDD-{pipeline_id}-{branch}` | 2 weeks |
| Production | `prod-YYYYMMDD-{pipeline_id}-{branch}` | Permanent |
| Latest | `latest-{environment}` | Single tag per env |

### Technical Constraints

- Image Tag maximum length: **128 bytes**
- CI_COMMIT_REF_SLUG maximum length: **63 bytes**

For complete guidelines, refer to [en/image-registry-rules.md](en/image-registry-rules.md) or [zh-TW/映像檔庫規則.md](zh-TW/映像檔庫規則.md).
