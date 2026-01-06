# SPEC.md

> 本项目为“塔防现代化重制 + 服务端排行榜”的 **最MVP且可扩展** 版本：  
> - 目标是交付一个可运行的前后端仓库（骨架即可）  
> - 重点在：清晰的规则抽象、可运行的排行榜、以及最小但有效的反滥用校验  
> - 不追求可玩性与完整塔防数值体系

---

## 1. 项目目标（MVP）

### 1.1 必须达成
1) 前端可运行：能进入游戏页面、能“完成一局”、能提交成绩、能查看排行榜  
2) 后端可运行：接收成绩提交、做校验、更新 TopN、提供榜单查询  
3) 校验与反滥用（Iter 1 实现）：
   - 轻量合理性校验（防明显作弊）
   - 防重放：拒绝重复提交
   - 防刷：限流  
4) 方案可扩展：为后续升级到“更强校验/更强反滥用”保留接口与字段空间（但本版本不实现升级）

---

## 2. 游戏规则（最小抽象）

### 2.1 一局游戏的定义
- 玩家进入关卡后开始计时
- 关卡由多个波次组成：`level = 1..L`
- 本 MVP 不要求实现真实战斗与路径细节，可用占位逻辑/简化逻辑完成“关卡推进”与“分数累积”
- 一局结束后，前端生成汇总数据并提交

### 2.2 玩家行为（MVP）
- 玩家在一局中会产生若干操作（放塔/升级/卖塔等）
- 本 MVP 不要求服务端重放这些操作；仅要求前端统计“操作次数”用于合理性校验

### 2.3 资源与状态（MVP）
- 金钱/血量/伤害/攻速等数值可以在前端存在，用于展示或简化玩法
- **服务端不信任这些客户端状态**，仅接受并校验最终提交的“汇总指标”

---

## 3. 计分与提交数据（MVP 的唯一事实来源）

### 3.1 前端在结束时提交以下字段
- `submissionId`：UUID，用于去重（幂等）
- `playerName`：字符串（可选为空；或前端生成匿名名）
- `level`：到达的关卡/波次（int）
- `score`：总分（int）
- `killed`：击败怪物总数（int）
- `totalDamage`：总伤害（int）
- `moneyLeft`：剩余金钱（int）
- `durationMs`：对局时长（int）
- `actionsCount`：操作次数（int）
- `clientTs`：客户端时间戳（int）

> 说明：该提交结构非常稳定，后续升级为更强校验时，只需要在此基础上新增字段（例如 seed/trace/playToken），不会破坏兼容性。

### 3.2 分数计算（前端）
- 分数由前端计算并展示，最终以 `score` 提交
- 本 MVP 不要求前后端共享同一套“战斗逻辑代码”，服务端通过校验规则决定是否接受与入榜

---

## 4. 排行榜需求（后端）

### 4.1 榜单规则
- 维护 TopN（例如 N=100）
- 排序：按 `score` 降序
- 同分处理：按 `durationMs` 升序（更快更靠前），再按服务端接收时间升序

### 4.2 API（固定）
- `POST /api/score/submit`
  - 输入：3.1 的提交字段
  - 输出：
    - `accepted_not_in_topN`：通过校验但未入榜
    - `accepted_in_topN`：入榜并返回当前排名
    - `rejected`：拒绝并返回原因
- `GET /api/leaderboard?limit=N`
  - 返回 TopN 列表（name/score/level/durationMs/createdAt）

---

## 5. 服务端校验与反滥用（Iter 1 实现）

### 5.1 校验配置文件（规则集中）
后端维护一个配置文件（建议路径）：
- `shared/rules/validation_caps.json`

内容按 `level` 定义硬阈值：
- `maxScore[level]`
- `maxKilled[level]`
- `maxTotalDamage[level]`
- `maxMoneyLeft[level]`
- `minDurationMs[level]`
- `maxDurationMs[level]`
- `maxActionsCount[level]`

### 5.2 合理性校验（必须通过才接受）
服务端对提交执行以下检查：
1) 基础格式：字段齐全、类型正确、非负、payload 大小不超限  
2) 范围上限：
   - `score <= maxScore[level]`
   - `killed <= maxKilled[level]`
   - `totalDamage <= maxTotalDamage[level]`
   - `moneyLeft <= maxMoneyLeft[level]`
   - `minDurationMs[level] <= durationMs <= maxDurationMs[level]`
   - `actionsCount <= maxActionsCount[level]`
3) 简单交叉一致性（固定三条）：
   - `durationMs` 很短但 `score` 很高 → 拒绝
   - `killed == 0` 但 `score` 或 `totalDamage` 很高 → 拒绝
   - `totalDamage` 极低但 `killed` 极高 → 拒绝

> 目的：快速拒绝“明显作弊/明显没玩过”的提交，成本 O(1)。

### 5.3 防重放（必须实现）
- `submissionId` 必须全局唯一
- 相同 `submissionId` 的再次提交直接拒绝（或幂等返回同结果）

### 5.4 防刷（必须实现）
- `/api/score/submit` 按 IP 限流（429）
- 超限直接拒绝，不进入任何校验与写榜流程

---

## 6. 主要边界条件与取舍（为什么这样最MVP）

1) **不做服务端复算**：避免引入战斗回放、确定性模拟、跨语言一致性等复杂度；先跑通全链路与安全骨架  
2) **用“硬阈值 + 三条一致性规则”**：足够挡掉大量低成本作弊，同时实现极简、易测试、易解释  
3) **submissionId 去重 + IP 限流**：用最少机制防止重放与刷接口，保证服务稳定  
4) **为后续升级预留扩展位**：Iter 2 可在不破坏当前 API 的情况下新增 `playToken/seed/trace` 并将入榜依据升级为服务端权威结果

---

## 7. Iter 2（只写方案，不实现）的升级方向（简述）
- 对局票据（playToken：sig+jti+exp）实现强防重放
- TopN 候选提交 seed+trace，服务端权威复算 serverScore
- 分层验证：轻校验预筛选 + 强校验只用于 TopN 候选
- 更强反滥用：网关/WAF、设备/账号配额、动态挑战
