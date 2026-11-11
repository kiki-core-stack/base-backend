# auto-hono

## 架構總覽

### 啟動流程

- dev：nodemon 執行 core/entrypoints/development.ts，它先載入 core/bootstrap，再載入 src/index.ts。
- build：core/build.ts 先執行 core/generators/routes/production.ts，產生靜態路由 loader，再用上游的 runBuild 打包到 dist。
- prod：dist/core/entrypoints/production.js 是 supervisor，會 spawn N 個 worker，每個 worker 都執行 dist/index.js。
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
- constants/
  - paths.ts：用 Path 定義的專案路徑，只在開發和 build 時使用。
  - route.ts：允許的 HTTP method，以及 routeMetaSymbol。
- types/
  - route.ts：RouteMeta（可用 declaration merging 擴充）、RouteDocs 等路由型別。
  - hono.ts：在 ContextVariableMap 宣告 route。
- globals/：被 auto-imports 注入成全域的 API。
  - route.ts：defineRoute。
  - re-exports.ts：routeValidator（hono-openapi 的 validator）、useRouteMiddleware、logger、z。
- libs/router/
  - discovery.ts：掃描 routes/ 目錄，轉成 method 和 path，並排序。
  - registry.ts：組出每條路由的 middleware 鏈並註冊到 Hono，檢查重複路由，提供 useRouteMiddleware。
- libs/openapi.ts：把 RouteDocs 轉成 hono-openapi 的格式，並提供產生 OpenAPI 文件的 handler。
- libs/response-validation.ts：開啟 VALIDATE_RESPONSES 時，比對 response 和 schema，不符就印 warning。
- loaders/routes/
  - development.ts：動態掃描並 import 路由；失敗只記 log，不中斷啟動。
  - production.ts：由 generator 產生的靜態 import 加 registerRoutes，gitignored；失敗時啟動直接失敗。
- generators/routes/production.ts：產生上面那個 prod loader。
- plugins/bun/auto-imports.ts：掃描 globals 的 export，用 unimport 注入 import，並產生 d.ts。
- entrypoints/
  - development.ts：dev 入口。
  - production.ts：多 worker supervisor，負責重啟和 graceful shutdown。
- build.ts：build 入口，裡面有 Bun export * bug 的說明。

### src/ 底下由使用者維護的部分

- routes/**：檔案路由。檔名格式是 name.method[.dev|.prod].ts，[x] 會轉成 :x。寫法是 export default defineRoute(meta)(...handlers)。
  - routes/docs/：OpenAPI JSON、Scalar、Swagger 三個頁面，都是 .dev，可以自由修改或搬移。
- middlewares/index.ts：用 honoApp.use 註冊 app 層 middleware，或用 useRouteMiddleware 註冊路由層 middleware。
- plugins/bun/：auto-imports 的 glob 設定，以及 dev 和 prod 各自的 plugin 清單。
- runtime-inits/：依環境執行的初始化副作用，目前是空的。
- types/route.ts：擴充 RouteMeta 的預留檔，在這裡加 defineRoute(meta) 的欄位；必填欄位會讓 meta 參數變必填。
- graceful-exit.ts：worker 的 graceful shutdown。
