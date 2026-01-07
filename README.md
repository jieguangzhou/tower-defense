# Tower Defense MVP

前端代码位于 `frontend/`，后端位于 `backend/`。

## 启动方式（本地）

### 1) 启动后端

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

### 2) 启动前端

```bash
cd frontend
npm start
```

### 3) 在浏览器打开

```
http://localhost:30000
```

> 说明：首次运行 `npm start` 会通过 npx 拉取 `http-server`，直接用 `file://` 打开会因为浏览器的模块加载限制而无法运行。

## 后端连接说明

排行榜相关 API 为：
- `POST /api/score/submit`
- `GET /api/leaderboard`

前端默认使用同源 `/api` 访问后端，因此需要：
- 前后端同源部署（推荐），或
- 通过反向代理把前端与后端合并到同一域名/端口。

如果你需要指向不同的后端地址，请使用运行时配置（见下文）。注意：跨域访问需要在反向代理或后端自行开启 CORS。

## 运行时配置（API_BASE_URL）

前端会读取 `frontend/config.js` 中的 `window.__APP_CONFIG__.apiBaseUrl`，并允许 `frontend/config.local.js` 覆盖。默认留空表示同源 `/api`。`npm start` 会在启动前根据环境变量写入 `config.local.js`（不会改动 `config.js`）。

本地用法（macOS/Linux）：

```bash
cd frontend
API_BASE_URL=http://localhost:8000 npm start
```

示例（Docker Compose 场景）：在容器启动时用环境变量生成 `config.local.js`。

```bash
cat <<EOF > /usr/share/nginx/html/config.local.js
window.__APP_CONFIG__ = { apiBaseUrl: "${API_BASE_URL}" };
EOF
exec nginx -g "daemon off;"
```

## Docker Compose

```bash
docker compose up --build
```

默认端口：
- 前端：`http://localhost:30000`

数据库会持久化到本地 `./data/leaderboard.db`。

前端容器会反向代理 `/api` 到后端，因此只需要暴露前端端口即可（适合 tunnel 场景）。

如果你需要单独暴露后端端口或跨域访问：
1. 在 `docker-compose.yml` 给 backend 增加端口映射（例如 `30001:8000`）
2. 在 frontend 设置 `API_BASE_URL`（见“运行时配置”）
3. 配置 `CORS_ALLOW_ORIGINS`

## 测试

```bash
cd frontend
npm test
```
