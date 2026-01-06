# SECURITY.md

> 两次迭代目标：  
> - **Iter 1（实现）**：前后端可跑通 MVP；服务端做**极简校验 + 防重放 + 防刷**；同时保留可扩展的数据/接口形态  
> - **Iter 2（方案，不实现）**：升级为更强的校验（服务端权威）与更强的反滥用

---

## 0. 威胁模型（统一前提）
- 客户端（浏览器）不可信：可以改 JS、内存变量（伤害/攻速/金币/血量/分数）、篡改网络请求。
- 因此服务端**不应**把“客户端上报的状态值”当作最终裁判。

---

# Iter 1 — MVP（实现）

## 1. 目标
1) **跑通**：前端能提交成绩，后端能接收并给出是否入榜/当前排名  
2) **极简防作弊**：用低成本规则拒绝明显不合理的提交（不做回放/复算）  
3) **防重放**：拒绝重复提交  
4) **防刷**：限流，避免无意义刷接口  
5) **可扩展**：字段与流程为 Iter 2 的增强校验留好扩展位

---

## 2. 前后端一致性（MVP 要求）
### 2.1 “分数显示”与“服务端判定”的关系
- 前端计算 `clientScore`（用于展示与提交）
- 服务端对 `clientScore` **做合理性校验**后决定是否接受/入榜  
- **MVP 不做服务端复算**，因此服务端仍以 `clientScore` 为输入，但不盲信：必须过规则门槛

### 2.2 规则集中配置（便于同步与后续升级）
建议把校验用的阈值/上限放到一个文件中（后端读取；前端可选读取用于 UI 提示）：
- `shared/rules/validation_caps.json`

示例内容（按关卡/波次）：
- `maxScore[level]`
- `maxKilled[level]`
- `maxTotalDamage[level]`
- `maxMoneyLeft[level]`
- `minDurationMs[level]` / `maxDurationMs[level]`（可选）

> Iter 2 时，这个文件可以继续存在（作为“轻校验/预筛选”），不会浪费。

---

## 3. 提交协议（MVP）
客户端仅在结束时提交一次：

### 3.1 请求体字段
- `submissionId`：UUID（幂等/防重放）
- `level`：关卡/波次（1..maxLevel）
- `score`：总分（int）
- `killed`：击败怪物数量（int）
- `totalDamage`：总伤害（int）
- `moneyLeft`：剩余金钱（int）
- `durationMs`：对局时长（int）
- `clientTs`：客户端时间戳（可选）

> 说明：这些字段都可能被伪造，但服务端会做合理性校验与反滥用；Iter 2 会升级为“过程证据”。

---

## 4. 服务端校验策略（MVP：极简但有效）

### 4.1 基础格式校验
- 字段齐全、类型正确、非负
- `level` 合法范围
- payload 大小上限（防超大包）

### 4.2 上限/区间校验（核心）
服务端读取 `validation_caps.json`，执行：
- `score <= maxScore[level]`
- `killed <= maxKilled[level]`
- `totalDamage <= maxTotalDamage[level]`
- `0 <= moneyLeft <= maxMoneyLeft[level]`
- `minDurationMs[level] <= durationMs <= maxDurationMs[level]`（如启用）

### 4.3 简单交叉一致性校验（避免“看起来合理但很离谱”）
只做很少几条，保持 MVP 简洁：
- `durationMs` 很短但 `score/killed/totalDamage` 很高 → 拒绝
- `killed == 0` 但 `score` 或 `totalDamage` 很高 → 拒绝
- `totalDamage` 极低但 `killed` 极高 → 拒绝（阈值）

> 这一步是“产品风控”，不追求完美，只拒绝明显异常。

---

## 5. 服务端如何判定“是否入榜”（MVP）
- 服务端维护 TopN（如 N=100），记录第 N 名最低分 `minScore`
- 若校验不通过：`rejected`
- 若校验通过但 `score < minScore`：`accepted_not_in_topN`
- 若 `score >= minScore`：进入榜单写入（并发安全更新）并返回排名

> 说明：MVP 以 `score` 入榜；Iter 2 会变为 `serverScore` 入榜。

---

## 6. 防重放（MVP：拒绝重复提交）
### 6.1 submissionId 幂等/去重
- 服务端对 `submissionId` 做唯一性约束（Redis/DB）：
  - 已存在：拒绝或幂等返回（推荐幂等返回）

> MVP 只保证“同一个 submissionId”不可重复提交；Iter 2 会升级为“对局票据 jti 单次消耗”。

---

## 7. 防刷（MVP：限流）
- `/submit` 按 IP 限流（例如每分钟 X 次）
- 可选：IP+UA 再加一道
- 超限返回 429

---

## 8. MVP 局限性与扩展点
### 8.1 局限性（Iter 1 明确承认）
- 攻击者可以把数据调到“刚好不超过上限”来混入榜单
- `killed/totalDamage/moneyLeft` 也可伪造，MVP 只能做统计/区间风控
- 无法证明“玩家确实按规则完成一局”，只能证明“提交看起来合理”

### 8.2 为 Iter 2 预留的扩展位（字段与流程）
- 预留字段：`seed`、`traceHash`、`trace`、`rulesetHash`、`playToken`
- 预留流程：TopN 候选进入“强校验队列”（异步复算/抽查）

---

# Iter 2 — 升级版（方案，不实现）

## 1. 升级目标
1) **强校验**：服务端能独立成立（权威分数/权威通关状态）  
2) **强防重放**：同一对局票据只能提交一次  
3) **更强防刷**：将高风险流量挡在边缘/网关，或用挑战机制抬成本  
4) **保持可扩展**：复用 Iter 1 的轻校验作为预筛选，控制资源

---

## 2. 升级校验机制：服务端权威
### 2.1 对局票据（playToken）
- 访问/开局时服务端签发 `playToken=(jti, exp, seed, rulesetHash, sig)`
- 提交时验签 + `used:{jti}` 单次消耗

### 2.2 过程证据：trace/回放（只对 TopN 候选启用）
- 客户端提交 `seed + trace(操作序列)`（可用离散 tick）
- 服务端用同一 ruleset 复算得到 `serverScore`
- 榜单只认 `serverScore` 与服务端判定的通关状态

### 2.3 分层验证（控制成本）
- 低分/明显不可能进榜：沿用 Iter 1 的轻校验直接拒绝或不入候选
- TopN 候选：进入复算/抽查队列，确认后再最终入榜

---

## 3. 升级防刷机制（更强反滥用）
- 网关/WAF 限流与封禁策略（IP 信誉、黑白名单）
- 动态挑战：
  - PoW（工作量证明，适合一次提交场景）
  - 验证码（仅对高风险触发）
- 设备/账号维度配额（每日提交次数）
- 行为风控：操作节律、分数分布异常、重复模式检测

---

## 4. 迭代衔接说明（为什么 Iter 1 设计便于升级）
- `validation_caps.json`：Iter 1 用于轻校验；Iter 2 继续用于预筛选与风控阈值
- `submissionId`：Iter 1 的幂等；Iter 2 叠加 `jti` 实现更强的防重放
- 协议字段可平滑扩展：新增 `playToken/seed/trace` 不破坏现有提交流程
- TopN 候选路径天然适配“只对少量请求做重计算”，避免算力爆炸
