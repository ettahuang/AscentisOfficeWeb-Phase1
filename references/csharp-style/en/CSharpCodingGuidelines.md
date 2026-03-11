# C# Coding Guidelines

## Table of Contents
1. [Naming Conventions](#naming-conventions)
2. [Classes and Interfaces](#classes-and-interfaces)
3. [Methods](#methods)
4. [Properties](#properties)
5. [Fields](#fields)
6. [Error Handling](#error-handling)
7. [Comments and Documentation](#comments-and-documentation)
8. [Best Practices](#best-practices)
09. [Unit Testing](#unit-testing)
10. [Asynchronous Programming](#asynchronous-programming)
11. [LINQ Usage](#linq-usage)
12. [Dependency Injection](#dependency-injection)


## Naming Conventions

### General Rules
- Use PascalCase for namespace, class, interface, method, property, and enum names
- Use camelCase for method parameters and local variables
- Use PascalCase for public fields and camelCase for private fields
- Prefix interface names with "I"
- Use meaningful and descriptive names

### Example
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

## Classes and Interfaces

### Class Structure
- Declare fields first
- Constructor(s) next
- Properties after constructors
- Methods last
- Group interface implementations separately

### Example
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
            _logger.LogError(ex, "Error getting entity {EntityType} with ID {Id}", typeof(TEntity).Name, id);
            throw;
        }
    }
}
```

## Methods

### Method Organization
- Public methods first
- Private methods last
- Group related methods together
- Method names should describe their behavior

### Example
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
            throw new ValidationException("Invalid data");
    }

    private async Task<TResult> TransformDataAsync<TResult>(T data)
    {
        // Data transformation logic
        return default;
    }

    private async Task<ProcessResult<T>> SaveDataAsync(T data, object transformedData)
    {
        // Data saving logic
        return new ProcessResult<T>();
    }
}
```

## Properties

### Property Declarations
- Use auto-implemented properties when no additional logic is needed
- Use full property declaration when custom logic is required
- Consider using init-only properties for immutable objects

### Example
```csharp
public class BaseEntity
{
    // Auto-implemented property
    public int Id { get; set; }
    
    // Read-only property
    public string Code { get; init; }
    
    // Private set property
    public DateTime CreatedDate { get; private set; }
    
    // Full property declaration
    private string _name;
    public string Name
    {
        get => _name;
        set
        {
            if (string.IsNullOrEmpty(value))
                throw new ArgumentException("Name cannot be empty");
            _name = value;
        }
    }
}
```

## Fields

### Field Declarations
- Prefix private fields with underscore
- Declare fields as readonly when possible
- Group fields by access level and purpose

### Example
```csharp
public class BaseProcessor
{
    // Constants
    private const int DefaultRetryCount = 3;
    
    // Private readonly fields
    private readonly ILogger<BaseProcessor> _logger;
    private readonly string _identifier;
    
    // Private mutable fields
    private int _processCount;
    private bool _isProcessing;
    
    public BaseProcessor(ILogger<BaseProcessor> logger)
    {
        _logger = logger;
        _identifier = GenerateIdentifier();
    }
}
```

## Error Handling

### Exception Handling
- Use try-catch blocks for expected exceptions
- Log exceptions with appropriate level
- Include relevant context in exception messages
- Consider custom exception types

### Example
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
            _logger.LogWarning(ex, "Data validation failed for {DataType}", typeof(T).Name);
            throw new DataValidationException($"Data validation failed: {ex.Message}", ex);
        }
        catch (DbException ex)
        {
            _logger.LogError(ex, "Database error while processing data of type {DataType}", typeof(T).Name);
            throw new DataProcessException("Unable to process data due to database error", ex);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error while processing data of type {DataType}", typeof(T).Name);
            throw;
        }
    }
}
```

## Comments and Documentation

### Code Documentation
- Use XML comments for public APIs
- Add summary comments for complex logic
- Use inline comments sparingly
- Document assumptions and important notes

### Example
```csharp
/// <summary>
/// Process data request
/// </summary>
/// <typeparam name="T">Type of data to process</typeparam>
/// <param name="data">Data to process</param>
/// <returns>Processing result</returns>
/// <exception cref="DataValidationException">Thrown when data validation fails</exception>
/// <exception cref="DataProcessException">Thrown when data processing encounters an error</exception>
public async Task<ProcessResult<T>> ProcessDataAsync<T>(T data) where T : class
{
    // Validate request
    if (!await ValidateDataAsync(data))
    {
        throw new DataValidationException("Invalid data");
    }

    // Important: Must check data state before processing
    if (!await CheckStateAsync(data))
    {
        return new ProcessResult<T> { Status = ProcessStatus.InvalidState };
    }

    /* 
     * Processing flow:
     * 1. Lock resource
     * 2. Process data
     * 3. Update state
     * 4. Unlock resource
     */
    return await ProcessDataInternalAsync(data);
}
```

## Best Practices

### General Guidelines
- Follow SOLID principles
- Keep methods and classes focused and single-purpose
- Use dependency injection for better testability
- Implement interfaces for loose coupling
- Use async/await for asynchronous operations
- Cache expensive operations when appropriate
- Use strong typing over dynamic types
- Prefer composition over inheritance

### Example
```csharp
// Bad practice
public class DataService
{
    private readonly SqlConnection _connection;
    
    public DataService()
    {
        _connection = new SqlConnection("connection_string");
    }
    
    public T GetData<T>(int id) where T : class
    {
        // Direct data access implementation
        return default;
    }
}

// Good practice
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

## Unit Testing

### Testing Guidelines
- Follow AAA (Arrange-Act-Assert) pattern
- Test one behavior per test
- Use meaningful test names
- Avoid testing implementation details

### Example
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

## Asynchronous Programming

### Async Guidelines
- Use async/await consistently
- Avoid using .Result or .Wait()
- Properly propagate cancellation tokens
- Handle async exceptions appropriately

### Example
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
            // Validate data
            await ValidateAsync(data, cancellationToken);

            // Process data
            var processResult = await _dataService
                .ProcessAsync(data, cancellationToken);

            if (!processResult.IsSuccessful)
            {
                throw new ProcessException(processResult.Error);
            }

            // Save data
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
            _logger.LogInformation("Processing was cancelled for {DataType}", typeof(T).Name);
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing {DataType}", typeof(T).Name);
            throw;
        }
    }
}
```

## LINQ Usage

### LINQ Guidelines
- Prefer method syntax over query syntax
- Use deferred execution appropriately
- Avoid multiple executions of the same query
- Be mindful of performance implications

### Example
```csharp
public class DataService<T> where T : class
{
    private readonly IRepository<T> _repository;

    public async Task<IEnumerable<TResult>> GetFilteredDataAsync<TResult>(
        Expression<Func<T, bool>> filter,
        Expression<Func<T, TResult>> selector)
    {
        // Good practice: Using method syntax
        var data = await _repository.GetAllAsync();
        
        var result = data
            .Where(filter.Compile())
            .Select(selector.Compile())
            .ToList(); // Immediate execution

        return result;
    }

    public async Task<decimal> CalculateAverageAsync(
        Expression<Func<T, decimal>> valueSelector)
    {
        var data = await _repository.GetAllAsync();
        
        // Avoid multiple executions of the same query
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

## Dependency Injection

### DI Guidelines
- Use constructor injection
- Register appropriate lifetimes
- Avoid service locator pattern
- Use appropriate service collection extension methods

### Example
```csharp
// Service registration
public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Singleton services
        services.AddSingleton<IConnectionFactory, ConnectionFactory>();
        
        // Scoped services
        services.AddScoped(typeof(IDataService<>), typeof(DataService<>));
        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        
        // Transient services
        services.AddTransient<INotificationService, NotificationService>();

        // Configuration options
        services.Configure<AppSettings>(
            configuration.GetSection("AppSettings"));

        return services;
    }
}

// Service usage
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


These guidelines should be adjusted and expanded based on project-specific requirements. It is recommended to review and update these guidelines periodically to ensure they meet team needs and current best practices. 