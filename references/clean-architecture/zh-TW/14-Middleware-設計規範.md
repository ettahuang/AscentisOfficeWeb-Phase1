# Middleware 設計規範

> 本文說明 PaymentService 專案中 Middleware 的設計原則與實作規範，Middleware 負責處理所有**進入系統**的 HTTP 請求。

---

## Middleware 概述

### 在架構中的位置

```
                    進入系統 (左邊)
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

| 特性 | Middleware | DelegatingHandler |
|------|------------|-------------------|
| **處理對象** | 進入系統的 HTTP 請求 | 輸出到外部的 HTTP 請求 |
| **位置** | ASP.NET Core 管道 | HttpClient 管道 |
| **用途** | 請求/回應日誌、異常處理、認證 | 重試、超時、外部呼叫日誌 |

---

## Middleware 管道概念

### 管道執行順序

```csharp
// 註冊順序決定執行順序
app.UseMiddleware<GlobalExceptionMiddleware>();  // 第 1 個
app.UseMiddleware<RequestLogMiddleware>();       // 第 2 個
app.UseMiddleware<ResponseLogMiddleware>();      // 第 3 個
```

### 請求/回應流程

```
Request 進入 →
    GlobalExceptionMiddleware.before()
        RequestLogMiddleware.before()
            ResponseLogMiddleware.before()
                Controller.Action()
            ResponseLogMiddleware.after()
        RequestLogMiddleware.after()
    GlobalExceptionMiddleware.after()
← Response 回傳
```

### 洋蔥模型

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

### 職責

統一處理整個管道中的異常，確保所有異常都有一致的回應格式。

### 實作

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
                // 執行後續管道
                await _next(context);
            }
            catch (Exception ex)
            {
                // 統一處理異常
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
                // 業務異常：HTTP 200 + 業務錯誤碼
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
                // 系統異常：HTTP 500
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

### 職責

記錄所有進入系統的 HTTP 請求資訊。

### 實作

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
            // 記錄請求開始
            var requestId = Guid.NewGuid().ToString("N")[..8];
            var stopwatch = Stopwatch.StartNew();

            // 讀取 Request Body
            context.Request.EnableBuffering();
            var requestBody = await ReadRequestBodyAsync(context.Request);

            _logger.LogInformation(
                "[{RequestId}] Request: {Method} {Path} | Body: {Body}",
                requestId,
                context.Request.Method,
                context.Request.Path,
                requestBody);

            // 儲存 RequestId 供後續使用
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

### 職責

記錄所有回應的內容（可選，用於除錯）。

### 實作

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
            // 替換 Response.Body 以便讀取
            var originalBody = context.Response.Body;
            using var memoryStream = new MemoryStream();
            context.Response.Body = memoryStream;

            await _next(context);

            // 讀取 Response Body
            memoryStream.Position = 0;
            var responseBody = await new StreamReader(memoryStream).ReadToEndAsync();
            memoryStream.Position = 0;

            var requestId = context.Items["RequestId"]?.ToString() ?? "Unknown";

            // 只記錄非成功的回應或除錯模式
            if (context.Response.StatusCode >= 400)
            {
                _logger.LogWarning(
                    "[{RequestId}] Response: {StatusCode} | Body: {Body}",
                    requestId,
                    context.Response.StatusCode,
                    responseBody);
            }

            // 複製回原始 Body
            await memoryStream.CopyToAsync(originalBody);
            context.Response.Body = originalBody;
        }
    }
}
```

---

## Middleware 註冊

### 註冊順序

```csharp
// Extensions/MiddlewareExtensions.cs
namespace PaymentService.Extensions
{
    public static class MiddlewareExtensions
    {
        public static IApplicationBuilder UsePaymentServiceMiddlewares(
            this IApplicationBuilder app)
        {
            // 1. 異常處理必須在最外層
            app.UseMiddleware<GlobalExceptionMiddleware>();

            // 2. 請求日誌
            app.UseMiddleware<RequestLogMiddleware>();

            // 3. 回應日誌（可選）
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

    app.UsePaymentServiceMiddlewares();  // 使用擴充方法

    app.UseEndpoints(endpoints =>
    {
        endpoints.MapControllers();
    });
}
```

### 註冊順序的重要性

```csharp
// ✅ 正確順序：異常處理在最外層
app.UseMiddleware<GlobalExceptionMiddleware>();  // 能捕獲所有異常
app.UseMiddleware<RequestLogMiddleware>();

// ❌ 錯誤順序：異常處理在內層
app.UseMiddleware<RequestLogMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();  // RequestLogMiddleware 的異常無法捕獲
```

---

## Middleware 設計原則

### 原則一：單一職責

每個 Middleware 只處理一個關注點：

```csharp
// ✅ 正確：單一職責
public class RequestLogMiddleware { ... }      // 只記錄請求
public class ResponseLogMiddleware { ... }     // 只記錄回應
public class GlobalExceptionMiddleware { ... } // 只處理異常

// ❌ 錯誤：多重職責
public class AllInOneMiddleware
{
    public async Task InvokeAsync(HttpContext context)
    {
        LogRequest();       // 記錄請求
        LogResponse();      // 記錄回應
        HandleException();  // 處理異常
        Authenticate();     // 認證
        // 做太多事了
    }
}
```

