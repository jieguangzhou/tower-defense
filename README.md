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
API_BASE_URL=http://localhost:8000 npm start
```

### 3) 在浏览器打开

```
http://localhost:30000
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
