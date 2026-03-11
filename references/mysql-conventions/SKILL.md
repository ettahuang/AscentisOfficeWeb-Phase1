---
name: mysql-conventions
description: |
  MySQL 開發規範指南，包含 Stored Procedure、Table、Index 等規範。
  Use when: 撰寫或審查 MySQL 相關腳本（SP、DDL），
  或討論 MySQL 命名規範與格式標準。
---

# MySQL Stored Procedure Conventions

## Overview

This skill provides MySQL Stored Procedure coding conventions based on DBA deployment standards.

**Reference**: [SP Deployment Flow For PD](https://onetw.atlassian.net/wiki/spaces/ATLAS/pages/1242464259/SP+Deployment+Flow+For+PD)

## Language Policy

- **AI responds**: Default to Traditional Chinese unless the user specifies otherwise

## When to Apply

- Writing new Stored Procedures
- Reviewing SP pull requests
- Modifying existing SPs
- Preparing SPs for DBA review

## Detailed Documentation

| Language | File |
|----------|------|
| English | [en/mysql-sp-conventions.md](en/mysql-sp-conventions.md) |
| 繁體中文 | [zh-TW/MySQL-SP開發規範.md](zh-TW/MySQL-SP開發規範.md) |

## Quick Reference

### SQL File Structure

```sql
use DBName;

DELIMITER $$

DROP PROCEDURE IF EXISTS `SP_Name`$$

CREATE DEFINER=`nova88`@`%` PROCEDURE `SP_Name`(...)
BEGIN
    /*
        Fuction: Brief description
        Frequence: Call frequency
        Params Sample: CALL SP_Name(...);
        JIRA Ticket: AT-XXXX
    */

    ##YYYYMMDD @Author : Change description

    -- SQL statements

END$$

DELIMITER ;
```

### SP Naming Convention

```
<Prefix>_<MainFunctionality>_<SpecificFunctionality>_<Action>[_V<VersionNumber>]
```

Examples:
- `Bonus_Customer_Get`
- `Bonus_PromotionList_Get`
- `Member_PromotionList_Get_V10`

### Remark Format

```sql
##YYYYMMDD @Author : Change description
```

> **Important**: Remove remarks older than 12 months when modifying SPs

### Checklist

- [ ] File starts with `use DBName;`
- [ ] Block comment with Fuction/Frequence/Params Sample/JIRA Ticket
- [ ] Remark(s) for any changes
- [ ] SP name follows naming convention
- [ ] Integration tests pass

For complete guidelines, refer to [en/mysql-sp-conventions.md](en/mysql-sp-conventions.md) or [zh-TW/MySQL-SP開發規範.md](zh-TW/MySQL-SP開發規範.md).
