# Exception Handling and Error Management

> This document explains the design specifications for exception handling and error management in the PaymentService project, including core components such as PaymentServiceException, GlobalExceptionMiddleware, and PaymentError.

---

## Exception Handling Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request                                               │
│      ↓                                                      │
├─────────────────────────────────────────────────────────────┤
│  GlobalExceptionMiddleware                                   │
│      ↓ try-catch wraps entire pipeline                      │
├─────────────────────────────────────────────────────────────┤
│  Controller → Service → Repository                          │
│      ↓ throws exception                                     │
├─────────────────────────────────────────────────────────────┤
│  PaymentServiceException ─────→ HTTP 200 + Business Error Code │
│  Other Exception ────────────→ HTTP 500 + SystemError        │
└─────────────────────────────────────────────────────────────┘
```

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Centralized Handling** | All exceptions handled uniformly by GlobalExceptionMiddleware |
| **Business vs System Separation** | Business exceptions vs system exceptions, different handling approaches |
| **Structured Errors** | Use PaymentError to define error codes and messages |
| **Don't Swallow Exceptions** | Each layer doesn't catch and swallow, let exceptions propagate upward |

---

## PaymentError Design

### Class Definition

```csharp
namespace PaymentService.Models
{
    /// <summary>
    /// Unified error definition
    /// </summary>
    public sealed record PaymentError
    {
        private PaymentError(
            int code,
            string key,
            string messageTemplate,
            ErrorCategoryEnum category,
            ErrorSeverityEnum severity)
        {
            Code = code;
            Key = key;
            MessageTemplate = messageTemplate;
            Category = category;
            Severity = severity;
        }

        /// <summary>
        /// Error code (numeric)
        /// </summary>
        public int Code { get; }

        /// <summary>
        /// Error identification key (string)
        /// </summary>
        public string Key { get; }

        /// <summary>
        /// Message template (supports {0}, {1} parameters)
        /// </summary>
        public string MessageTemplate { get; }

        /// <summary>
        /// Error category
        /// </summary>
        public ErrorCategoryEnum Category { get; }

        /// <summary>
        /// Error severity level
        /// </summary>
        public ErrorSeverityEnum Severity { get; }

        /// <summary>
        /// Format error message
        /// </summary>
        public string FormatMessage(params object[] args)
        {
            return args?.Length > 0
                ? string.Format(MessageTemplate, args)
                : MessageTemplate;
        }

        /// <summary>
        /// Get corresponding log level
        /// </summary>
        public LogLevel GetLogLevel()
        {
            return Severity switch
            {
                ErrorSeverityEnum.None => LogLevel.Information,
                ErrorSeverityEnum.Warning => LogLevel.Warning,
                ErrorSeverityEnum.Error => LogLevel.Error,
                ErrorSeverityEnum.Critical => LogLevel.Critical,
                _ => LogLevel.Information
            };
        }
    }
}
```

### Error Definition Examples

```csharp
public sealed record PaymentError
{
    // ===== System Errors =====
    public static readonly PaymentError SystemError = new(
        code: -1,
        key: "SystemError",
        messageTemplate: "An unexpected system error occurred.",
        category: ErrorCategoryEnum.System,
        severity: ErrorSeverityEnum.Critical);

    public static readonly PaymentError InvalidParameter = new(
        code: -2,
        key: "InvalidParameter",
        messageTemplate: "The parameter is invalid.",
        category: ErrorCategoryEnum.System,
        severity: ErrorSeverityEnum.Warning);

    // ===== Customer Errors =====
    public static readonly PaymentError CustomerNotFound = new(
        code: 90001,
        key: "Cu0001",
        messageTemplate: "Customer not found with {0}.",
        category: ErrorCategoryEnum.Customer,
        severity: ErrorSeverityEnum.Warning);

