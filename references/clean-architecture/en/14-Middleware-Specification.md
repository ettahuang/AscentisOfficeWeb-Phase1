# Middleware Design Specification

> This document explains the design principles and implementation specifications for Middleware in the PaymentService project. Middleware is responsible for handling all HTTP requests **entering the system**.

---

## Middleware Overview

### Position in Architecture

```
                    Entering System (left side)
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  HTTP Request                                               │
│      ↓                                                      │
├─────────────────────────────────────────────────────────────┤
│  Middleware Pipeline                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ GlobalExceptionMiddleware                            │    │
│  │   ┌─────────────────────────────────────────────┐   │    │
│  │   │ RequestLogMiddleware                         │   │    │
│  │   │   ┌─────────────────────────────────────┐   │   │    │
│  │   │   │ ResponseLogMiddleware                │   │   │    │
│  │   │   │   ┌─────────────────────────────┐   │   │   │    │
│  │   │   │   │ Controller                   │   │   │   │    │
│  │   │   │   └─────────────────────────────┘   │   │   │    │
│  │   │   └─────────────────────────────────────┘   │   │    │
│  │   └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│      ↓                                                      │
├─────────────────────────────────────────────────────────────┤
│  HTTP Response                                              │
└─────────────────────────────────────────────────────────────┘
```

### Middleware vs DelegatingHandler

| Feature | Middleware | DelegatingHandler |
|---------|------------|-------------------|
| **Handles** | HTTP requests entering the system | HTTP requests going out to external services |
| **Location** | ASP.NET Core pipeline | HttpClient pipeline |
| **Use Cases** | Request/response logging, exception handling, authentication | Retry, timeout, external call logging |

---

## Middleware Pipeline Concept

### Pipeline Execution Order

```csharp
// Registration order determines execution order
app.UseMiddleware<GlobalExceptionMiddleware>();  // 1st
app.UseMiddleware<RequestLogMiddleware>();       // 2nd
app.UseMiddleware<ResponseLogMiddleware>();      // 3rd
```

### Request/Response Flow

```
Request enters →
    GlobalExceptionMiddleware.before()
        RequestLogMiddleware.before()
            ResponseLogMiddleware.before()
                Controller.Action()
            ResponseLogMiddleware.after()
        RequestLogMiddleware.after()
    GlobalExceptionMiddleware.after()
← Response returns
```

### Onion Model

```
          Request →                           ← Response
              │                                    │
    ┌─────────▼────────────────────────────────────┴─────────┐
    │    GlobalExceptionMiddleware                           │
    │  ┌─────────────────────────────────────────────────┐   │
    │  │    RequestLogMiddleware                         │   │
    │  │  ┌───────────────────────────────────────────┐  │   │
    │  │  │    ResponseLogMiddleware                  │  │   │
    │  │  │  ┌─────────────────────────────────────┐  │  │   │
    │  │  │  │         Controller                  │  │  │   │
    │  │  │  └─────────────────────────────────────┘  │  │   │
    │  │  └───────────────────────────────────────────┘  │   │
    │  └─────────────────────────────────────────────────┘   │
    └────────────────────────────────────────────────────────┘
```

---

## GlobalExceptionMiddleware

### Responsibility

Uniformly handle all exceptions in the pipeline, ensuring all exceptions have a consistent response format.

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
                // Execute subsequent pipeline
                await _next(context);
            }
            catch (Exception ex)
            {
                // Uniformly handle exception
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
                // Business exception: HTTP 200 + business error code
                statusCode = HttpStatusCode.OK;
                var paymentError = paymentServiceEx.Error!;

                apiResult = ApiResult.Failure(
                    errorCode: paymentError.Code,
                    message: paymentServiceEx.Message,
                    args: paymentServiceEx.Args);

                _logger.Log(
                    paymentError.GetLogLevel(),
                    exception,
                    "Payment service exception at {ActionPath}: {ErrorCode} - {Message}",
                    actionPath, paymentError.Code, paymentServiceEx.Message);
            }
            else
            {
                // System exception: HTTP 500
                statusCode = HttpStatusCode.InternalServerError;
                apiResult = ApiResult.Failure(
                    errorCode: PaymentError.SystemError.Code,
                    message: PaymentError.SystemError.FormatMessage());

                _logger.LogError(
                    exception,
                    "System exception at {ActionPath}: {ExceptionType} - {Message}",
                    actionPath, exception.GetType().Name, exception.Message);
            }

            context.Response.Clear();
            context.Response.ContentType = "application/json; charset=utf-8";
            context.Response.StatusCode = (int)statusCode;

            var json = JsonConvert.SerializeObject(apiResult,
                new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver()
                });

            await context.Response.WriteAsync(json);
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

