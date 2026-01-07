# SECURITY.md

> 本文档基于“客户端不可信”的前提，描述**当前实现**的排行榜校验、入榜判定、防重放、防刷榜逻辑与公式。

---

## 1) 排行榜在“客户端不可信”前提下的校验

**核心原则**：客户端上报的数据仅作为输入，服务端必须用共享规则集复核并重算关键指标。

当前实现使用以下共享规则集（前后端一致）：
- `shared/ruleset/scoring.v1.json`：分数公式参数
- `shared/ruleset/economy.v1.json`：起始金币、波次数量、奖励增长系数、容错
- `shared/ruleset/mobs.v1.json`：怪物 hp/掉落等权威数据
- `shared/ruleset/caps.v1.json`：波次数量、每波伤害/怪物数量上限的增长系数

### 1.1 服务端权威推导与校验
服务端只依赖 `waves[].mobs[] + ruleset` 推导击杀与掉落，并执行以下校验。

**(A) 基础校验（必做）**
- `runId` 必须是 UUID v4
- `rulesetVersion == "v1"`
- `progress` 在允许范围内（0..maxWaves）
- `hpLeft <= hpMax` 且 `hpMax <= HP_MAX`
- `waves.length >= progress` 且 `waves.length <= maxWaves`

**(B) 每波数据合法性**
对每个波次 `i`：
- `mobs.length <= maxMobsPerWave[i]`
- 所有 `type` 必须存在于 `mobs.v1.json`
- `damageTaken` 为非负整数

**(C) 每波总伤害上限 + 可选突刺限制**
- `waveDamage = sum(mob.damageTaken)`
- `waveDamage <= maxDamagePerWave[i]`
- `waveDamage <= prevWaveDamage * maxSpikeRatio`（若启用）

**(D) 击杀与掉落（服务端推导）**
- `hp = mobs[type].hp * (1 + waveIndex * waveHpStep) * (isBoss ? bossMultiplier : 1)`
- `killed = damageTaken >= round(hp)`
- 若 `killed`，掉落金币：
  - `drop = mobs[type].dropGold * (isBoss ? bossMultiplier : 1)`
- 汇总 `totalKills` 与 `earnedDrops`

**(E) 金币守恒**
- `waveReward[i]` 由 `base * (1 + growthRate)^i` 生成（按规则集的 round 取整）
- `earnedWave = sum(waveReward[0..progress-1])`
- `earnedTotal = earnedWave + earnedDrops`
- `expectedEnd = goldStart + earnedTotal - goldSpentTotal`
- 校验：`abs(goldEnd - expectedEnd) <= goldTolerance`

**(F) 服务端重算分数（serverScore）**
- `HP_SCORE = floor(hpLeft * HP_MAX / hpMax)`
- `serverScore = progress * STRIDE + totalKills * KILL_UNIT + HP_SCORE`

> 结论：排行榜以 `serverScore` 入榜；客户端 `clientScore` 仅用于“入榜门槛判断（Cheap Gate）”。

---

## 2) 采用的服务端校验策略：如何判定“是否入榜”

**流程概览**：
1. **Cheap Gate（仅用 clientScore）**
   - 取当前榜单 TopN 的最低分 `minScore`
   - 若 `clientScore < minScore * (1 - margin)` → 直接返回 `not_in_topN`（不做权威校验）
2. **权威校验（见第 1 节）**
   - 任一校验失败 → `rejected` + 原因码
3. **通过校验后写入**
   - 写入 `score_runs`（保存 runId / serverScore / progress / ip / createdAt）
   - 返回 `accepted` + 排名

**当前实现的关键输出**：
- `status = accepted | rejected | not_in_topN`
- `reason = NONE | ECONOMY_INVALID | DAMAGE_INVALID | MOB_INVALID | INVALID_PAYLOAD | already_submitted | rate_limited`

---

## 3) 防重放 / 防刷榜策略

### 3.1 防重放（Replay）
- DB 约束：`score_runs.run_id` 为主键（唯一）
- 同一 `runId` 重复提交：
  - 返回 `409`，`reason = already_submitted`
  - 不做幂等复用结果

### 3.2 防刷榜（Spam / Abuse）
**请求体限制**
- `/api/score/submit` 请求体大小上限：`64KB`
- `playerName` 最大长度：32
- `clientScore` 不得超过由规则集推导的理论上限

**字段范围约束（基础护栏）**
- `progress <= maxWaves`
- `hpMax <= HP_MAX`
- `waves.length <= maxWaves`

**限流**
- 按 IP 维度滑动窗口限流（默认 10 次/60 秒）
- 超限返回 `429` + `reason = rate_limited`

**可观测性**
- 记录每次拒绝原因与关键参数
- 内存计数器（`submit_total`, `submit_accepted_total`, `submit_rejected_*`）用于快速排查

---

## 4) 局限性、薄弱点与应对方法

### 局限性
- **单机限流**：仅进程内统计，无法跨实例共享。
- **缺乏强身份**：仅靠 IP + runId，无法防止分布式刷榜。
- **不做回放复算**：仍可能构造“看似合理”的提交混入榜单。
- **Cheap Gate 依赖 clientScore**：低分请求直接跳过权威校验。恶意者可报高分触发校验（但仍会被权威校验挡住）。

### 应对方法（后续增强方向）
- **引入 Redis**：共享限流状态，支持多实例。
- **签发 playToken**：服务端签名的对局票据，runId 仅在 token 中合法生成。
- **提交 trace/回放**：对 TopN 候选做异步复算，榜单仅认 `serverScore`。
- **风控与异常检测**：对分数分布、频次、IP/UA 异常做二级拦截。
