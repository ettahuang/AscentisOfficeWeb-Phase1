# C# 程式碼編寫規範

本文件定義專案中 C# 程式碼的編碼規範與排版標準。

---

## 類別成員排序 (Class Member Ordering)

類別成員應依照以下順序排列：

| 順序 | 成員類型 | 說明 |
|------|---------|------|
| 1 | Constants | `const` 常數 |
| 2 | Static readonly fields | `static readonly` 欄位 |
| 3 | Instance fields | 實例欄位（`readonly` 優先） |
| 4 | Static constructor | 靜態建構子 |
| 5 | Constructors | 實例建構子（public → protected → private） |
| 6 | Public properties | 公開屬性 |
| 7 | Public methods | 公開方法 |
| 8 | Protected/Internal methods | 受保護/內部方法 |
| 9 | Private methods | 私有方法 |
| 10 | Nested types | 巢狀類別/結構/列舉 |

### 範例

```csharp
public class CustomerService : ICustomerService
{
    // 1. Constants
    private const int MaxRetryCount = 3;
    private const string CacheKeyPrefix = "Customer:";

    // 2. Static readonly fields
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(30);

    // 3. Instance fields (readonly first)
    private readonly ICustomerRepository _customerRepository;
    private readonly ILogger<CustomerService> _logger;
    private int _retryCount;

    // 4. Static constructor (if needed)
    static CustomerService()
    {
        // Static initialization
    }

    // 5. Constructors
    public CustomerService(
        ICustomerRepository customerRepository,
        ILogger<CustomerService> logger)
    {
        _customerRepository = customerRepository;
        _logger = logger;
    }

    // 6. Public properties
    public int RetryCount => _retryCount;

    // 7. Public methods
    public async Task<Customer> GetCustomerAsync(int customerId)
    {
        // Implementation
    }

    // 8. Private methods
    private string GenerateCacheKey(int customerId)
    {
        return $"{CacheKeyPrefix}{customerId}";
    }
}
```

---

## Region 使用規範

### Production Code：不使用 `#region`

**原因：**
- `#region` 隱藏複雜度，只是把問題藏起來而非解決
- 需要 `#region` 來組織通常代表類別應該拆分
- 現代 IDE（VS/Rider）提供 structure view、outline 等導航功能
- 增加維護負擔，要維護 region 名稱和程式碼的一致性

```csharp
// ❌ 不建議在 Production Code 使用
#region Database Operations
public async Task<Customer> GetCustomerAsync(int id) { }
public async Task SaveCustomerAsync(Customer customer) { }
#endregion

// ✅ 建議：透過良好的方法命名和類別拆分來組織
public async Task<Customer> GetCustomerAsync(int id) { }
public async Task SaveCustomerAsync(Customer customer) { }
```

### Test Code：可以使用 `#region`

測試程式碼可以使用 `#region`，因為：
- 測試類別通常有較長的 setup/arrange 程式碼
- 不會像 production code 那樣頻繁重構
- `#region` 可以幫助快速導航到特定測試區塊

```csharp
// ✅ 測試程式碼可以使用 region
public class CustomerServiceTests
{
    #region GetCustomerAsync Tests

    [Test]
    public async Task GetCustomerAsync_WhenCustomerExists_ShouldReturnCustomer()
    {
        // Test implementation
    }

    [Test]
    public async Task GetCustomerAsync_WhenCustomerNotFound_ShouldReturnNull()
    {
        // Test implementation
    }

    #endregion

    #region SaveCustomerAsync Tests
    // ...
    #endregion
}
```

### Test Infrastructure Code：不使用 `#region`

測試基礎設施程式碼（如 Fixtures、Test Utilities）比較接近 production code 的性質，應該用相同標準：

```csharp
// ❌ Test Fixture 不建議使用 region
public class MySqlContainerFixture : IAsyncDisposable
{
    #region Fields
    // ...
    #endregion
}

// ✅ Test Fixture 建議直接依順序排列
public class MySqlContainerFixture : IAsyncDisposable
{
    private const string ContainerName = "test-mysql";
    private readonly Dictionary<string, string> _connectionStrings = new();
    // ...
}
```

---

## Namespace 宣告

使用 file-scoped namespace 以減少縮排層級：

```csharp
// ✅ 建議：File-scoped namespace
namespace BonusService.Services;

public class CustomerService
{
    // Implementation
}

// ❌ 不建議：Block-scoped namespace
namespace BonusService.Services
{
    public class CustomerService
    {
        // Implementation
    }
}
```

---

## Using 語句排序

Using 語句應按以下順序排列，各群組之間不需空行：

1. System namespaces
2. Microsoft namespaces
3. Third-party namespaces（按字母順序）
4. Project namespaces

```csharp
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using NSubstitute;
using BonusService.Models.Domain;
using BonusService.Services;
```

---

## Static 修飾詞

若方法不依賴實例狀態，應加上 `static` 修飾詞：

```csharp
// ✅ 不依賴實例狀態的方法應該是 static
private static bool IsValidEmail(string email)
{
    return email.Contains("@");
}

private static int CalculateDiscount(decimal amount, decimal rate)
{
    return (int)(amount * rate);
}
```

---

## 總結 Checklist

### 排版檢查

- [ ] 類別成員依照規定順序排列
- [ ] Production code 不使用 `#region`
- [ ] 使用 file-scoped namespace
- [ ] Using 語句正確排序
- [ ] 不依賴實例狀態的方法加上 `static`

### Code Review 重點

| 檢查項目 | 警示訊號 |
|---------|---------|
| 類別太大 | 超過 300 行，需要 `#region` 來組織 |
| 成員順序混亂 | public method 出現在 private field 之前 |
| 缺少 static | 工具方法未標記為 static |

---

> **文件版本**: v1.0
> **最後更新**: 2024-12