    // ===== Deposit Errors =====
    public static readonly PaymentError DepositChannelNotAvailable = new(
        code: 91001,
        key: "De0001",
        messageTemplate: "Deposit channel is not available for customer {0}.",
        category: ErrorCategoryEnum.Deposit,
        severity: ErrorSeverityEnum.Warning);
}
```

### Error Code Specification

| Range | Category | Description |
|-------|----------|-------------|
| -1 ~ -99 | System | System-level errors |
| 90001 ~ 90999 | Customer | Customer-related errors |
| 91001 ~ 91999 | Deposit | Deposit-related errors |
| 92001 ~ 92999 | Withdrawal | Withdrawal-related errors |

---

## ErrorCategory and ErrorSeverity

### ErrorCategoryEnum

```csharp
namespace PaymentService.Models.Enum
{
    /// <summary>
    /// Error category
    /// </summary>
    public enum ErrorCategoryEnum
    {
        System = 0,
        Customer = 1,
        Deposit = 2,
        Withdrawal = 3
    }
}
```

### ErrorSeverityEnum

```csharp
namespace PaymentService.Models.Enum
{
    /// <summary>
    /// Error severity level
    /// </summary>
    public enum ErrorSeverityEnum
    {
        /// <summary>
        /// No severity (informational)
        /// </summary>
        None = 0,

        /// <summary>
        /// Warning (expected business errors)
        /// </summary>
        Warning = 1,

        /// <summary>
        /// Error (requires attention)
        /// </summary>
        Error = 2,

        /// <summary>
        /// Critical (requires immediate action)
        /// </summary>
        Critical = 3
    }
}
```

### Severity to Log Level Mapping

| Severity | LogLevel | Use Case |
|----------|----------|----------|
| None | Information | General information |
| Warning | Warning | Expected business errors (e.g., customer not found) |
| Error | Error | Abnormal errors (requires attention) |
| Critical | Critical | Severe errors (requires immediate action) |

---

## PaymentServiceException

### Base Class

```csharp
namespace PaymentService.Exceptions
{
    /// <summary>
    /// PaymentService business exception base class
    /// </summary>
    public class PaymentServiceException : Exception, IResultInfo
    {
        public PaymentServiceException(PaymentError error, params object[] args)
            : base(error.FormatMessage(args))
        {
            Error = error;
            Args = args;
        }

        public PaymentServiceException(
            PaymentError error,
            Exception innerException,
            params object[] args)
            : base(error.FormatMessage(args), innerException)
        {
            Error = error;
            Args = args;
        }

        /// <summary>
        /// Error definition
        /// </summary>
        public PaymentError Error { get; init; }

        /// <summary>
        /// Error message arguments
        /// </summary>
        public object[] Args { get; init; }

        string IResultInfo.Message
        {
            get => base.Message;
            init { }
        }
    }
}
```

### Custom Exception Examples

```csharp
namespace PaymentService.Exceptions
{
    /// <summary>
    /// Customer not found exception
    /// </summary>
    public class CustomerNotFoundException : PaymentServiceException
    {
        public CustomerNotFoundException(int custId)
            : base(PaymentError.CustomerNotFound, $"{nameof(custId)}: {custId}")
        {
        }
    }

    /// <summary>
    /// Deposit channel not available exception
    /// </summary>
    public class DepositChannelNotAvailableException : PaymentServiceException
    {
        public DepositChannelNotAvailableException(int custId, int channelId)
            : base(PaymentError.DepositChannelNotAvailable, custId, channelId)
        {
        }
    }
}
```

### Throwing Exception Example

```csharp
// Repository layer
public async Task<CustomerContext> GetCustContextAsync(int custId)
{
    var customer = await GetCustInfoAsync(custId);

    if (customer == null)
        throw new CustomerNotFoundException(custId);  // Throw business exception

    var pointLevel = await GetPointLevelAsync(custId);
    return new CustomerContext(customer, pointLevel);
}
```

---

## GlobalExceptionMiddleware

### Implementation

```csharp
namespace PaymentService.Middlewares
{
    public class GlobalExceptionMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<GlobalExceptionMiddleware> _logger;

        public GlobalExceptionMiddleware(
            RequestDelegate next,
            ILogger<GlobalExceptionMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            try
            {
                await _next(context);
            }
            catch (Exception ex)
            {
                await HandleExceptionAsync(context, ex);
            }
        }

