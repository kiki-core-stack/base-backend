# base-backend

KCS 的後端範本：auto-hono 加上 pack 的錯誤處理、多語系、cookie session、MongoDB 與 Redis、ws.io client。

- 框架架構：[docs/auto-hono](./docs/auto-hono/README.md)（由 auto-hono 合併而來）。
- 本 repo 增加的部分：[docs/kcs/base-backend.md](./docs/kcs/base-backend.md)。

下游 repo 以 `fetch-and-merge.sh` 合併本範本；自己的說明寫在 `docs/<專案名>/`，不修改上游的 docs，以免合併衝突。
