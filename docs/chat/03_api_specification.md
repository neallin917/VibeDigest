# API 接口规范 (API Specification): Chat Module

**Base URL**: `/api`
**Authentication**: All endpoints require `Authorization: Bearer <token>`

---

## 1. 会话管理 (Threads Management)

### 1.1 获取会话列表 (List Threads)
获取指定视频任务的会话列表。支持查询 Active 会话或历史归档。

-   **Method**: `GET`
-   **URL**: `/threads`
-   **Query Parameters**:
    -   `task_id` (required, uuid)
    -   `task_id` (required, uuid)
    -   `status` (optional): 默认为 `!=deleted` (即返回所有可见会话)。
    -   `limit`: default 20.
    -   `order_by`: default `updated_at`.
    -   `order`: default `desc`.
-   **Response (200 OK)**:
    ```json
    [
        {
            "id": "uuid",
            "title": "New Chat",
            "status": "active",
            "updated_at": "..."
        }
    ]
    ```
-   **Use Case (Active Session)**: `GET /threads?task_id=...&status=active&limit=1`

### 1.2 创建会话 (Create Thread)
创建一个新的会话。**支持多会话并存，创建新会话不会影响旧会话状态。**

-   **Method**: `POST`
-   **URL**: `/threads`
-   **Body**:
    ```json
    { "task_id": "uuid" }
    ```
-   **Response (201 Created)**:
    ```json
    {
        "id": "new-uuid",
        "status": "active",
        ...
    }
    ```

### 1.3 更新与删除 (Update & Delete)
支持修改标题或软删除。

-   **PATCH** `/api/threads/{id}`
    -   Body: `{ "title": "New Title" }`
    -   Response: Updated Thread Object.

-   **DELETE** `/api/threads/{id}`
    -   Behavior: 设置 `status = 'deleted'`。
    -   Response: `204 No Content` 或 `200 OK`.

### 1.4 获取历史消息 (Get Thread History)
获取特定会话的消息记录。

-   **Method**: `GET`
-   **URL**: `/threads/{thread_id}/messages`
-   **Query**:
    -   `limit`: default 50.
    -   `order`: 固定为 `desc` (按 created_at 倒序，最新的在前)。前端需自行 reverse 后展示。
    -   `before`: (Optional) 分页游标。传入当前列表最旧一条消息的 `created_at` (ISO String)，返回该时间之前的消息。
-   **Response (200 OK)**:
    -   **Message ID Guarantee**: 返回的 `id` 必须是后端生成的稳定 UUID。
    ```json
    [
        {
            "id": "msg_uuid",
            "role": "user",
            "content": "Hello",
            "created_at": "..."
        },
        ...
    ]
    ```

---

## 2. 聊天交互 (Chat Interaction)

### 2.1 发送消息 (Stream Chat)
向指定会话发送消息并获取流式响应。

-   **Method**: `POST`
-   **URL**: `/api/chat/{thread_id}/stream`
-   **Body**:
    ```json
    {
        "messages": [ { "role": "user", "content": "..." } ],
        "task_id": "uuid" // 冗余校验
    }
    ```
-   **Behavior**:
    1.  校验权限。
    2.  调用 LangGraph 运行。
    3.  **Update Strategy**: 仅在 Run 成功启动/确认后，显式执行 `UPDATE chat_threads SET updated_at = NOW()`。
-   **Response**: `text/event-stream` (SSE)

---

## 3. 错误处理 & 状态规则

-   **Deleted Status**: `status='deleted'` 仅用于后台合规/软删。API 的查询接口（如 `GET /threads`）默认自动过滤掉 deleted 记录。若直接访问 deleted thread ID，返回 **404 Not Found**。
-   **400 Bad Request**: 参数错误。
-   **404 Not Found**: Thread 不存在或 status='deleted'。
