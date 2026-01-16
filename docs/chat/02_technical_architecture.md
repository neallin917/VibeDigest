# 技术架构设计: Chat & Thread Management

## 1. 系统概览 (Overview)
本设计旨在重建聊天系统，结合 **LangGraph** 的强大编排能力与 **Assistant-UI** 的现代化前端体验。系统将采用前后端分离架构，通过 RESTful API 进行会话管理，通过流式接口进行实时对话。

## 2. 技术栈 (Tech Stack)
-   **Frontend**: Next.js (App Router), `@assistant-ui/react`, `@assistant-ui/react-langgraph`, TanStack Query.
-   **Backend**: FastAPI, `langgraph`, `langchain-openai`, `langgraph-checkpoint-postgres`.
-   **Database**: Supabase (PostgreSQL) - 用于业务数据与 LangGraph Checkpoint 持久化。

## 3. 核心组件设计 (Component Design)

### 3.1. 数据库模型 (Database Schema)
我们需要两层数据存储：
1.  **业务层 (Business Layer)**: 存储会话的元数据，用于快速列表、鉴权和 UI 展示。
2.  **引擎层 (Engine Layer)**: LangGraph 自带的 Checkpointer，用于存储复杂的 Agent 状态和消息历史。

**核心表 `chat_threads` 设计**:
该表位于 `public` schema，作为业务层的主表。

| 字段名 | 类型 | 描述 |
|---|---|---|
| `id` | uuid (PK) | 会话 ID，这也是 LangGraph 的 `thread_id` |
| `user_id` | uuid (FK) | 关联 `auth.users`，实现 RLS |
| `task_id` | uuid (FK) | 关联 `tasks.id` (视频任务)，确保会话属于特定视频 |
| `title` | text | 会话标题 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 最后活动时间 (每次新消息更新此字段) |
| `metadata` | jsonb | 扩展字段 (如 token 消耗统计等) |

### 3.2. 后端架构 (Backend Architecture)

#### A. LangGraph Agent (`backend/agent/chat_graph.py`)
定义一个专门用于聊天的 StateGraph。
-   **State**: `messages` (list), `context` (str: 视频摘要/字幕), `language` (str).
-   **Nodes**:
    -   `model`: 调用 LLM (如 GPT-4o-mini)。能够访问 Context。
-   **Checkpointer**: 使用 `langgraph-checkpoint-postgres` 中的 `AsyncPostgresSaver`，将状态持久化到 Postgres。`thread_id` 直接复用 `chat_threads.id`。

#### B. API Layer (`backend/main.py` & routers)
-   `POST /api/threads`: 创建新会话 (需校验 Task 权限).
    -   **Concurrency/Transaction**: 采用严格事务流程：`BEGIN` -> `UPDATE chat_threads SET status='archived' WHERE task_id=.. AND status='active'` -> `INSERT INTO chat_threads (status='active'...)` -> `COMMIT`. 若因并发导致 Unique Violation，则重试或返回当前最新 Active ID。
-   `GET /api/threads`: 获取会话列表 (支持 `status`, `limit`, `order_by`).
-   `GET /api/threads/{id}/messages`: 获取历史消息.
    -   **Message ID Strategy**: 后端在将消息写入 LangGraph State (Checkpoint) 前，**必须**生成 UUID 并注入 `message.id` (或 `metadata.id`)。API 返回时读取此 ID，确保分页游标稳定。
-   `POST /api/threads/{id}/archive`: 归档会话.
-   `POST /api/chat/{thread_id}/stream`: 聊天交互.
    -   **Update Strategy (Testable Standard)**: 触发更新 `updated_at` 的精确时机为 **LangGraph 成功生成并流式输出第一个 Token (Chunk) 时**。若 Run 失败或未产生任何输出，不更新时间戳，也不将其置顶。

### 3.3. 前端架构 (Frontend Architecture)

#### B. 组件结构
```
ChatSection
├── ChatHeader
│   └── NewChatButton (Action: setThreadId(null) -> Reset UI)
└── AssistantChat
    ├── Initialization: GET /threads (active) -> if exists, fetch history; else idle.
    └── Interaction: 
        ├── If threadId is null: POST /threads (create) -> setThreadId -> POST /chat
        └── Else: POST /chat
```

## 4. 数据流 (Data Flow)

### 场景 1: 打开视频页面
1.  前端请求 `GET /api/threads?task_id={taskId}&status=active`.
2.  **Response**:
    -   `[]`: 显示 Welcome UI (threadId=null).
    -   `[thread]`: 前端 `setThreadId(thread.id)`，加载历史。

### 场景 2: 开始新对话 (New Chat) - Lazy Creation
1.  用户点击 "New Chat".
2.  前端 **仅执行** `setThreadId(null)` 和 `setMessages([])`. (此时不产生 DB 记录).

### 场景 3: 发送消息
1.  用户输入消息并点击发送。
2.  **Check**: 如果 `threadId` 为空 (新对话场景):
    -   调用 `POST /api/threads` 创建新 Active 会话 (后端自动归档旧的)。
    -   获取新 `threadId`。
3.  **Send**:
    -   调用 `POST /api/chat/{threadId}/stream`。
    -   后端运行成功并流出首个 Token -> Backend Update `updated_at`.

## 5. 安全性设计 (Security)
-   **RLS (Row Level Security)**: 数据库层强制限制 `select/insert/update/delete` 只能操作 `auth.uid() = user_id` 的记录。
-   **API 鉴权**: 所有 API 请求需携带 Bearer Token，后端中间件校验用户身份。
-   **Checkpoint 隔离**: LangGraph 的 checkpoint 表包含了所有历史消息，这些表**不对客户端直接开放** RLS 权限。所有对消息的读取必须经过后端 API (`/api/threads/{id}/messages`) 进行业务校验后返回。
    -   **Operational Requirement**: 在 Supabase/Postgres 中，确保 `langgraph_checkpoints` 等表的权限仅授予 `service_role`，禁止 `authenticated/anon` 角色 SELECT/INSERT。
