# DelegatingHandler 設計規範

> 本文說明 PaymentService 專案中 DelegatingHandler 的設計原則與實作規範，DelegatingHandler 負責處理所有**輸出到外部**的 HTTP 請求。

---

## DelegatingHandler 概述

### 在架構中的位置

```
                                        輸出到外部 (右邊)
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Service / Repository                                        │
│      ↓ 呼叫 HttpClient                                      │
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
│  │   │   │   │ (實際發送 HTTP 請求)         │   │   │   │    │
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

| 特性 | Middleware | DelegatingHandler |
|------|------------|-------------------|
| **處理方向** | 進入系統（左邊） | 輸出到外部（右邊） |
| **管道** | ASP.NET Core Request Pipeline | HttpClient Pipeline |
| **用途** | 請求日誌、異常處理、認證 | 重試、超時、外部呼叫日誌 |
| **註冊位置** | `Startup.Configure()` | `Startup.ConfigureServices()` |

---

## DelegatingHandler 管道概念

### 管道執行順序

```csharp
// 註冊順序決定執行順序（由外到內）
services.AddHttpClient("PaymentGateway")
    .AddHttpMessageHandler<LoggingDelegatingHandler>()    // 第 1 層（最外）
    .AddHttpMessageHandler<RetryDelegatingHandler>()      // 第 2 層
    .AddHttpMessageHandler<TimeoutDelegatingHandler>();   // 第 3 層（最內）
```

### 請求/回應流程

```
Request 發出 →
    LoggingDelegatingHandler.before()
        RetryDelegatingHandler.before()
            TimeoutDelegatingHandler.before()
                HttpClientHandler.SendAsync()  // 實際發送
            TimeoutDelegatingHandler.after()
        RetryDelegatingHandler.after()
    LoggingDelegatingHandler.after()
← Response 回傳
```

---

## LoggingDelegatingHandler

### 職責

記錄所有對外 HTTP 呼叫的請求與回應。

### 實作

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

            // 記錄請求
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
                // 發送請求
                var response = await base.SendAsync(request, cancellationToken);

                stopwatch.Stop();

                // 記錄回應
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

### 職責

對失敗的請求進行重試，處理暫時性錯誤。

### 實作

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
                    // 複製請求（因為請求只能發送一次）
                    var clonedRequest = await CloneRequestAsync(request);

                    response = await base.SendAsync(clonedRequest, cancellationToken);

                    // 成功或非暫時性錯誤，不重試
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
                    // 超時，視為暫時性錯誤
                    lastException = ex;
                    _logger.LogWarning(
                        "Request to {Uri} timed out, attempt {Attempt}/{MaxRetries}",
                        request.RequestUri,
                        attempt,
                        _maxRetries);
                }

                // 等待後重試（指數退避）
                if (attempt < _maxRetries)
                {
                    var delay = TimeSpan.FromMilliseconds(
                        _retryDelay.TotalMilliseconds * Math.Pow(2, attempt - 1));
                    await Task.Delay(delay, cancellationToken);
                }
            }

            // 所有重試都失敗
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
            // 網路錯誤通常是暫時性的
            return true;
        }

        private async Task<HttpRequestMessage> CloneRequestAsync(HttpRequestMessage request)
        {
            var clone = new HttpRequestMessage(request.Method, request.RequestUri);

            // 複製 Headers
            foreach (var header in request.Headers)
            {
                clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
            }

            // 複製 Content
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

### 使用 Polly 簡化重試

```csharp
// 使用 Polly NuGet 套件簡化重試邏輯
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

### 職責

控制單一請求的超時時間。

### 實作

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

## DI 註冊

### 完整註冊範例

```csharp
// Startup.cs
public void ConfigureServices(IServiceCollection services)
{
    // 註冊 Handler（必須是 Transient）
    services.AddTransient<LoggingDelegatingHandler>();
    services.AddTransient<RetryDelegatingHandler>();
    services.AddTransient<TimeoutDelegatingHandler>();

    // 註冊 HttpClient 並添加 Handler
    services.AddHttpClient("PaymentGateway", client =>
    {
        client.BaseAddress = new Uri("https://api.payment-gateway.com/");
        client.DefaultRequestHeaders.Add("Accept", "application/json");
    })
    .AddHttpMessageHandler<LoggingDelegatingHandler>()    // 第 1 層（日誌）
    .AddHttpMessageHandler<RetryDelegatingHandler>()      // 第 2 層（重試）
    .AddHttpMessageHandler<TimeoutDelegatingHandler>();   // 第 3 層（超時）

    // 為不同的外部服務配置不同的 HttpClient
    services.AddHttpClient("ThirdPartyAPI", client =>
    {
        client.BaseAddress = new Uri("https://api.third-party.com/");
    })
    .AddHttpMessageHandler<LoggingDelegatingHandler>();  // 只需日誌
}
```

