# Tower Defense MVP

前端代码位于 `frontend/`，后端位于 `backend/`。

## 文档

- `docs/ARCHITECTURE.md`
- `docs/SPEC.md`
- `docs/SECURITY.md`
- `docs/AI_USAGE.md`

## 启动方式（本地）

### Docker Compose（推荐）

```bash
docker compose up --build
```

访问：`http://localhost:30000`

### 分别启动

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

## 如何提交成绩并查看排行榜

- 完成一局后点击“提交成绩”
- 提交完成自动弹出排行榜（也可点击“排行榜”）

## 测试

```bash
python -m pytest backend/tests
```

```bash
cd frontend
npm test
```
