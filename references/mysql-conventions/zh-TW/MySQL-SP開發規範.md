# MySQL Stored Procedure 開發規範

## 概述

本文件提供基於 DBA 部署標準的 MySQL Stored Procedure 編碼規範。

**參考文件**: [SP Deployment Flow For PD](https://onetw.atlassian.net/wiki/spaces/ATLAS/pages/1242464259/SP+Deployment+Flow+For+PD)

---

## 1. SQL 檔案格式

### 1.1 檔案結構

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
        Fuction: SP 功能簡述
        Frequence: 呼叫頻率（例如：每次請求、每日）
        Params Sample: CALL SP_Name(123, 'test', @result);
        JIRA Ticket: AT-1234
    */

    ##YYYYMMDD @Author : 變更說明

    -- SQL 語句

END$$

DELIMITER ;
```

### 1.2 必要元素

| 元素 | 必要 | 格式 | 範例 |
|------|------|------|------|
| `use DBName;` | 是 | 檔案開頭 | `use Siebog;` |
| `DELIMITER $$` | 是 | DROP 之前 | `DELIMITER $$` |
| `DROP PROCEDURE` | 是 | 帶 `$$` 後綴 | `DROP PROCEDURE IF EXISTS \`SP_Name\`$$` |
| `DEFINER` | 是 | 標準格式 | `DEFINER=\`nova88\`@\`%\`` |
| 區塊註解 | 是 | BEGIN 內部 | 見第 2 節 |
| 備註 | 有條件 | 變更時 | `##20251225 @Author : desc` |
| `DELIMITER ;` | 是 | 檔案結尾 | `DELIMITER ;` |

---

## 2. 區塊註解格式

每個 SP **必須**在 `BEGIN` 內包含以下欄位的區塊註解：

```sql
BEGIN
    /*
        Fuction: SP 用途簡述
        Frequence: 呼叫頻率（每次請求、每次頁面載入、每日批次等）
        Params Sample: CALL SP_Name(param1_value, param2_value);
        JIRA Ticket: AT-XXXX 或 N/A
    */
```

### 2.1 欄位說明

| 欄位 | 說明 | 範例 |
|------|------|------|
| `Fuction` | SP 的功能 | `取得客戶紅利資格狀態` |
| `Frequence` | 呼叫頻率 | `每次活動頁面載入` |
| `Params Sample` | 包含實際值的呼叫範例 | `CALL Bonus_Customer_Get(123456);` |
| `JIRA Ticket` | 相關票號 | `AT-1234` 或 `N/A` |

---

## 3. 備註格式

使用備註記錄 SP 修改：

```sql
##YYYYMMDD @Author : 變更說明
```

### 3.1 備註規則

> **重要**：修改 SP 時，移除超過 12 個月的備註

- 使用 `##` 前綴（雙井號）
- 日期格式：`YYYYMMDD`
- 作者：使用 `@` 前綴
- 說明：中英文皆可的簡短變更摘要

### 3.2 範例

```sql
##20251225 @KevinLiao : 新增 SortTime 欄位以確保排序一致性
##20251220 @Jerry : 修正 LineApp 的 DeviceType 對應
##20250918 @Aaron : 新增 DenyVN_AffCodes 黑名單支援
```

---

## 4. SP 命名規範

### 4.1 格式

```
<Prefix>_<MainFunctionality>_<SpecificFunctionality>_<Action>[_V<VersionNumber>]
```

### 4.2 組成元素

| 元素 | 說明 | 範例 |
|------|------|------|
| Prefix | 模組/領域前綴 | `Bonus`, `Member`, `Cust` |
| MainFunctionality | 主要實體或功能 | `Promotion`, `Customer`, `Deposit` |
| SpecificFunctionality | 特定面向（選填） | `List`, `Running`, `History` |
| Action | 操作類型 | `Get`, `Set`, `Update`, `Delete` |
| Version | 版本號（如適用） | `V2`, `V3`, `V10` |

### 4.3 範例

| SP 名稱 | 說明 |
|---------|------|
| `Bonus_Customer_Get` | 取得客戶紅利資格資料 |
| `Bonus_PromotionList_Get` | 取得活動列表 |
| `Member_PromotionList_Get_V10` | 取得活動列表（第 10 版） |
| `Bonus_CustDepositHistory_Get` | 取得客戶存款歷史 |
| `Bonus_PromotionCanJoin_Get_V3` | 檢查客戶是否可參加活動（第 3 版） |

---

## 5. 參數命名

### 5.1 輸入參數

- 使用底線前綴：`_CustId`, `_SiteId`
- 或使用描述性名稱（無前綴）：`CustId`, `SiteId`

### 5.2 輸出參數

- 使用 `OUT` 關鍵字前綴
- 使用描述性名稱：`OUT CanJoin`, `OUT Result`

### 5.3 範例

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

## 6. 完整範例

```sql
use Siebog;

DELIMITER $$

DROP PROCEDURE IF EXISTS `Bonus_Customer_Get`$$

CREATE DEFINER=`nova88`@`%` PROCEDURE `Bonus_Customer_Get`(
    IN _CustId INT
)
BEGIN
    /*
        Fuction: 取得活動資格檢查用的客戶資料
        Frequence: 每次 GetPromotionList API 呼叫
        Params Sample: CALL Bonus_Customer_Get(123456);
        JIRA Ticket: AAZ-922
    */

    ##20251210 @KevinLiao : 建立 SP
    ##20251212 @KevinLiao : 新增 Affiliate_VN 的 AffCode

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

## 7. 整合測試支援

### 7.1 SqlScriptPreprocessor

使用 Testcontainers 執行整合測試時，`SqlScriptPreprocessor` 會自動：

1. 移除 `DEFINER` 子句（TestContainer 不需要特定使用者）
2. 處理 `DELIMITER` 語句（MySqlConnector 不支援 DELIMITER）
3. 保留 SQL 邏輯供測試執行

### 7.2 無需手動轉換

- 以 DBA 格式撰寫 SP（含 DELIMITER/DEFINER）
- `MigrationRunner` 會自動預處理腳本
- 同一腳本可用於測試和 DBA 審查

---

## 8. 檢查清單

提交 SP 審查前：

- [ ] 檔案以 `use DBName;` 開頭
- [ ] DROP 語句前有 `DELIMITER $$`
- [ ] `DROP PROCEDURE IF EXISTS` 帶 `$$` 後綴
- [ ] 包含 `CREATE DEFINER=\`nova88\`@\`%\``
- [ ] 區塊註解包含 Fuction/Frequence/Params Sample/JIRA Ticket
- [ ] 任何變更都有備註（`##YYYYMMDD @Author : desc`）
- [ ] 移除超過 12 個月的備註
- [ ] 程序結尾為 `END$$`
- [ ] 檔案結尾為 `DELIMITER ;`
- [ ] SP 名稱符合命名規範
- [ ] 整合測試通過
