# DelegatingHandler Design Specification

> This document explains the design principles and implementation specifications for DelegatingHandler in the PaymentService project. DelegatingHandler is responsible for handling all HTTP requests **going out to external services**.

---

## DelegatingHandler Overview

### Position in Architecture

```
                                        Going Out to External (right side)
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Service / Repository                                        │
│      ↓ calls HttpClient                                      │
├─────────────────────────────────────────────────────────────┤
│  HttpClient Pipeline                                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ LoggingDelegatingHandler                             │    │
│  │   ┌─────────────────────────────────────────────┐   │    │
│  │   │ RetryDelegatingHandler                       │   │    │
│  │   │   ┌─────────────────────────────────────┐   │   │    │
│  │   │   │ TimeoutDelegatingHandler             │   │   │    │
│  │   │   │   ┌─────────────────────────────┐   │   │   │    │
│  │   │   │   │ HttpClientHandler           │   │   │   │    │
│  │   │   │   │ (actually sends HTTP request)│   │   │   │    │
│  │   │   │   └─────────────────────────────┘   │   │   │    │
│  │   │   └─────────────────────────────────────┘   │   │    │
│  │   └─────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│      ↓                                                      │
├─────────────────────────────────────────────────────────────┤
│  External API                                               │
└─────────────────────────────────────────────────────────────┘
```

### Middleware vs DelegatingHandler

| Feature | Middleware | DelegatingHandler |
|---------|------------|-------------------|
| **Direction** | Entering system (left side) | Going out to external (right side) |
| **Pipeline** | ASP.NET Core Request Pipeline | HttpClient Pipeline |
| **Use Cases** | Request logging, exception handling, authentication | Retry, timeout, external call logging |
| **Registration Location** | `Startup.Configure()` | `Startup.ConfigureServices()` |

---

## DelegatingHandler Pipeline Concept

### Pipeline Execution Order

```csharp
// Registration order determines execution order (outer to inner)
services.AddHttpClient("PaymentGateway")
    .AddHttpMessageHandler<LoggingDelegatingHandler>()    // Layer 1 (outermost)
    .AddHttpMessageHandler<RetryDelegatingHandler>()      // Layer 2
    .AddHttpMessageHandler<TimeoutDelegatingHandler>();   // Layer 3 (innermost)
```

### Request/Response Flow

```
Request sent →
    LoggingDelegatingHandler.before()
        RetryDelegatingHandler.before()
            TimeoutDelegatingHandler.before()
                HttpClientHandler.SendAsync()  // Actually sends
            TimeoutDelegatingHandler.after()
        RetryDelegatingHandler.after()
    LoggingDelegatingHandler.after()
← Response returns
```

---

## LoggingDelegatingHandler

### Responsibility

Log all outgoing HTTP request and response information.

### Implementation

```csharp
namespace PaymentService.Handlers
{
    public class LoggingDelegatingHandler : DelegatingHandler
    {
        private readonly ILogger<LoggingDelegatingHandler> _logger;

        public LoggingDelegatingHandler(ILogger<LoggingDelegatingHandler> logger)
        {
            _logger = logger;
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            var requestId = Guid.NewGuid().ToString("N")[..8];
            var stopwatch = Stopwatch.StartNew();

            // Log request
            var requestBody = request.Content != null
                ? await request.Content.ReadAsStringAsync(cancellationToken)
                : null;

            _logger.LogInformation(
                "[{RequestId}] HTTP {Method} {Uri} | Body: {Body}",
                requestId,
                request.Method,
                request.RequestUri,
                requestBody);

            try
            {
                // Send request
                var response = await base.SendAsync(request, cancellationToken);

                stopwatch.Stop();

                // Log response
                var responseBody = response.Content != null
                    ? await response.Content.ReadAsStringAsync(cancellationToken)
                    : null;

                _logger.LogInformation(
                    "[{RequestId}] HTTP {StatusCode} in {ElapsedMs}ms | Body: {Body}",
                    requestId,
                    (int)response.StatusCode,
                    stopwatch.ElapsedMilliseconds,
                    responseBody);

                return response;
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                _logger.LogError(
                    ex,
                    "[{RequestId}] HTTP request failed after {ElapsedMs}ms: {Message}",
                    requestId,
                    stopwatch.ElapsedMilliseconds,
                    ex.Message);
                throw;
            }
        }
    }
}
```

---

## RetryDelegatingHandler

### Responsibility

Retry failed requests, handling transient errors.

### Implementation

