# base-backend 架構

在 auto-hono（[docs/auto-hono.md](./auto-hono.md)）之上接入 pack：錯誤處理與錯誤碼、多語系、cookie session、MongoDB 與 Redis、啟動初始化。共用規則（API 回應格式、錯誤碼、多語系、權限）見 [pack README](https://github.com/kiki-core-stack/pack)。以下只列本 repo 增加或改動的部分。

## 啟動流程

src/index.ts 在 auto-hono 的流程上增加：

- 最先載入 `@/setups`（一次性的副作用）：
  - pack 的 mongoose model 擴充（`mongoose-model-extensions`）：預設啟用 `assertUpdateIfNotModified`；其餘擴充（例如 `findByRouteIdOrThrowNotFoundError`）需要時在 `setups/index.ts` 加上對應檔案的 import。
  - `ctx.createApiSuccessResponse(data?)`（setups/hono-context.ts）。
  - `setupHonoAppErrorHandling`：錯誤、404 與驗證失敗都回 API envelope，訊息依請求語系翻譯。
- runtime-inits/development.ts：開發時以 `listApiErrorCodes` 檢查錯誤碼不重複。
- runtime-inits 之後、載入 middleware 之前執行 pack 的 `initializeSystemStartup`（建立預設資料等初始化任務）。
- graceful-exit.ts：結束時一併關閉 Redis 與 MongoDB 連線。

## 新增的目錄與檔案

- api-errors/：錯誤碼命名空間。pack 的 `auth`、`common` 逐一 re-export；本 repo 的錯誤另開命名空間（例如 `export * as forum from './forum';`）。
- globals/re-exports.ts：自動匯入 pack 與常用工具（`apiErrors`、`throwApiError`、`apiValidator`、`z`、`lruStore`、`redisStore` 等）；`z` 改為 pack 的擴充版本，取代 auto-hono 的 `zod`。
- middlewares/：
  - core/locale.ts：pack 的 `locale()`，依 `accept-language` 設定 `ctx.var.locale`；排在最前面，讓錯誤與 404 也能翻譯。
  - context/cookie-session.ts：`/api/*` 掛上 pack 的 `cookieSession()`（金鑰為 `COOKIE_SESSION_KEYS`）。
- types/cookie-session.ts：以 `declare module` 擴充 `CookieSessionData`。
- routes/api/public/api-error-code/list.get.dev.ts：開發用的錯誤碼清單，供前端 codegen 使用。

## 設定

`.env.development`（複製為 `.env.development.local`）比 auto-hono 多：

- `COOKIE_SESSION_KEYS`：base64 編碼的 32 bytes 金鑰，以逗號分隔輪替（第一把用於加密）；產生方式見檔內註解。
- `MONGODB_URI`（需 replica set）、`REDIS_URL`（需支援 RESP3）。
