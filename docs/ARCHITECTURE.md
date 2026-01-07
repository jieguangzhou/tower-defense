# ARCHITECTURE.md

> 本项目采用“前端离线跑一局 + 结束一次提交 + 后端维护 TopN 榜单”的最MVP架构。  
> 目标：结构清晰、可运行、实现极简，但为后续增强校验与反滥用留好扩展空间。

---

## 1. 总览

### 1.1 运行时组件
- **Web Frontend（浏览器）**
  - 展示与交互
  - 本地推进一局游戏（可极简/占位）
  - 统计汇总指标并提交成绩
  - 展示排行榜

- **API Backend（服务端）**
  - 接收提交
  - 做轻量校验（Iter 1）
  - 防重放/防刷
  - 更新并提供 TopN 榜单

- **Storage（存储）**
  - DB：保存榜单与提交记录（或仅榜单）
  - Redis：用于 submissionId 去重与限流（推荐）

---

## 2. 前端架构选型思路（精简版）

> 目的：不追求“可玩”，只追求“现代化工程骨架 + 可迭代”。

### 2.1 选型目标
- 快速搭建可运行工程（开发体验好、构建快）
- 易于承载 Canvas/渲染（未来可加玩法）
- TypeScript 支持良好（接口与数据结构更稳）
- 与后端协作简单（提交成绩、拉取榜单）

### 2.2 推荐技术栈（MVP）
- **Vite + TypeScript**
  - 理由：启动快、配置轻、适合做骨架与后续扩展
- **Canvas（原生）作为渲染占位**
  - 理由：MVP 不做完整玩法，先用原生 Canvas 放一个“游戏区域”即可
  - 未来若要提升可玩性，可平滑升级到 PixiJS/Phaser，但 Iter 1 不需要引入

### 2.3 前端模块最小划分
- `game/`：一局开始/结束、推进占位逻辑
- `stats/`：汇总指标（score/level/killed/totalDamage/moneyLeft/duration/actionsCount）
- `api/`：submit 与 leaderboard 请求封装
- `ui/`：HUD/按钮/榜单展示

> 设计取舍：前端不做复杂状态管理（例如 Redux），用模块内状态即可，减少样板代码。

---

## 3. 前端如何配合服务端做排行榜防刷/校验（Iter 1）

### 3.1 提交流程（一次请求）
- 前端结束一局后生成 `submissionId = UUID`
- 组装汇总指标并 `POST /api/score/submit`

前端提交字段（核心）：
- `submissionId`（去重/幂等）
- `score, level, killed, totalDamage, moneyLeft, durationMs, actionsCount`

### 3.2 为什么这样能配合“防重放/防刷”
- **防重放（后端为主）**：后端对 `submissionId` 做唯一性约束，重复提交直接拒绝/幂等返回  
- **防刷（后端为主）**：后端对 `/submit` 做 IP 限流，前端无需额外复杂逻辑  
- **轻量校验（后端为主）**：后端按 `validation_caps.json` 做上限/一致性校验，前端只需按协议提交即可

> 取舍：MVP 不在前端做“强对抗”，因为客户端不可信；前端只负责提供可验证的汇总指标。

---

## 4. 模块划分与职责边界

### 4.1 Frontend 模块

#### 4.1.1 Game（游戏骨架）
- 初始化一局、开始计时
- 推进占位逻辑（例如模拟波次推进/简单点击加分）
- 结束一局并触发提交

#### 4.1.2 Stats（统计与汇总）
- 维护并输出 SubmitPayload（提交结构）
- 统计 actionsCount、durationMs 等

#### 4.1.3 API Client
- `POST /api/score/submit`
- `GET /api/leaderboard`

#### 4.1.4 UI
- Canvas 容器（占位）
- HUD（分数/关卡/时间）
- 提交按钮与提交结果提示
- 榜单列表展示

---

### 4.2 Backend 模块

#### 4.2.1 HTTP API Layer
- 路由与入参解析

#### 4.2.2 Anti-Abuse
- 防重放：submissionId 去重（原子）
- 防刷：限流（按 IP）

#### 4.2.3 Validation（Iter 1 轻量校验）
- 读取 `shared/rules/validation_caps.json`
- 上限/区间校验 + 三条交叉一致性校验

#### 4.2.4 Leaderboard Service
- 维护 TopN
- 按 score/duration 排序写入并裁剪
- 提供榜单查询

#### 4.2.5 Persistence
- DB/Redis 读写封装

---

## 5. 关键流程（文字流程）

### 5.1 前端：一局 -> 提交
1. 用户点击 Start
2. Game 初始化并开始计时
3. 游戏推进（占位逻辑），Stats 累计汇总指标
4. 用户点击 End（或达到结束条件）
5. 前端生成 submissionId，POST 提交
6. 展示服务端返回：入榜/未入榜/拒绝原因

### 5.2 后端：提交处理顺序（Iter 1）
1. 限流检查（超限直接 429）
2. submissionId 去重（重复则拒绝/幂等返回）
3. 基础格式校验
4. caps 上限/区间校验
5. 三条交叉一致性校验
6. TopN 判定：低于 minScore 则 not_in_topN，否则写榜并返回 rank

---

## 6. 数据与配置

### 6.1 校验配置
- `shared/rules/validation_caps.json`
  - maxScore/maxKilled/maxTotalDamage/maxMoneyLeft/minDurationMs/maxDurationMs/maxActionsCount（按 level）

### 6.2 提交协议（SubmitPayload）
- submissionId, playerName
- score, level, killed, totalDamage, moneyLeft
- durationMs, actionsCount, clientTs

---
