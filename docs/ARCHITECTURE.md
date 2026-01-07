# ARCHITECTURE.md

> 精简版架构说明：模块边界与关键流程（以当前实现为准）。

---

## 1) 模块划分与职责边界

- `frontend/`：纯前端静态站点
  - `src/game/*`：核心游戏逻辑（波次、怪物、计分、随机）
  - `src/main.js`：UI 绑定、对局状态、提交入口
  - `src/leaderboard.js`：提交/拉取排行榜的请求构造
  - `config.js` / `config.local.js`：运行时 API 地址配置（默认同源 `/api`）

- `backend/`：FastAPI 服务
  - `app.py`：HTTP 入口、请求体校验、限流、持久化
  - `guards/*`：权威校验与入榜判定（预检 / Cheap Gate / Replay / Authority）
  - `ruleset_series.py`：规则集序列生成与 round 规则
  - `leaderboard.db`：SQLite 持久化（可用环境变量覆盖路径）

- `shared/ruleset/`：前后端共享的权威规则集（scoring/economy/mobs/caps）

- `docker-compose.yml` + `frontend/nginx.conf`：一键部署与同源反向代理

---

## 2) 关键流程（文字版）

### A) 对局提交与入榜
1. 前端结束对局后生成 `submission payload`（含 waves/mobs/economy/progress）。
2. 后端 `validate_precheck` 做基础合法性校验。
3. Cheap Gate：若 `clientScore` 低于门槛，直接 `not_in_topN`。
4. Authority 校验：基于 `shared/ruleset` 计算击杀/掉落/金币与伤害上限。
5. 通过后写入 SQLite，并用 `serverScore` 排序入榜。

### B) 排行榜读取
1. 前端调用 `GET /api/leaderboard`。
2. 后端按 `server_score DESC, created_at ASC` 返回 Top3。

### C) 运行时 API 地址
1. 前端默认同源 `/api`。
2. 需要指向其他地址时，通过 `config.local.js` 覆盖 `apiBaseUrl`。

---

## 3) 边界与取舍（简要）

- 服务端不做全量战斗回放，仅基于 `waves[]` 推导。
- 允许少量溢出容错（`mobOverflowMax` / `damageOverflowMax`）以减少误杀。
- 限流与重放检测为单机实现（进程内 + DB 唯一键）。