        private async Task HandleExceptionAsync(HttpContext context, Exception exception)
        {
            var actionPath = GetActionPath(context);

            ApiResult apiResult;
            HttpStatusCode statusCode;

            if (exception is PaymentServiceException paymentServiceEx)
            {
                // ===== Business Exception: HTTP 200 + Business Error Code =====
                statusCode = HttpStatusCode.OK;
                var paymentError = paymentServiceEx.Error!;

                apiResult = ApiResult.Failure(
                    errorCode: paymentError.Code,
                    message: paymentServiceEx.Message,
                    args: paymentServiceEx.Args);

                _logger.Log(
                    paymentError.GetLogLevel(),
                    exception,
                    "Payment service exception at {ActionPath}: {ErrorCode} - {ErrorKey} - {Message}",
                    actionPath,
                    paymentError.Code,
                    paymentError.Key,
                    paymentServiceEx.Message);
            }
            else
            {
                // ===== System Exception: HTTP 500 + SystemError =====
                var systemError = PaymentError.SystemError;
                statusCode = HttpStatusCode.InternalServerError;

                apiResult = ApiResult.Failure(
                    errorCode: systemError.Code,
                    message: systemError.FormatMessage());

                _logger.LogError(
                    exception,
                    "System exception at {ActionPath}: {ExceptionType} - {Message}",
                    actionPath,
                    exception.GetType().Name,
                    exception.Message);
            }

            // Respond with JSON
            context.Response.Clear();
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.StatusCode = (int)statusCode;

            var settings = new JsonSerializerSettings
            {
                ContractResolver = new CamelCasePropertyNamesContractResolver()
            };

            var jsonResult = JsonConvert.SerializeObject(apiResult, settings);
            await context.Response.WriteAsync(jsonResult);
        }

        private string GetActionPath(HttpContext context)
        {
            var controller = context.Request.RouteValues["controller"]?.ToString() ?? "Unknown";
            var action = context.Request.RouteValues["action"]?.ToString() ?? "Unknown";
            return $"{controller}/{action}";
        }
    }
}
```

### Middleware Registration

```csharp
// Extensions/MiddlewareExtensions.cs
public static class MiddlewareExtensions
{
    public static IApplicationBuilder UsePaymentServiceMiddlewares(
        this IApplicationBuilder app)
    {
        app.UseMiddleware<GlobalExceptionMiddleware>();
        // Other Middlewares...
        return app;
    }
}

// Startup.cs
public void Configure(IApplicationBuilder app)
{
    app.UsePaymentServiceMiddlewares();
    // ...
}
```

---

## ApiResult Unified Response Format

### Class Definition

```csharp
namespace PaymentService.Models
{
    public class ApiResult
    {
        public bool Success { get; set; }
        public int Code { get; set; }
        public string Message { get; set; }
        public object Data { get; set; }

        public static ApiResult Ok(object data = null)
        {
            return new ApiResult
            {
                Success = true,
                Code = 0,
                Message = "Success",
                Data = data
            };
        }

