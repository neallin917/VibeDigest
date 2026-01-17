# API 接口规范 (API Specification): Chat Module

**Base URL**: `/api`
**Authentication**: Headers: `Authorization: Bearer <token>` (Supabase Auth)

---

## 1. 聊天交互 (Chat Interaction)

### 1.1 发送消息 (Stream Chat)
向指定会话发送消息并获取流式响应。后台自动处理持久化。

-   **Method**: `POST`
-   **URL**: `/chat` (File: `app/api/chat/route.ts`)
-   **Headers**:
    -   `Content-Type`: `application/json`
-   **Body**:
    ```json
    {
        "messages": [
            { "role": "user", "content": "Hello" },
            { "role": "assistant", "content": "Hi there" }
        ],
        "taskId": "uuid",    // 用于获取 Context (Required)
        "threadId": "uuid"   // 用于持久化 (Required)
    }
    ```
-   **Response**: `text/event-stream` (Standard AI SDK Stream).

---

## 2. 会话管理 (Threads Management)

### 2.1 获取会话列表 (List Threads)
-   **Method**: `GET`
-   **URL**: `/threads`
-   **Query Parameters**:
    -   `taskId` (required)
-   **Response**:
    ```json
    [
        {
            "id": "uuid",
            "title": "Topic A",
            "status": "active",
            "updated_at": "ISO-8601"
        }
    ]
    ```

### 2.2 创建会话 (Create Thread)
-   **Method**: `POST`
-   **URL**: `/threads`
-   **Body**: 
    ```json
    { "taskId": "uuid" }
    ```
-   **Response**: 
    ```json
    { "id": "uuid", "created_at": "..." }
    ```

### 2.3 获取消息历史 (Get History)
-   **Method**: `GET`
-   **URL**: `/threads/{id}/messages`
-   **Response**:
    ```json
    [
        { "id": "uuid", "role": "user", "content": "..." },
        { "id": "uuid", "role": "assistant", "content": "..." }
    ]
    ```

### 2.4 删除会话 (Delete Thread)
-   **Method**: `DELETE`
-   **URL**: `/threads/{id}`
-   **Response**: `200 OK`
