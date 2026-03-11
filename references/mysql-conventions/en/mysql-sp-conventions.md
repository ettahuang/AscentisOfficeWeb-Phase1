# MySQL Stored Procedure Conventions

## Overview

This document provides MySQL Stored Procedure coding conventions based on DBA deployment standards.

**Reference**: [SP Deployment Flow For PD](https://onetw.atlassian.net/wiki/spaces/ATLAS/pages/1242464259/SP+Deployment+Flow+For+PD)

---

## 1. SQL File Format

### 1.1 File Structure

```sql
use DBName;

DELIMITER $$

DROP PROCEDURE IF EXISTS `SP_Name`$$

CREATE DEFINER=`nova88`@`%` PROCEDURE `SP_Name`(
    IN param1 INT,
    IN param2 VARCHAR(50),
    OUT result INT
)
BEGIN
    /*
        Fuction: Brief description of what this SP does
        Frequence: How often this SP is called (e.g., per request, daily)
        Params Sample: CALL SP_Name(123, 'test', @result);
        JIRA Ticket: AT-1234
    */

    ##YYYYMMDD @Author : Change description

    -- SQL statements here

END$$

DELIMITER ;
```

### 1.2 Required Elements

| Element | Required | Format | Example |
|---------|----------|--------|---------|
| `use DBName;` | Yes | At file start | `use Siebog;` |
| `DELIMITER $$` | Yes | Before DROP | `DELIMITER $$` |
| `DROP PROCEDURE` | Yes | With `$$` suffix | `DROP PROCEDURE IF EXISTS \`SP_Name\`$$` |
| `DEFINER` | Yes | Standard format | `DEFINER=\`nova88\`@\`%\`` |
| Block Comment | Yes | Inside BEGIN | See Section 2 |
| Remark | Conditional | For changes | `##20251225 @Author : desc` |
| `DELIMITER ;` | Yes | At file end | `DELIMITER ;` |

---

## 2. Block Comment Format

Every SP **MUST** include a block comment inside `BEGIN` with these fields:

```sql
BEGIN
    /*
        Fuction: Brief description of the SP's purpose
        Frequence: Call frequency (per request, per page load, daily batch, etc.)
        Params Sample: CALL SP_Name(param1_value, param2_value);
        JIRA Ticket: AT-XXXX or N/A
    */
```

### 2.1 Field Descriptions

| Field | Description | Example |
|-------|-------------|---------|
| `Fuction` | What the SP does | `Get customer bonus eligibility status` |
| `Frequence` | How often it's called | `Per promotion page load` |
| `Params Sample` | Example call with realistic values | `CALL Bonus_Customer_Get(123456);` |
| `JIRA Ticket` | Related ticket number | `AT-1234` or `N/A` |

---

## 3. Remark Format

Use remarks to document SP modifications:

```sql
##YYYYMMDD @Author : Change description
```

### 3.1 Remark Rules

> **Important**: Remove remarks older than 12 months when modifying SPs

- Use `##` prefix (double hash)
- Date format: `YYYYMMDD`
- Author: Use `@` prefix
- Description: Brief change summary in English or Chinese

### 3.2 Examples

```sql
##20251225 @KevinLiao : Add SortTime field for consistent ordering
##20251220 @Jerry : Fix DeviceType mapping for LineApp
##20250918 @Aaron : Add DenyVN_AffCodes blacklist support
```

---

## 4. SP Naming Convention

### 4.1 Format

```
<Prefix>_<MainFunctionality>_<SpecificFunctionality>_<Action>[_V<VersionNumber>]
```

### 4.2 Components

| Component | Description | Examples |
|-----------|-------------|----------|
| Prefix | Module/domain prefix | `Bonus`, `Member`, `Cust` |
| MainFunctionality | Main entity or feature | `Promotion`, `Customer`, `Deposit` |
| SpecificFunctionality | Specific aspect (optional) | `List`, `Running`, `History` |
| Action | Operation type | `Get`, `Set`, `Update`, `Delete` |
| Version | Version number (if applicable) | `V2`, `V3`, `V10` |

### 4.3 Examples

| SP Name | Description |
|---------|-------------|
| `Bonus_Customer_Get` | Get customer data for bonus eligibility |
| `Bonus_PromotionList_Get` | Get list of promotions |
| `Member_PromotionList_Get_V10` | Get promotion list (version 10) |
| `Bonus_CustDepositHistory_Get` | Get customer deposit history |
| `Bonus_PromotionCanJoin_Get_V3` | Check if customer can join promotion (version 3) |

---

## 5. Parameter Naming

### 5.1 Input Parameters

- Use underscore prefix for input parameters: `_CustId`, `_SiteId`
- Or use descriptive names without prefix: `CustId`, `SiteId`

### 5.2 Output Parameters

- Prefix with `OUT` keyword
- Use descriptive names: `OUT CanJoin`, `OUT Result`

### 5.3 Examples

```sql
CREATE PROCEDURE `Bonus_Customer_Get`(
    IN _CustId INT
)

CREATE PROCEDURE `Bonus_PromotionCanJoin_Get_V3`(
    IN CustId INT,
    IN CurrencyId INT,
    IN SiteId INT,
    IN BonusCode VARCHAR(50),
    IN DeviceType TINYINT,
    OUT CanJoin TINYINT,
    OUT Amount DECIMAL(18, 4),
    OUT Result INT
)
```

---

## 6. Complete Example

```sql
use Siebog;

DELIMITER $$

DROP PROCEDURE IF EXISTS `Bonus_Customer_Get`$$

CREATE DEFINER=`nova88`@`%` PROCEDURE `Bonus_Customer_Get`(
    IN _CustId INT
)
BEGIN
    /*
        Fuction: Get customer data for promotion eligibility check
        Frequence: Per GetPromotionList API call
        Params Sample: CALL Bonus_Customer_Get(123456);
        JIRA Ticket: AAZ-922
    */

    ##20251210 @KevinLiao : Create SP
    ##20251212 @KevinLiao : Add AffCode from Affiliate_VN

    SELECT
        C.CustId,
        C.TagList,
        Aff.AffCode,
        C.UserLevel
    FROM Customer C
    LEFT JOIN Affiliate_VN Aff ON C.CustId = Aff.CustId AND C.SiteId = Aff.SiteId
    WHERE C.CustId = _CustId;
END$$

DELIMITER ;
```

---

## 7. Integration Test Support

### 7.1 SqlScriptPreprocessor

When running Integration Tests with Testcontainers, the `SqlScriptPreprocessor` automatically:

1. Removes `DEFINER` clauses (TestContainer doesn't require specific user)
2. Handles `DELIMITER` statements (MySqlConnector doesn't support DELIMITER)
3. Preserves SQL logic for test execution

### 7.2 No Manual Conversion Needed

- Write SPs in DBA format (with DELIMITER/DEFINER)
- `MigrationRunner` preprocesses scripts automatically
- Same script works for both testing and DBA review

---

## 8. Checklist

Before submitting SP for review:

- [ ] File starts with `use DBName;`
- [ ] `DELIMITER $$` before DROP statement
- [ ] `DROP PROCEDURE IF EXISTS` with `$$` suffix
- [ ] `CREATE DEFINER=\`nova88\`@\`%\`` present
- [ ] Block comment with Fuction/Frequence/Params Sample/JIRA Ticket
- [ ] Remark(s) for any changes (`##YYYYMMDD @Author : desc`)
- [ ] Remove remarks older than 12 months
- [ ] `END$$` at procedure end
- [ ] `DELIMITER ;` at file end
- [ ] SP name follows naming convention
- [ ] Integration tests pass