```csharp
namespace PaymentService.Handlers
{
    public class RetryDelegatingHandler : DelegatingHandler
    {
        private readonly ILogger<RetryDelegatingHandler> _logger;
        private readonly int _maxRetries;
        private readonly TimeSpan _retryDelay;

        public RetryDelegatingHandler(
            ILogger<RetryDelegatingHandler> logger,
            int maxRetries = 3,
            int retryDelayMs = 1000)
        {
            _logger = logger;
            _maxRetries = maxRetries;
            _retryDelay = TimeSpan.FromMilliseconds(retryDelayMs);
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            HttpResponseMessage response = null;
            Exception lastException = null;

            for (int attempt = 1; attempt <= _maxRetries; attempt++)
            {
                try
                {
                    // Clone request (because request can only be sent once)
                    var clonedRequest = await CloneRequestAsync(request);

                    response = await base.SendAsync(clonedRequest, cancellationToken);

                    // Success or non-transient error, don't retry
                    if (response.IsSuccessStatusCode || !IsTransientError(response))
                    {
                        return response;
                    }

                    _logger.LogWarning(
                        "Request to {Uri} failed with {StatusCode}, attempt {Attempt}/{MaxRetries}",
                        request.RequestUri,
                        (int)response.StatusCode,
                        attempt,
                        _maxRetries);
                }
                catch (HttpRequestException ex) when (IsTransientException(ex))
                {
                    lastException = ex;
                    _logger.LogWarning(
                        ex,
                        "Request to {Uri} failed, attempt {Attempt}/{MaxRetries}",
                        request.RequestUri,
                        attempt,
                        _maxRetries);
                }
                catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
                {
                    // Timeout, treat as transient error
                    lastException = ex;
                    _logger.LogWarning(
                        "Request to {Uri} timed out, attempt {Attempt}/{MaxRetries}",
                        request.RequestUri,
                        attempt,
                        _maxRetries);
                }

                // Wait before retry (exponential backoff)
                if (attempt < _maxRetries)
                {
                    var delay = TimeSpan.FromMilliseconds(
                        _retryDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));
                    await Task.Delay(delay, cancellationToken);
                }
            }

            // All retries failed
            if (lastException != null)
                throw lastException;

            return response!;
        }

        private bool IsTransientError(HttpResponseMessage response)
        {
            return response.StatusCode >= HttpStatusCode.InternalServerError
                   || response.StatusCode == HttpStatusCode.RequestTimeout
                   || response.StatusCode == HttpStatusCode.TooManyRequests;
        }

        private bool IsTransientException(HttpRequestException ex)
        {
            // Network errors are usually transient
            return true;
        }

        private async Task<HttpRequestMessage> CloneRequestAsync(HttpRequestMessage request)
        {
            var clone = new HttpRequestMessage(request.Method, request.RequestUri);

            // Clone Headers
            foreach (var header in request.Headers)
            {
                clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            // Clone Content
            if (request.Content != null)
            {
                var content = await request.Content.ReadAsStringAsync();
                clone.Content = new StringContent(
                    content,
                    Encoding.UTF8,
                    request.Content.Headers.ContentType?.MediaType ?? "application/json");
            }

            return clone;
        }
    }
}
```

### Simplifying Retry with Polly

```csharp
// Use Polly NuGet package to simplify retry logic
services.AddHttpClient("PaymentGateway")
    .AddTransientHttpErrorPolicy(policy =>
        policy.WaitAndRetryAsync(
            retryCount: 3,
            sleepDurationProvider: attempt =>
                TimeSpan.FromMilliseconds(1000 * Math.Pow(2, attempt - 1)),
            onRetry: (outcome, delay, attempt, context) =>
            {
                logger.LogWarning(
                    "Retry {Attempt} after {Delay}ms",
                    attempt, delay.TotalMilliseconds);
            }));
```

---

## TimeoutDelegatingHandler

### Responsibility

Control timeout for individual requests.

### Implementation

```csharp
namespace PaymentService.Handlers
{
    public class TimeoutDelegatingHandler : DelegatingHandler
    {
        private readonly TimeSpan _timeout;
        private readonly ILogger<TimeoutDelegatingHandler> _logger;

        public TimeoutDelegatingHandler(
            ILogger<TimeoutDelegatingHandler> logger,
            TimeSpan? timeout = null)
        {
            _logger = logger;
            _timeout = timeout ?? TimeSpan.FromSeconds(30);
        }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(_timeout);

            try
            {
                return await base.SendAsync(request, cts.Token);
            }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Request to {Uri} timed out after {Timeout}ms",
                    request.RequestUri,
                    _timeout.TotalMilliseconds);

                throw new TimeoutException(
                    $"Request to {request.RequestUri} timed out after {_timeout.TotalMilliseconds}ms");
            }
        }
    }
}
```

---

## DI Registration

