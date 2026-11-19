# auto-hono 架構

## 架構總覽

### 啟動流程

- dev：nodemon 執行 core/entrypoints/development.ts，它先載入 core/bootstrap，再載入 src/index.ts。
- build：core/build.ts 先執行 core/generators/routes/production.ts，產生靜態路由 loader，再用根目錄 build.ts 的 runBuild 打包到 dist。
- prod：dist/core/entrypoints/production.js 是 supervisor，會 spawn `SERVER_WORKERS`（預設 4）個 worker，每個 worker 都執行 dist/index.js，以 `reusePort` 共用同一個 port。
- src/index.ts（兩個環境共用的 app 入口），依序：
  1. 註冊 signal 和錯誤處理
  2. 載入 runtime-inits/${NODE_ENV}
  3. 載入 middlewares
  4. 載入 core/loaders/routes/${NODE_ENV}
  5. 執行 Bun.serve

### src/core/（框架核心）

- app.ts：唯一的 honoApp 實例。
- logger.ts：logger；在 worker 裡前綴帶 worker 編號。
- bootstrap/index.ts：依 NODE_ENV 註冊 plugins/bun/* 底下的 Bun plugin。
- constants/：專案路徑（只在開發和 build 時使用）、允許的 HTTP method。
- types/：路由型別（RouteMeta 可用 declaration merging 擴充）；ContextVariableMap 的 route 只在符合的檔案路由中存在，app 層 middleware 與 404 拿不到。
- globals/：被 auto-imports 注入成全域的 API（defineRoute、routeValidator、useRouteMiddleware、logger、z、getClientIp）。getClientIp 只透過 SERVER_TRUSTED_PROXIES（預設信任內網位址）解析 X-Forwarded-For。
- libs/router/：掃描 routes/ 轉成 method 與 path，組出每條路由的 middleware 鏈並註冊到 Hono，重複路由會報錯。
- libs/openapi.ts：把 RouteDocs 轉成 hono-openapi 的格式，並提供產生 OpenAPI 文件的 handler；handler 的 `defaultDocs` 會套用到所有有文件的路由（例如每支路由都可能回傳的錯誤），路由自己的同狀態碼回應優先；其餘選項（例如 `exclude` 排除路徑）原樣交給 hono-openapi。
- libs/response-validation.ts：開啟 VALIDATE_RESPONSES 時，比對 response 和 schema，不符只印 warning，不改動回應。
- loaders/routes/：dev 動態掃描並 import 路由，失敗只記 log、不中斷啟動；prod 用 generators/ 產生的靜態 loader（gitignored），失敗時啟動直接失敗。
- plugins/bun/auto-imports.ts：掃描 globals 的 export，用 unimport 注入 import，並產生 d.ts。
- entrypoints/：dev 入口與 prod 多 worker supervisor（重啟、graceful shutdown）。
- build.ts：build 入口，裡面有 Bun export * bug 的說明。

### src/ 底下由使用者維護的部分

- routes/**：檔案路由。檔名格式是 name.method[.dev|.prod].ts，[x] 會轉成 :x。寫法是 export default defineRoute(meta)(...handlers)。
  - routes/docs/：OpenAPI JSON、Scalar、Swagger 三個頁面，都是 .dev，可以自由修改或搬移。
- middlewares/index.ts：控制 middleware 的註冊條件與順序（預設有 core/request-id，dev 另有 core/logger）。app 層用 honoApp.use，每個請求（含 404）都會執行；路由層用 useRouteMiddleware，只套用到符合 pattern 的檔案路由並拿得到 route meta，必須在載入路由前註冊。
- plugins/bun/：auto-imports 的 glob 設定，以及 dev 和 prod 各自的 plugin 清單。
- runtime-inits/：依環境執行的初始化副作用，目前是空的。
- types/route.ts：擴充 RouteMeta 的預留檔，在這裡加 defineRoute(meta) 的欄位；必填欄位會讓 meta 參數變必填。
- graceful-exit.ts：worker 的 graceful shutdown。