---

## RequestLogMiddleware

### Responsibility

Log all HTTP request information entering the system.

### Implementation

```csharp
namespace PaymentService.Middlewares
{
    public class RequestLogMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<RequestLogMiddleware> _logger;

        public RequestLogMiddleware(
            RequestDelegate next,
            ILogger<RequestLogMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Log request start
            var requestId = Guid.NewGuid().ToString("N")[..8];
            var stopwatch = Stopwatch.StartNew();

            // Read Request Body
            context.Request.EnableBuffering();
            var requestBody = await ReadRequestBodyAsync(context.Request);

            _logger.LogInformation(
                "[{RequestId}] Request: {Method} {Path} | Body: {Body}",
                requestId,
                context.Request.Method,
                context.Request.Path,
                requestBody);

            // Store RequestId for subsequent use
            context.Items["RequestId"] = requestId;

            try
            {
                await _next(context);
            }
            finally
            {
                stopwatch.Stop();
                _logger.LogInformation(
                    "[{RequestId}] Request completed in {ElapsedMs}ms | Status: {StatusCode}",
                    requestId,
                    stopwatch.ElapsedMilliseconds,
                    context.Response.StatusCode);
            }
        }

        private async Task<string> ReadRequestBodyAsync(HttpRequest request)
        {
            request.Body.Position = 0;
            using var reader = new StreamReader(
                request.Body,
                Encoding.UTF8,
                leaveOpen: true);
            var body = await reader.ReadToEndAsync();
            request.Body.Position = 0;
            return body;
        }
    }
}
```

---

## ResponseLogMiddleware

### Responsibility

Log all response content (optional, for debugging).

### Implementation

```csharp
namespace PaymentService.Middlewares
{
    public class ResponseLogMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly ILogger<ResponseLogMiddleware> _logger;

        public ResponseLogMiddleware(
            RequestDelegate next,
            ILogger<ResponseLogMiddleware> logger)
        {
            _next = next;
            _logger = logger;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // Replace Response.Body to enable reading
            var originalBody = context.Response.Body;
            using var memoryStream = new MemoryStream();
            context.Response.Body = memoryStream;

            await _next(context);

            // Read Response Body
            memoryStream.Position = 0;
            var responseBody = await new StreamReader(memoryStream).ReadToEndAsync();
            memoryStream.Position = 0;

            var requestId = context.Items["RequestId"]?.ToString() ?? "Unknown";

            // Only log non-success responses or debug mode
            if (context.Response.StatusCode >= 400)
            {
                _logger.LogWarning(
                    "[{RequestId}] Response: {StatusCode} | Body: {Body}",
                    requestId,
                    context.Response.StatusCode,
                    responseBody);
            }

            // Copy back to original Body
            await memoryStream.CopyToAsync(originalBody);
            context.Response.Body = originalBody;
        }
    }
}
```

---

## Middleware Registration

### Registration Order

```csharp
// Extensions/MiddlewareExtensions.cs
namespace PaymentService.Extensions
{
    public static class MiddlewareExtensions
    {
        public static IApplicationBuilder UsePaymentServiceMiddlewares(
            this IApplicationBuilder app)
        {
            // 1. Exception handling must be outermost
            app.UseMiddleware<GlobalExceptionMiddleware>();

            // 2. Request logging
            app.UseMiddleware<RequestLogMiddleware>();

            // 3. Response logging (optional)
            // app.UseMiddleware<ResponseLogMiddleware>();

            return app;
        }
    }
}

// Startup.cs
public void Configure(IApplicationBuilder app)
{
    // ...
    app.UseRouting();

    app.UsePaymentServiceMiddlewares();  // Use extension method

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapControllers();
    });
}
```

### Importance of Registration Order

```csharp
// ✅ Correct order: exception handling outermost
app.UseMiddleware<GlobalExceptionMiddleware>();  // Can catch all exceptions
app.UseMiddleware<RequestLogMiddleware>();

// ❌ Wrong order: exception handling inner
app.UseMiddleware<RequestLogMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();  // Cannot catch RequestLogMiddleware exceptions
```

---

## Middleware Design Principles

### Principle 1: Single Responsibility

Each Middleware handles only one concern:

```csharp
// ✅ Correct: single responsibility
public class RequestLogMiddleware { ... }      // Only log requests
public class ResponseLogMiddleware { ... }     // Only log responses
public class GlobalExceptionMiddleware { ... } // Only handle exceptions

// ❌ Wrong: multiple responsibilities
public class AllInOneMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        LogRequest();       // Log request
        LogResponse();      // Log response
        HandleException();  // Handle exception
        Authenticate();     // Authenticate
        // Doing too many things
    }
}
```

### Principle 2: Don't Modify Business Logic

Middleware only handles cross-cutting concerns, no business logic:

```csharp
// ✅ Correct: only handle cross-cutting concerns
public async Task InvokeAsync(HttpContext context)
{
    _logger.LogInformation("Request: {Path}", context.Request.Path);
    await _next(context);
}

// ❌ Wrong: contains business logic
public async Task InvokeAsync(HttpContext context)
{
    var custId = GetCustIdFromRequest(context);
    if (custId < 1000)  // Business logic!
    {
        context.Response.StatusCode = 403;
        return;
    }
    await _next(context);
}
```

### Principle 3: Ensure Calling _next

Unless short-circuiting the request, must call `_next(context)`:

```csharp
// ✅ Correct: call _next
public async Task InvokeAsync(HttpContext context)
{
    // Pre-processing
    await _next(context);  // Must call
    // Post-processing
}

// ⚠️ Short-circuit request (with specific reason)
public async Task InvokeAsync(HttpContext context)
{
    if (!IsAuthorized(context))
    {
        context.Response.StatusCode = 401;
        return;  // Don't call _next, short-circuit request
    }
    await _next(context);
}
```

---

## Review Checklist

### Middleware Design Check

- [ ] Does it only handle a single concern?
- [ ] Does it not contain business logic?
- [ ] Does it correctly call `_next(context)`?
- [ ] Is exception handling Middleware outermost?

### Registration Order Check

- [ ] Is GlobalExceptionMiddleware registered first?
- [ ] Is logging Middleware after exception handling?
- [ ] Is extension method used for unified management?

### Performance Check

- [ ] Is unnecessary Response Body reading avoided?
- [ ] Is async/await used correctly?
- [ ] Is there potential memory leak?

---

## Common Pitfalls for New Developers

### 1. Exception Handling Middleware Not Outermost

```csharp
// ❌ Wrong: exception handling not outermost
app.UseMiddleware<RequestLogMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();

// ✅ Correct: exception handling outermost
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<RequestLogMiddleware>();
```

### 2. Forgetting to Call _next

```csharp
// ❌ Wrong: forgot to call _next
public async Task InvokeAsync(HttpContext context)
{
    _logger.LogInformation("Request received");
    // Forgot await _next(context);
    // Request will never reach Controller
}

// ✅ Correct: call _next
public async Task InvokeAsync(HttpContext context)
{
    _logger.LogInformation("Request received");
    await _next(context);
}
```

### 3. Handling Business Logic in Middleware

```csharp
// ❌ Wrong: business logic in Middleware
public async Task InvokeAsync(HttpContext context)
{
    var custId = int.Parse(context.Request.Query["custId"]);
    var customer = await _customerRepo.GetAsync(custId);

    if (customer.VipLevel < 3)  // Business logic!
    {
        context.Response.StatusCode = 403;
        return;
    }

    await _next(context);
}

// ✅ Correct: business logic in Controller/Service
public async Task InvokeAsync(HttpContext context)
{
    // Only do cross-cutting concern handling
    await _next(context);
}
```

### 4. Not Resetting Position After Reading Request Body

```csharp
// ❌ Wrong: didn't reset Body Position
public async Task InvokeAsync(HttpContext context)
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();
    // Body already read, subsequent cannot read again

    await _next(context);  // Controller cannot read Body
}

// ✅ Correct: reset Body Position
public async Task InvokeAsync(HttpContext context)
{
    context.Request.EnableBuffering();

    using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
    var body = await reader.ReadToEndAsync();
    context.Request.Body.Position = 0;  // Reset position

    await _next(context);
}
```

---

## TL / Reviewer Checkpoint

### Architecture Review

| Check Item | Warning Signal |
|------------|----------------|
| Wrong order | GlobalExceptionMiddleware not first |
| Mixed responsibilities | Single Middleware handles multiple concerns |
| Business logic | Middleware has database queries or business judgments |

### Performance Review

- [ ] Is there unnecessary Response Body interception?
- [ ] Is logging too detailed affecting performance?
- [ ] Is there synchronous blocking operation?

### Maintainability Review

- [ ] Does Middleware have appropriate documentation comments?
- [ ] Is extension method used for unified registration?
- [ ] Is error handling complete?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
