# SPEC.md

> 简要记录本项目“可运行 MVP”的核心规则与需求，以及关键边界与取舍。

---

## 1) 规则与需求（精简版）

- 前端可运行：能开始对局、结束后提交成绩、查看排行榜。
- 后端可运行：提供提交与排行榜接口，并做权威校验与入榜判定。
- 提交结构（核心字段）：
  - `runId`（UUID v4）
  - `progress` / `hpLeft` / `hpMax`
  - `economy`（`goldSpentTotal`, `goldEnd`）
  - `waves[]`（每波的 `mobs[]`，含 `type/isBoss/damageTaken`）
  - `rulesetVersion = "v1"`
- 共享规则集（前后端一致）：
  - `shared/ruleset/scoring.v1.json`
  - `shared/ruleset/economy.v1.json`
  - `shared/ruleset/mobs.v1.json`
  - `shared/ruleset/caps.v1.json`
- 计分与入榜：
  - `serverScore = progress * STRIDE + totalKills * KILL_UNIT + HP_SCORE`
  - 排行榜仅展示 Top3（服务端限流 + Cheap Gate）
- 数据持久化：SQLite 文件写入（默认 `backend/leaderboard.db` 或环境变量覆盖）。

---

## 2) 主要边界条件与取舍

- **服务端权威但不回放**：不做完整战斗复算，仅基于 `waves[] + ruleset` 推导击杀/掉落。
- **Cheap Gate 依赖 clientScore**：低分直接跳过权威校验，降低成本。
- **失败补报一波**：允许 `hpLeft == 0` 时附带当前未完成波次，便于结算掉落。
- **容错阈值存在**：`mobOverflowMax` / `damageOverflowMax` 放宽异常拦截，提升兼容性但降低防刷强度。
- **限流为单机内存**：当前仅进程内 IP 限流，未做多实例共享。

---

## 3) 非目标（本版本不做）

- 不做账号体系与强身份绑定
- 不做服务端全量回放/模拟
- 不做复杂反作弊策略（仅基础校验 + 限流）
