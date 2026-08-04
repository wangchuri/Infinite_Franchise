# 本地开发环境

## 1. 前置检查

```bash
node -v   # 需要 20+
npm -v
git -v
```

## 2. 安装依赖

在仓库根目录：

```bash
cd frontend && npm install && cd ..
cd backend  && npm install && cd ..
```

## 3. 环境变量

```bash
# 后端
cp backend/.env.example backend/.env

# 前端
cp frontend/.env.example frontend/.env.local
```

按需改端口与 `API` 地址；密钥不要提交 Git。

## 4. 启动（两个终端）

```bash
# 终端 A · API
cd backend
npm run dev

# 终端 B · Web
cd frontend
npm run dev
```

- 前端：http://localhost:3000  
- 后端健康检查：http://localhost:4000/health  

## 5. 目录

```
Infinite_Franchise/
├── docs/
├── frontend/     # Next.js
├── backend/      # Node API
└── .gitignore
```