### Complete Registration Example

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // Register Handlers (must be Transient)
    services.AddTransient<LoggingDelegatingHandler>();
    services.AddTransient<RetryDelegatingHandler>();
    services.AddTransient<TimeoutDelegatingHandler>();

    // Register HttpClient and add Handlers
    services.AddHttpClient("PaymentGateway", client =>
    {
        client.BaseAddress = new Uri("https://api.payment-gateway.com/");
        client.DefaultRequestHeaders.Add("Accept", "application/json");
    })
    .AddHttpMessageHandler<LoggingDelegatingHandler>()    // Layer 1 (Logging)
    .AddHttpMessageHandler<RetryDelegatingHandler>()      // Layer 2 (Retry)
    .AddHttpMessageHandler<TimeoutDelegatingHandler>();   // Layer 3 (Timeout)

    // Configure different HttpClient for different external services
    services.AddHttpClient("ThirdPartyAPI", client =>
    {
        client.BaseAddress = new Uri("https://api.third-party.com/");
    })
    .AddHttpMessageHandler<LoggingDelegatingHandler>();  // Only needs logging
}
```

### Using HttpClient

```csharp
public class PaymentGatewayClient
{
    private readonly HttpClient _httpClient;

    public PaymentGatewayClient(IHttpClientFactory httpClientFactory)
    {
        _httpClient = httpClientFactory.CreateClient("PaymentGateway");
    }

    public async Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request)
    {
        var response = await _httpClient.PostAsJsonAsync("/payments", request);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<PaymentResult>();
    }
}
```

---

## Handler Order Design

### Recommended Order

```
1. LoggingDelegatingHandler    ← Outermost: log all requests/responses (including retries)
2. RetryDelegatingHandler      ← Middle: handle retry logic
3. TimeoutDelegatingHandler    ← Innermost: control individual request timeout
4. HttpClientHandler           ← Actually sends (built-in)
```

### Order Explanation

| Position | Handler | Reason |
|----------|---------|--------|
| 1 (outermost) | Logging | Log all requests, including each retry request |
| 2 (middle) | Retry | Retry after timeout |
| 3 (innermost) | Timeout | Control individual request timeout |

---

## Review Checklist

### Handler Design Check

- [ ] Is `base.SendAsync()` used to call next layer?
- [ ] Is CancellationToken handled correctly?
- [ ] Is there appropriate logging?
- [ ] Is request cloned for retry (request can only be sent once)?

### Registration Check

- [ ] Are Handlers registered as Transient?
- [ ] Is Handler order correct (Logging → Retry → Timeout)?
- [ ] Are different HttpClients configured for different external services?

### Performance Check

- [ ] Is timeout setting reasonable?
- [ ] Is retry count appropriate?
- [ ] Does retry delay use exponential backoff?

---

## Common Pitfalls for New Developers

### 1. Forgetting to Call base.SendAsync

```csharp
// ❌ Wrong: forgot to call base.SendAsync
protected override async Task<HttpResponseMessage> SendAsync(
    HttpRequestMessage request,
    CancellationToken cancellationToken)
{
    _logger.LogInformation("Request: {Uri}", request.RequestUri);
    // Forgot return await base.SendAsync(request, cancellationToken);
    return null;  // Request will never be sent
}

// ✅ Correct: call base.SendAsync
protected override async Task<HttpResponseMessage> SendAsync(
    HttpRequestMessage request,
    CancellationToken cancellationToken)
{
    _logger.LogInformation("Request: {Uri}", request.RequestUri);
    return await base.SendAsync(request, cancellationToken);
}
```

### 2. Not Cloning Request During Retry

```csharp
// ❌ Wrong: reusing same request
for (int i = 0; i < maxRetries; i++)
{
    var response = await base.SendAsync(request, cancellationToken);  // Second time will fail
}

// ✅ Correct: clone request for each retry
for (int i = 0; i < maxRetries; i++)
{
    var clonedRequest = await CloneRequestAsync(request);
    var response = await base.SendAsync(clonedRequest, cancellationToken);
}
```

### 3. Wrong Handler Order

```csharp
// ❌ Wrong: Timeout outside Retry
.AddHttpMessageHandler<TimeoutDelegatingHandler>()  // Overall timeout, retry ineffective
.AddHttpMessageHandler<RetryDelegatingHandler>()

// ✅ Correct: Retry outside Timeout
.AddHttpMessageHandler<RetryDelegatingHandler>()    // Can retry
.AddHttpMessageHandler<TimeoutDelegatingHandler>()  // Individual request timeout
```

### 4. Handler Registered as Singleton

```csharp
// ❌ Wrong: registered as Singleton (may have state issues)
services.AddSingleton<LoggingDelegatingHandler>();

// ✅ Correct: registered as Transient
services.AddTransient<LoggingDelegatingHandler>();
```

---

## TL / Reviewer Checkpoint

### Architecture Review

| Check Item | Warning Signal |
|------------|----------------|
| Wrong order | Timeout outside Retry |
| Missing logging | No LoggingDelegatingHandler |
| Retry issue | Request not cloned during retry |

### Configuration Review

- [ ] Does timeout meet SLA requirements?
- [ ] Does retry strategy use exponential backoff?
- [ ] Are there different configurations for different services?

### Error Handling Review

- [ ] Is TaskCanceledException handled correctly?
- [ ] Is timeout distinguished from user cancellation?
- [ ] Is there complete error logging?

---

> **Document Version**: v1.0
> **Last Updated**: 2024-11
