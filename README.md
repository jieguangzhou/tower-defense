# Tower Defense MVP

前端代码位于 `frontend/`。

## 启动方式（npm）

1) 进入前端目录：

```bash
cd frontend
```

2) 启动本地静态服务器：

```bash
npm start
```

3) 在浏览器打开：

```
http://localhost:30000
```

> 说明：首次运行 `npm start` 会通过 npx 拉取 `http-server`，直接用 `file://` 打开会因为浏览器的模块加载限制而无法运行。

## 后端（本地 .venv）

后端代码位于 `backend/`，本地 Python 环境使用 `.venv`。

1) 创建并激活虚拟环境：

```bash
python -m venv .venv
source .venv/bin/activate
```

2) 安装依赖：

```bash
python -m pip install -r backend/requirements.txt
```

3) 启动后端（默认 8000 端口）：

```bash
python -m uvicorn backend.app:app --reload
```

## 测试

```bash
cd frontend
npm test
```