        public static ApiResult Failure(
            int errorCode,
            string message,
            string rawErrorCode = null,
            string rawMessage = null,
            object[] args = null)
        {
            return new ApiResult
            {
                Success = false,
                Code = errorCode,
                Message = message,
                Data = null
            };
        }
    }
}
```

### Response Examples

**Success Response**:
```json
{
  "success": true,
  "code": 0,
  "message": "Success",
  "data": { ... }
}
```

**Business Error Response** (HTTP 200):
```json
{
  "success": false,
  "code": 90001,
  "message": "Customer not found with custId: 12345.",
  "data": null
}
```

**System Error Response** (HTTP 500):
```json
{
  "success": false,
  "code": -1,
  "message": "An unexpected system error occurred.",
  "data": null
}
```

---

## Exception Handling Principles by Layer

### Domain Layer

```csharp
// Domain Model: validate business rules, throw ArgumentException
public class DepositChannel
{
    public DepositChannel WithAmountLimit(DepositLimitInfo limitInfo)
    {
        if (limitInfo == null)
            throw new ArgumentNullException(nameof(limitInfo));

        var newMin = Math.Max(MinAmount, limitInfo.MinAmount);
        var newMax = Math.Min(MaxAmount, limitInfo.MaxAmount);

        if (newMin > newMax)
            throw new InvalidOperationException(
                "No overlapping range exists. Call IsOverlappingWith() before WithAmountLimit().");

        return new DepositChannel(...);
    }
}
```

### Application Layer (Service)

```csharp
// Service: don't catch exceptions, let them propagate upward
public class DepositQueryService : IDepositQueryService
{
    public async Task<DepositChannelsByDepositType> GetDepositChannelsByDepositTypeAsync(int custId)
    {
        // No try-catch, let Repository exceptions propagate upward
        var custContext = await _customerRepository.GetCustContextAsync(custId);
        var depositChannels = await _depositRepository.GetDepositChannelsAsync(siteId);

        return depositChannels.GroupByDepositType(custContext);
    }
}
```

### Infrastructure Layer (Repository)

```csharp
// Repository: throw specific business exceptions
public class CustomerRepository : ICustomerRepository
{
    public async Task<CustomerContext> GetCustContextAsync(int custId)
    {
        var customer = await GetCustInfoAsync(custId);

        if (customer == null)
            throw new CustomerNotFoundException(custId);  // Throw business exception

        var pointLevel = await GetPointLevelAsync(custId);
        return new CustomerContext(customer, pointLevel);
    }
}
```

### Presentation Layer (Controller)

```csharp
// Controller: don't catch exceptions, let Middleware handle uniformly
[ApiController]
public class CustomerController : ControllerBase
{
    [HttpPost("GetDepositOptions")]
    public async Task<IActionResult> GetDepositOptions(GetDepositOptionsRequest request)
    {
        // No try-catch
        var result = await _depositQueryService
            .GetDepositChannelsByDepositTypeAsync(request.CustId);

        return Ok(ApiResult.Success(result));
    }
}
```

---

## Review Checklist

### PaymentError Check

- [ ] Is error code, Key, and message template defined?
- [ ] Is error code in the correct range?
- [ ] Is Severity set correctly?
- [ ] Does message template support parameterization?

### Exception Check

- [ ] Does custom exception inherit from PaymentServiceException?
- [ ] Is predefined PaymentError used?
- [ ] Are appropriate arguments passed?

### Layer Handling Check

- [ ] Does Controller have no try-catch?
- [ ] Does Service let exceptions propagate upward?
- [ ] Does Repository throw specific business exceptions?

---

## Common Pitfalls for New Developers

### 1. Catching Exceptions in Controller

```csharp
// ❌ Wrong: catch in Controller
[HttpPost("GetDepositOptions")]
public async Task<IActionResult> GetDepositOptions(int custId)
{
    try
    {
        var result = await _service.GetChannelsAsync(custId);
        return Ok(result);
    }
    catch (Exception ex)
    {
        return BadRequest(ex.Message);  // Inconsistent error format
    }
}

// ✅ Correct: let Middleware handle uniformly
[HttpPost("GetDepositOptions")]
public async Task<IActionResult> GetDepositOptions(int custId)
{
    var result = await _service.GetChannelsAsync(custId);
    return Ok(ApiResult.Success(result));
}
```

### 2. Throwing Native Exception

```csharp
// ❌ Wrong: throw native Exception
if (customer == null)
    throw new Exception("Customer not found");  // Will be treated as system error

// ✅ Correct: throw PaymentServiceException
if (customer == null)
    throw new CustomerNotFoundException(custId);  // Will be treated as business error
```

### 3. Swallowing Exceptions

```csharp
// ❌ Wrong: catch and swallow exception
public async Task<Customer> GetCustomerAsync(int custId)
{
    try
    {
        return await _repo.GetAsync(custId);
    }
    catch (Exception)
    {
        return null;  // Swallowing exception, hard to trace problems
    }
}

// ✅ Correct: let exception propagate upward
public async Task<Customer> GetCustomerAsync(int custId)
{
    return await _repo.GetAsync(custId);
}
```

### 4. Duplicate Error Codes

```csharp
// ❌ Wrong: duplicate error codes
public static readonly PaymentError CustomerNotFound = new(90001, ...);
public static readonly PaymentError CustomerInactive = new(90001, ...);  // Duplicate!

// ✅ Correct: unique error codes
public static readonly PaymentError CustomerNotFound = new(90001, ...);
public static readonly PaymentError CustomerInactive = new(90002, ...);
```

---

## TL / Reviewer Checkpoint

### Architecture Review

| Check Item | Warning Signal |
|------------|----------------|
| Controller catch | Controller has try-catch blocks |
| Native Exception | Code has `throw new Exception()` |
| Swallowing exceptions | catch block only has log or return null |
| Duplicate error codes | PaymentError definition has duplicate Code |

### Error Design Review

- [ ] Does new error type have corresponding PaymentError?
- [ ] Is error code in the correct range?
- [ ] Does Severity reflect actual severity level?

### Logging Review

- [ ] Does business exception use correct Log Level?
- [ ] Does system exception record complete stack trace?
- [ ] Is there sufficient context information?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
