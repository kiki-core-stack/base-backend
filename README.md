# base-backend

KCS 的後端範本：auto-hono 加上 pack 的錯誤處理、多語系、cookie session、MongoDB 與 Redis。

- 框架架構：[docs/auto-hono.md](./docs/auto-hono.md)（由 auto-hono 合併而來）。
- 本 repo 增加的部分：[docs/base-backend.md](./docs/base-backend.md)。

下游 repo 以 `fetch-and-merge.sh` 合併本範本；自己的說明寫在新的檔案（例如 `docs/<repo>.md`），不修改上游的 docs，以免合併衝突。
