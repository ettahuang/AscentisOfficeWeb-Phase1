# Code Review 檢查清單

本文件提供標準化的 Code Review 檢查清單，確保程式碼品質與架構合規性。

---

## Review 檢查項目總覽

| # | 檢查項目 | 說明 |
|---|---------|------|
| 1 | [實作計劃相符性](#1-實作計劃相符性) | 程式碼與核准的實作計劃相符 |
| 2 | [SOLID 與 DRY 原則](#2-solid-與-dry-原則) | 遵循 SOLID、DRY 等設計原則 |
| 3 | [Public API 文件](#3-public-api-文件) | Public 方法/屬性需有英文 XML 註解 |
| 4 | [架構邊界](#4-架構邊界) | 新架構不引用舊架構程式碼 |
| 5 | [程式碼排版](#5-程式碼排版) | 程式碼符合排版規範 |

---

## 1. 實作計劃相符性

### 檢查清單

- [ ] 程式碼實作與核准的計劃/規格文件相符
- [ ] 所有計劃的功能都已實作
- [ ] 沒有未經核准就新增的功能
- [ ] API 契約與規格相符
- [ ] 資料庫 Schema 變更與計劃相符

### Review 問題

| 問題 | 預期答案 |
|------|---------|
| PR 是否有引用計劃文件？ | 是，在 PR 描述中有連結 |
| 是否有偏離計劃的地方？ | 若有，需記錄並取得核准 |
| 是否滿足所有驗收條件？ | 是 |

### 如何檢查

1. 開啟引用的計劃/規格文件
2. 將每個計劃項目與實作進行比對
3. 驗證 API 簽名與規格相符
4. 若有偏離，確認已討論並獲得核准

---

## 2. SOLID 與 DRY 原則

### 檢查清單

- [ ] **S**ingle Responsibility：每個類別只有一個變更的理由
- [ ] **O**pen-Closed：透過抽象擴展，而非修改
- [ ] **L**iskov Substitution：子類別可替代基底類別
- [ ] **I**nterface Segregation：小而專注的介面
- [ ] **D**ependency Inversion：依賴抽象，而非具體實作
- [ ] **DRY**：沒有重複的邏輯（Don't Repeat Yourself）

### 警示訊號

| 原則 | 警示訊號 |
|-----|---------|
| SRP 違規 | 類別有多個不相關的方法、超過 300 行 |
| OCP 違規 | 新增功能需要修改現有類別 |
| LSP 違規 | 子類別拋出 NotImplementedException |
| ISP 違規 | 介面超過 5 個方法、實作者留空方法 |
| DIP 違規 | 直接 `new` 依賴項、沒有介面注入 |
| DRY 違規 | 複製貼上的程式碼區塊、多處有相似邏輯 |

### 參考文件

詳細範例請參閱 [05-Clean-Architecture-核心原則](./05-Clean-Architecture-核心原則.md)。

---

## 3. Public API 文件

### 檢查清單

- [ ] 所有 `public` 方法都有 XML 文件註解
- [ ] 所有 `public` 屬性都有 XML 文件註解
- [ ] 所有 `public` 類別都有 XML 文件註解
- [ ] 註解以**英文**撰寫
- [ ] 註解描述 **what** 和 **why**，而非僅是 **how**

### 必要格式

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

### 各成員類型的文件要求

| 成員類型 | 必要標籤 |
|---------|---------|
| Class | `<summary>` |
| Method | `<summary>`, `<param>`, `<returns>` |
| Property | `<summary>` |
| 會拋出例外的方法 | `<summary>`, `<param>`, `<returns>`, `<exception>` |

### 反模式

```csharp
// ❌ 沒有文件
public async Task<Customer> GetCustomerAsync(int customerId)

// ❌ 非英文文件
/// <summary>
/// 取得客戶資訊
/// </summary>
public async Task<Customer> GetCustomerAsync(int customerId)

// ❌ 無意義的文件（只是重複名稱）
/// <summary>
/// Get customer.
/// </summary>
public async Task<Customer> GetCustomerAsync(int customerId)

// ✅ 正確的文件
/// <summary>
/// Retrieves the customer information including VIP level and account status.
/// Returns null if the customer does not exist.
/// </summary>
/// <param name="customerId">The unique identifier of the customer.</param>
/// <returns>The customer domain model with populated VIP information, or null if not found.</returns>
public async Task<Customer?> GetCustomerAsync(int customerId)
```

---

## 4. 架構邊界

### 檢查清單

- [ ] 新架構程式碼**不**引用舊版 BLL 類別
- [ ] 新架構程式碼**不**引用舊版 DAL 類別
- [ ] Domain Model **不**依賴 Infrastructure（DbModel、Repository 實作）
- [ ] 新程式碼中沒有指向舊命名空間的 `using` 語句

### 新架構中禁止的引用

| 新架構層級 | 不可引用 |
|-----------|---------|
| Domain Models | `*.BLL`, `*.DAL`, `*.DbModel`, `*.Repositories` |
| Services (Application) | `*.BLL`, `*.DAL` |
| Repositories (Infrastructure) | `*.BLL` |
| Handlers | `*.BLL`, `*.DAL` |

### 如何檢查

1. 搜尋禁止的 `using` 語句：
   ```
   using BonusService.Service.BLL;
   using BonusService.Service.DAL;
   ```

2. 檢查建構子注入 - 應注入介面，而非舊版類別：
   ```csharp
   // ❌ 錯誤：注入舊版 BLL
   public MyHandler(PromotionBLL promotionBll)

   // ✅ 正確：注入介面
   public MyHandler(IPromotionRepository promotionRepository)
   ```

3. 驗證 Domain Model 沒有 Infrastructure 依賴：
   ```csharp
   // ❌ 錯誤：Domain 依賴 DbModel
   public class Promotion
   {
       public DbModel.Promotion DbModel { get; set; }
   }

   // ✅ 正確：純粹的 Domain Model
   public class Promotion
   {
       public int Id { get; init; }
       public string Name { get; init; }
   }
   ```

### 參考文件

架構圖表與邊界請參閱 [02-架構概述](./02-架構概述.md)。

---

## 5. 程式碼排版

### 檢查清單

- [ ] 類別成員順序正確（常數 → 欄位 → 建構子 → 屬性 → 方法）
- [ ] Production Code 不使用 `#region`
- [ ] 使用 file-scoped namespace
- [ ] `using` 語句正確排序
- [ ] 不使用實例狀態的方法標記為 `static`

### 參考文件

詳細排版規則請參閱 [18-CSharp-程式碼編寫規範](./18-CSharp-程式碼編寫規範.md)。

---

## 快速參考卡

快速 Review 時使用此精簡檢查清單：

```
□ 實作與計劃文件相符
□ 遵循 SOLID/DRY 原則
□ Public API 有英文 XML 註解
□ 新程式碼沒有引用舊架構（BLL/DAL）
□ 程式碼排版符合規範
```

---

## Review 流程

### 核准前

1. ✅ 所有檢查項目通過
2. ✅ 所有 CI 檢查通過
3. ✅ 沒有未解決的評論
4. ✅ 測試覆蓋率足夠

### 發現問題時

1. 新增指向問題的具體評論
2. 引用本文件說明標準
3. 要求修改並列出明確的待辦事項
4. 修復後重新 Review

---

> **文件版本**: v1.0
> **最後更新**: 2024-12
