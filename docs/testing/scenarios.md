# Test Scenarios & Coverage (User Journeys)

本文档旨在提供粒度更细的测试覆盖追踪，罗列具体的业务场景、UI 交互和后端逻辑。

> **当前状态**: 
> - **Frontend**: 重点转向 `/chat` 相关组件，Dashboard 组件已弃用。
> - **E2E**: 核心覆盖 `chat.spec.ts` 和 `task-creation.spec.ts`。

---

## 🖥 Frontend (前端)

### 🔴 E2E 关键流程 (End-to-End)
> 运行命令: `npx playwright test e2e/`

#### 1. Chat Interface (`e2e/chat.spec.ts`) - **核心 (P0)**
- **Welcome Screen**
    - [x] **空状态**: 显示欢迎语和行内输入框 (Typewriter)。
    - [ ] **示例卡片**: 点击示例卡片应直接填充并提交。
- **对话交互**
    - [x] **提交 URL**: 发送 YouTube 链接，显示 Loading 状态。
    - [x] **视频卡片**: 识别 URL 并渲染 `VideoCardMessage`。
    - [x] **Context Panel**: 点击卡片打开右侧面板，加载播放器。
- **消息渲染**
    - [ ] **AI 回复**: 正常显示文本消息 (Markdown)。
    - [ ] **工具状态**: 显示 "Thinking..." 或工具调用过程 (可选)。

#### 2. 获客流程 (`e2e/task-creation.spec.ts`)
- **Landing Page**
    - [x] **未登录提交**: 输入 URL -> Generate -> 跳转 `/login`。
    - [x] **校验拦截**: 空 URL 或无效格式显示错误提示。

#### 3. 基础冒烟 (`e2e/smoke.spec.ts`)
- [x] **页面加载**: Landing, Login, Explore 页面无 500/404。
- [x] **关键元素**: Logo, 导航, 语言切换器可见。
- [x] **SEO**: Meta 标签检查。

---

### 📦 Component Unit Tests (组件单元测试)

#### 1. Chat Components (`src/components/chat`)
- [x] `ChatWorkspace.tsx`: Main chat layout and provider integration (`ChatWorkspace.test.tsx`).
- [ ] `ChatInput.tsx`: 输入框交互, 提交, Loading 状态禁用。
- [x] `VideoDetailPanel.tsx` (原 TaskDetail): 视频播放器集成, 摘要渲染, 时间戳跳转。
- [ ] `WelcomeScreen.tsx`: 示例加载, 布局响应式。

#### 2. Sidebar & Navigation
- [x] `Sidebar.tsx`: 历史记录列表加载, 删除操作, 路由切换.
- [x] `LandingNav.tsx`: 落地页导航, 语言切换,锚点跳转.
- [ ] `LibrarySidebar.tsx`: 搜索过滤逻辑。

#### 3. Legacy Components (Deprecated)
- `Dashboard/*`: 已停止维护，无需新增测试。

---

## ⚙️ Backend (后端)

### 核心逻辑模块
- **LangGraph Workflow**
    - [x] **State Management**: 状态流转 (Processing -> Completed)。
    - [x] **Tools**: Whisper, Summarizer 异常处理。
- **API Routes**
    - [x] `/api/chat`: AI SDK v6 接入, 消息流式传输, 鉴权与 mockDB 验证 (`route.test.ts`).

---