### 使用 HttpClient

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

## Handler 順序設計

### 建議順序

```
1. LoggingDelegatingHandler    ← 最外層：記錄所有請求/回應（包含重試）
2. RetryDelegatingHandler      ← 中間層：處理重試邏輯
3. TimeoutDelegatingHandler    ← 最內層：控制單一請求超時
4. HttpClientHandler           ← 實際發送（系統內建）
```

### 順序說明

| 位置 | Handler | 原因 |
|------|---------|------|
| 1（最外） | Logging | 記錄所有請求，包含重試的每次請求 |
| 2（中間） | Retry | 在超時後進行重試 |
| 3（最內） | Timeout | 控制單一請求的超時 |

---

## ✅ Review Checklist

### Handler 設計檢查

- [ ] 是否使用 `base.SendAsync()` 呼叫下一層？
- [ ] 是否正確處理 CancellationToken？
- [ ] 是否有適當的日誌記錄？
- [ ] 重試是否複製了請求（請求只能發送一次）？

### 註冊檢查

- [ ] Handler 是否註冊為 Transient？
- [ ] Handler 順序是否正確（Logging → Retry → Timeout）？
- [ ] 是否為不同的外部服務配置不同的 HttpClient？

### 效能檢查

- [ ] 超時設定是否合理？
- [ ] 重試次數是否適當？
- [ ] 重試延遲是否使用指數退避？

---

## ✅ 新人常見踩雷點

### 1. 忘記呼叫 base.SendAsync

```csharp
// ❌ 錯誤：忘記呼叫 base.SendAsync
protected override async Task<HttpResponseMessage> SendAsync(
    HttpRequestMessage request,
    CancellationToken cancellationToken)
{
    _logger.LogInformation("Request: {Uri}", request.RequestUri);
    // 忘記 return await base.SendAsync(request, cancellationToken);
    return null;  // 請求永遠不會發送
}

// ✅ 正確：呼叫 base.SendAsync
protected override async Task<HttpResponseMessage> SendAsync(
    HttpRequestMessage request,
    CancellationToken cancellationToken)
{
    _logger.LogInformation("Request: {Uri}", request.RequestUri);
    return await base.SendAsync(request, cancellationToken);
}
```

### 2. 重試時未複製請求

```csharp
// ❌ 錯誤：重複使用同一個請求
for (int i = 0; i < maxRetries; i++)
{
    var response = await base.SendAsync(request, cancellationToken);  // 第二次會失敗
}

// ✅ 正確：每次重試複製請求
for (int i = 0; i < maxRetries; i++)
{
    var clonedRequest = await CloneRequestAsync(request);
    var response = await base.SendAsync(clonedRequest, cancellationToken);
}
```

### 3. Handler 順序錯誤

```csharp
// ❌ 錯誤：Timeout 在 Retry 外層
.AddHttpMessageHandler<TimeoutDelegatingHandler>()  // 整體超時，重試無效
.AddHttpMessageHandler<RetryDelegatingHandler>()

// ✅ 正確：Retry 在 Timeout 外層
.AddHttpMessageHandler<RetryDelegatingHandler>()    // 可以重試
.AddHttpMessageHandler<TimeoutDelegatingHandler>()  // 單一請求超時
```

### 4. Handler 註冊為 Singleton

```csharp
// ❌ 錯誤：註冊為 Singleton（可能有狀態問題）
services.AddSingleton<LoggingDelegatingHandler>();

// ✅ 正確：註冊為 Transient
services.AddTransient<LoggingDelegatingHandler>();
```

---

## ✅ TL / Reviewer 檢查重點

### 架構審查

| 檢查項目 | 警示信號 |
|----------|----------|
| 順序錯誤 | Timeout 在 Retry 外層 |
| 缺少日誌 | 沒有 LoggingDelegatingHandler |
| 重試問題 | 重試時未複製請求 |

### 設定審查

- [ ] 超時時間是否符合 SLA 要求？
- [ ] 重試策略是否使用指數退避？
- [ ] 是否有針對不同服務的不同配置？

### 錯誤處理審查

- [ ] 是否正確處理 TaskCanceledException？
- [ ] 是否區分超時和使用者取消？
- [ ] 是否有完整的錯誤日誌？

---

> **文件版本**: v1.0
> **最後更新**: 2024-11
