# base-backend 架構

在 auto-hono（[docs/auto-hono.md](./auto-hono.md)）之上接入 pack：錯誤處理與錯誤碼、多語系、cookie session、MongoDB 與 Redis、啟動初始化。共用規則（API 回應格式、錯誤碼、多語系、權限）見 [pack docs](https://github.com/kiki-core-stack/pack/blob/main/docs/pack.md)。以下只列與 auto-hono 不同的部分。

## 與 auto-hono 的差異

- src/index.ts 最先載入 `@/setups`（一次性的副作用）：mongoose model 擴充預設只啟用 `assertUpdateIfNotModified`，其餘擴充（例如 `findByRouteIdOrThrowNotFoundError`）需要時在 `setups/index.ts` 加上對應的 import。
- i18n/：本 repo 的訊息 catalog 自動匯入為 `appLocaleCatalogs`，傳給 `defineApiErrors`、`z.i18nIssue`、`throwFieldValidationError`。
- globals/re-exports.ts：全域的 `z` 是 pack 的擴充版本（core/globals 不匯出 zod 的 `z`）。

## 設定

開發時讀 `.env.development.local`（由 main 的開發 profile 產生）；正式環境不讀 env 檔，設定由容器的環境變數與 secret 提供。比 auto-hono 多的設定：

- `COOKIE_SESSION_KEYS`：以逗號分隔輪替（第一把用於加密），每把的格式同 pack `docs/auth.md` 的 `AUTH_SECRET_ENCRYPTION_KEYS`。
- `MONGODB_URI`（需 replica set）、`REDIS_URL`（需支援 RESP3）。