### 原則二：不修改業務邏輯

Middleware 只處理橫切關注點，不包含業務邏輯：

```csharp
// ✅ 正確：只處理橫切關注點
public async Task InvokeAsync(HttpContext context)
{
    _logger.LogInformation("Request: {Path}", context.Request.Path);
    await _next(context);
}

// ❌ 錯誤：包含業務邏輯
public async Task InvokeAsync(HttpContext context)
{
    var custId = GetCustIdFromRequest(context);
    if (custId < 1000)  // 業務邏輯！
    {
        context.Response.StatusCode = 403;
        return;
    }
    await _next(context);
}
```

### 原則三：確保呼叫 _next

除非要短路請求，否則必須呼叫 `_next(context)`：

```csharp
// ✅ 正確：呼叫 _next
public async Task InvokeAsync(HttpContext context)
{
    // 前處理
    await _next(context);  // 必須呼叫
    // 後處理
}

// ⚠️ 短路請求（有特定理由時）
public async Task InvokeAsync(HttpContext context)
{
    if (!IsAuthorized(context))
    {
        context.Response.StatusCode = 401;
        return;  // 不呼叫 _next，短路請求
    }
    await _next(context);
}
```

---

## ✅ Review Checklist

### Middleware 設計檢查

- [ ] 是否只處理單一關注點？
- [ ] 是否不包含業務邏輯？
- [ ] 是否正確呼叫 `_next(context)`？
- [ ] 異常處理 Middleware 是否在最外層？

### 註冊順序檢查

- [ ] GlobalExceptionMiddleware 是否第一個註冊？
- [ ] 日誌 Middleware 是否在異常處理之後？
- [ ] 是否使用擴充方法統一管理？

### 效能檢查

- [ ] 是否避免不必要的 Response Body 讀取？
- [ ] 是否使用 async/await 正確？
- [ ] 是否有潛在的記憶體洩漏？

---

## ✅ 新人常見踩雷點

### 1. 異常處理 Middleware 不在最外層

```csharp
// ❌ 錯誤：異常處理不在最外層
app.UseMiddleware<RequestLogMiddleware>();
app.UseMiddleware<GlobalExceptionMiddleware>();

// ✅ 正確：異常處理在最外層
app.UseMiddleware<GlobalExceptionMiddleware>();
app.UseMiddleware<RequestLogMiddleware>();
```

### 2. 忘記呼叫 _next

```csharp
// ❌ 錯誤：忘記呼叫 _next
public async Task InvokeAsync(HttpContext context)
{
    _logger.LogInformation("Request received");
    // 忘記 await _next(context);
    // 請求永遠不會到達 Controller
}

// ✅ 正確：呼叫 _next
public async Task InvokeAsync(HttpContext context)
{
    _logger.LogInformation("Request received");
    await _next(context);
}
```

### 3. 在 Middleware 中處理業務邏輯

```csharp
// ❌ 錯誤：業務邏輯在 Middleware
public async Task InvokeAsync(HttpContext context)
{
    var custId = int.Parse(context.Request.Query["custId"]);
    var customer = await _customerRepo.GetAsync(custId);

    if (customer.VipLevel < 3)  // 業務邏輯！
    {
        context.Response.StatusCode = 403;
        return;
    }

    await _next(context);
}

// ✅ 正確：業務邏輯在 Controller/Service
public async Task InvokeAsync(HttpContext context)
{
    // 只做橫切關注點處理
    await _next(context);
}
```

### 4. 讀取 Request Body 後未重置位置

```csharp
// ❌ 錯誤：未重置 Body Position
public async Task InvokeAsync(HttpContext context)
{
    using var reader = new StreamReader(context.Request.Body);
    var body = await reader.ReadToEndAsync();
    // Body 已讀完，後續無法再讀取

    await _next(context);  // Controller 讀不到 Body
}

// ✅ 正確：重置 Body Position
public async Task InvokeAsync(HttpContext context)
{
    context.Request.EnableBuffering();

    using var reader = new StreamReader(context.Request.Body, leaveOpen: true);
    var body = await reader.ReadToEndAsync();
    context.Request.Body.Position = 0;  // 重置位置

    await _next(context);
}
```

---

## ✅ TL / Reviewer 檢查重點

### 架構審查

| 檢查項目 | 警示信號 |
|----------|----------|
| 順序錯誤 | GlobalExceptionMiddleware 不在第一位 |
| 職責混亂 | 單一 Middleware 處理多種關注點 |
| 業務邏輯 | Middleware 中有資料庫查詢或業務判斷 |

### 效能審查

- [ ] 是否有不必要的 Response Body 攔截？
- [ ] 日誌是否過於詳細影響效能？
- [ ] 是否有同步阻塞操作？

### 可維護性審查

- [ ] Middleware 是否有適當的文件註解？
- [ ] 是否使用擴充方法統一註冊？
- [ ] 錯誤處理是否完整？

---

> **文件版本**: v1.0
> **最後更新**: 2024-11
