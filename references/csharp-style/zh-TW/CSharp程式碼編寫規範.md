# C# 程式碼編寫規範

## 目錄
1. [命名規範](#命名規範)
2. [類別與介面](#類別與介面)
3. [方法](#方法)
4. [屬性](#屬性)
5. [欄位](#欄位)
6. [錯誤處理](#錯誤處理)
7. [註解與文件](#註解與文件)
8. [最佳實踐](#最佳實踐)
9. [單元測試](#單元測試)
10. [非同步程式設計](#非同步程式設計)
11. [LINQ 使用](#linq-使用)
12. [依賴注入](#依賴注入)


## 命名規範

### 通用規則
- 命名空間、類別、介面、方法、屬性、列舉使用 PascalCase
- 方法參數和區域變數使用 camelCase
- 公開欄位使用 PascalCase，私有欄位使用 camelCase
- 介面名稱以 "I" 為前綴
- 使用有意義且具描述性的名稱

### 範例
```csharp
namespace Company.Project.Core
{
    public interface IDataService
    {
        Task<TResult> GetDataAsync<TResult>(string key);
    }

    public class DataService : IDataService
    {
        private readonly ILogger<DataService> _logger;
        private readonly string _connectionId;
        public string RequestId { get; set; }

        public async Task<TResult> GetDataAsync<TResult>(string key)
        {
            var request = new DataRequest { Key = key };
            return await GetDataInternalAsync<TResult>(request);
        }
    }
}
```

## 類別與介面

### 類別結構
- 先宣告欄位
- 接著是建構子
- 屬性在建構子之後
- 方法放最後
- 介面實作分組放置

### 範例
```csharp
public class BaseService : IBaseService
{
    private readonly IBaseRepository _repository;
    private readonly ILogger<BaseService> _logger;

    public BaseService(
        IBaseRepository repository,
        ILogger<BaseService> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public string ServiceName { get; set; }

    public async Task<TEntity> GetEntityAsync<TEntity>(int id) where TEntity : class
    {
        try
        {
            return await _repository.GetByIdAsync<TEntity>(id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "取得實體 {EntityType} ID {Id} 時發生錯誤", typeof(TEntity).Name, id);
            throw;
        }
    }
}
```

## 方法

### 方法組織
- 公開方法優先
- 私有方法放最後
- 相關方法分組放置
- 方法名稱應描述其行為

### 範例
```csharp
public class DataProcessor<T> where T : class
{
    public async Task<ProcessResult<T>> ProcessDataAsync(T data)
    {
        await ValidateDataAsync(data);
        var result = await TransformDataAsync(data);
        return await SaveDataAsync(data, result);
    }

    private async Task ValidateDataAsync(T data)
    {
        if (data == null)
            throw new ArgumentNullException(nameof(data));

        if (!await IsValidDataAsync(data))
            throw new ValidationException("無效的資料");
    }

    private async Task<TResult> TransformDataAsync<TResult>(T data)
    {
        // 資料轉換邏輯
        return default;
    }

    private async Task<ProcessResult<T>> SaveDataAsync(T data, object transformedData)
    {
        // 資料儲存邏輯
        return new ProcessResult<T>();
    }
}
```

## 屬性

### 屬性宣告
- 不需額外邏輯時使用自動實作屬性
- 需要自訂邏輯時使用完整屬性宣告
- 考慮對不可變物件使用 init-only 屬性

### 範例
```csharp
public class BaseEntity
{
    // 自動實作屬性
    public int Id { get; set; }

    // 唯讀屬性
    public string Code { get; init; }

    // 私有 set 屬性
    public DateTime CreatedDate { get; private set; }

    // 完整屬性宣告
    private string _name;
    public string Name
    {
        get => _name;
        set
        {
            if (string.IsNullOrEmpty(value))
                throw new ArgumentException("名稱不能為空");
            _name = value;
        }
    }
}
```

## 欄位

### 欄位宣告
- 私有欄位以底線為前綴
- 盡可能將欄位宣告為 readonly
- 依存取層級和用途分組欄位

### 範例
```csharp
public class BaseProcessor
{
    // 常數
    private const int DefaultRetryCount = 3;

    // 私有唯讀欄位
    private readonly ILogger<BaseProcessor> _logger;
    private readonly string _identifier;

    // 私有可變欄位
    private int _processCount;
    private bool _isProcessing;

    public BaseProcessor(ILogger<BaseProcessor> logger)
    {
        _logger = logger;
        _identifier = GenerateIdentifier();
    }
}
```

## 錯誤處理

### 例外處理
- 對預期的例外使用 try-catch 區塊
- 使用適當的層級記錄例外
- 在例外訊息中包含相關上下文
- 考慮使用自訂例外類型

### 範例
```csharp
public class DataService
{
    private readonly ILogger<DataService> _logger;

    public async Task ProcessDataAsync<T>(T data) where T : class
    {
        try
        {
            await ValidateDataAsync(data);
            await SaveDataAsync(data);
        }
        catch (ValidationException ex)
        {
            _logger.LogWarning(ex, "{DataType} 資料驗證失敗", typeof(T).Name);
            throw new DataValidationException($"資料驗證失敗: {ex.Message}", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "處理 {DataType} 類型資料時發生資料庫錯誤", typeof(T).Name);
            throw new DataProcessException("因資料庫錯誤無法處理資料", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "處理 {DataType} 類型資料時發生未預期的錯誤", typeof(T).Name);
            throw;
        }
    }
}
```

## 註解與文件

### 程式碼文件
- 對公開 API 使用 XML 註解
- 為複雜邏輯加入摘要註解
- 謹慎使用行內註解
- 記錄假設和重要說明

### 範例
```csharp
/// <summary>
/// 處理資料請求
/// </summary>
/// <typeparam name="T">要處理的資料類型</typeparam>
/// <param name="data">要處理的資料</param>
/// <returns>處理結果</returns>
/// <exception cref="DataValidationException">當資料驗證失敗時拋出</exception>
/// <exception cref="DataProcessException">當資料處理發生錯誤時拋出</exception>
public async Task<ProcessResult<T>> ProcessDataAsync<T>(T data) where T : class
{
    // 驗證請求
    if (!await ValidateDataAsync(data))
    {
        throw new DataValidationException("無效的資料");
    }

    // 重要：處理前必須檢查資料狀態
    if (!await CheckStateAsync(data))
    {
        return new ProcessResult<T> { Status = ProcessStatus.InvalidState };
    }

    /*
     * 處理流程：
     * 1. 鎖定資源
     * 2. 處理資料
     * 3. 更新狀態
     * 4. 解鎖資源
     */
    return await ProcessDataInternalAsync(data);
}
```

## 最佳實踐

### 通用準則
- 遵循 SOLID 原則
- 保持方法和類別專注於單一目的
- 使用依賴注入以提高可測試性
- 實作介面以達成鬆耦合
- 對非同步操作使用 async/await
- 適當時快取耗時的操作
- 優先使用強型別而非動態型別
- 優先使用組合而非繼承

### 範例
```csharp
// 不良實踐
public class DataService
{
    private readonly SqlConnection _connection;

    public DataService()
    {
        _connection = new SqlConnection("connection_string");
    }

    public T GetData<T>(int id) where T : class
    {
        // 直接資料存取實作
        return default;
    }
}

// 良好實踐
public interface IRepository<T> where T : class
{
    Task<T> GetByIdAsync(int id);
}

public interface IDataService<T> where T : class
{
    Task<T> GetDataAsync(int id);
}

public class DataService<T> : IDataService<T> where T : class
{
    private readonly IRepository<T> _repository;
    private readonly ILogger<DataService<T>> _logger;
    private readonly IMemoryCache _cache;

    public DataService(
        IRepository<T> repository,
        ILogger<DataService<T>> logger,
        IMemoryCache cache)
    {
        _repository = repository;
        _logger = logger;
        _cache = cache;
    }

    public async Task<T> GetDataAsync(int id)
    {
        var cacheKey = $"{typeof(T).Name}_{id}";

        return await _cache.GetOrCreateAsync(cacheKey, async entry =>
        {
            entry.SlidingExpiration = TimeSpan.FromMinutes(10);
            return await _repository.GetByIdAsync(id);
        });
    }
}
```

## 單元測試

### 測試準則
- 遵循 AAA (Arrange-Act-Assert) 模式
- 每個測試只測試一個行為
- 使用有意義的測試名稱
- 避免測試實作細節

### 範例
```csharp
public class DataServiceTests
{
    [Fact]
    public async Task GetDataAsync_WithValidId_ReturnsData()
    {
        // Arrange
        var id = 1;
        var expectedData = new TestData { Id = id, Value = "Test" };
        var mockRepository = new Mock<IRepository<TestData>>();
        mockRepository
            .Setup(r => r.GetByIdAsync(id))
            .ReturnsAsync(expectedData);

        var service = new DataService<TestData>(mockRepository.Object);

        // Act
        var result = await service.GetDataAsync(id);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(id, result.Id);
        Assert.Equal(expectedData.Value, result.Value);
    }

    [Fact]
    public async Task GetDataAsync_WithInvalidId_ThrowsNotFoundException()
    {
        // Arrange
        var id = -1;
        var mockRepository = new Mock<IRepository<TestData>>();
        mockRepository
            .Setup(r => r.GetByIdAsync(id))
            .ThrowsAsync(new NotFoundException());

        var service = new DataService<TestData>(mockRepository.Object);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(
            () => service.GetDataAsync(id));
    }
}
```

## 非同步程式設計

### 非同步準則
- 一致使用 async/await
- 避免使用 .Result 或 .Wait()
- 正確傳遞取消權杖
- 適當處理非同步例外

### 範例
```csharp
public class DataProcessor<T> where T : class
{
    private readonly IRepository<T> _repository;
    private readonly IDataService<T> _dataService;
    private readonly ILogger<DataProcessor<T>> _logger;

    public async Task<ProcessResult<T>> ProcessAsync(
        T data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // 驗證資料
            await ValidateAsync(data, cancellationToken);

            // 處理資料
            var processResult = await _dataService
                .ProcessAsync(data, cancellationToken);

            if (!processResult.IsSuccessful)
            {
                throw new ProcessException(processResult.Error);
            }

            // 儲存資料
            var savedData = await _repository
                .SaveAsync(data, cancellationToken);

            return new ProcessResult<T>
            {
                Data = savedData,
                Status = ProcessStatus.Completed
            };
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("{DataType} 的處理已被取消", typeof(T).Name);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "處理 {DataType} 時發生錯誤", typeof(T).Name);
            throw;
        }
    }
}
```

## LINQ 使用

### LINQ 準則
- 優先使用方法語法而非查詢語法
- 適當使用延遲執行
- 避免多次執行同一查詢
- 注意效能影響

### 範例
```csharp
public class DataService<T> where T : class
{
    private readonly IRepository<T> _repository;

    public async Task<IEnumerable<TResult>> GetFilteredDataAsync<TResult>(
        Expression<Func<T, bool>> filter,
        Expression<Func<T, TResult>> selector)
    {
        // 良好實踐：使用方法語法
        var data = await _repository.GetAllAsync();

        var result = data
            .Where(filter.Compile())
            .Select(selector.Compile())
            .ToList(); // 立即執行

        return result;
    }

    public async Task<decimal> CalculateAverageAsync(
        Expression<Func<T, decimal>> valueSelector)
    {
        var data = await _repository.GetAllAsync();

        // 避免多次執行同一查詢
        var values = data
            .Select(valueSelector.Compile())
            .ToList();

        if (!values.Any())
        {
            return 0;
        }

        return values.Average();
    }
}
```

## 依賴注入

### DI 準則
- 使用建構子注入
- 註冊適當的生命週期
- 避免服務定位器模式
- 使用適當的服務集合擴充方法

### 範例
```csharp
// 服務註冊
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Singleton 服務
        services.AddSingleton<IConnectionFactory, ConnectionFactory>();

        // Scoped 服務
        services.AddScoped(typeof(IDataService<>), typeof(DataService<>));
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

        // Transient 服務
        services.AddTransient<INotificationService, NotificationService>();

        // 組態選項
        services.Configure<AppSettings>(
            configuration.GetSection("AppSettings"));

        return services;
    }
}

// 服務使用
public class DataController<T> : ControllerBase where T : class
{
    private readonly IDataService<T> _dataService;
    private readonly ILogger<DataController<T>> _logger;
    private readonly AppSettings _settings;

    public DataController(
        IDataService<T> dataService,
        ILogger<DataController<T>> logger,
        IOptions<AppSettings> settings)
    {
        _dataService = dataService;
        _logger = logger;
        _settings = settings.Value;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<T>> GetData(int id)
    {
        var data = await _dataService.GetDataAsync(id);
        return Ok(data);
    }
}
```

---

這些準則應根據專案特定需求進行調整和擴展。建議定期審查和更新這些準則，以確保符合團隊需求和當前最佳實踐。
