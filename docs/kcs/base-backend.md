# base-backend 架構

## 與 auto-hono 的差異

- src/index.ts 最先載入 `@/setups`（一次性的副作用）：mongoose model 擴充預設只啟用 `assertUpdateIfNotModified`，其餘擴充（例如 `findByRouteIdOrThrowNotFoundError`）需要時在 `setups/index.ts` 加上對應的 import。
- i18n/：本 repo 的訊息 catalog 自動匯入為全域 `appLocaleCatalogs`。
- globals/re-exports.ts：全域的 `z` 是 pack 的擴充版本（core/globals 不匯出 zod 的 `z`）。
- globals/constants/ws.io-client.ts：以服務自己的 auth key 連到 ws.io-server 的同名 namespace，預設是 `/services-backend`；衍生的 repo 改成自己的 namespace 與事件型別。啟動時在開 listener 前連線（不等連上），graceful exit 時斷線。

## 設定

開發時讀 `.env.development.local`；正式環境不讀 env 檔，設定由容器的環境變數與 secret 提供。比 auto-hono 多的設定：

- `COOKIE_SESSION_KEYS`：以逗號分隔輪替（第一把用於加密），每把的格式同 pack `docs/kcs/auth.md` 的 `AUTH_SECRET_ENCRYPTION_KEYS`。
- `MONGODB_URI`（需 replica set）、`REDIS_URL`（需支援 RESP3）。
- `WS_IO_SERVER_BASE_URL`、`WS_IO_AUTH_KEY`：ws.io-server 位址與該服務的 auth key。
