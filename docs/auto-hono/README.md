# auto-hono 架構

## 啟動流程

- dev：nodemon 執行 core/entrypoints/development.ts，它先載入 core/bootstrap，再載入 src/index.ts。
- build：core/build.ts 先執行 core/generators/routes/production.ts，產生靜態路由 loader，再用根目錄 build.ts 的 runBuild 打包到 dist。
- prod：dist/core/entrypoints/production.js 是 supervisor，會 spawn `SERVER_WORKERS`（預設 4）個 worker，每個 worker 都執行 dist/index.js，以 `reusePort` 共用同一個 port。
- src/index.ts 是兩個環境共用的 app 入口。

## 框架行為

- loaders/routes/：dev 動態掃描並 import 路由，失敗只記 log、不中斷啟動；prod 用 generators/ 產生的靜態 loader（gitignored），失敗時啟動直接失敗。
- plugins/bun/auto-imports.ts：掃描 core/globals 的 export，用 unimport 注入成全域並產生 d.ts（bootstrap 時產生）。
- 路由檔名格式是 name.method[.dev|.prod].ts，[x] 會轉成 :x；index.method.ts 對應目錄本身（users/index.get.ts 是 /users）；有 .dev／.prod 的只在該環境載入，沒有的兩個環境都載入。
