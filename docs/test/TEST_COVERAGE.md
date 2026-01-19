# 测试覆盖率详细追踪清单 (Detailed Test Coverage Checklist)

本文档旨在提供粒度更细的测试覆盖追踪，罗列具体的业务场景、UI 交互和后端逻辑。请在开发过程中对照此文档进行自测和补充。

> **当前状态 (Current Status)**: 
> - **Frontend**: 核心组件 (Core Components) 覆盖率 **~70%**，全项目覆盖率 **~20%**。
> - **E2E**: Auth StorageState 已配置，认证测试可运行。
> - **Backend**: API 与 核心异步流程 已覆盖，全项目覆盖率 **Partial**。

---

## 🖥 Frontend (前端)

### 🔴 E2E 关键流程 (End-to-End)
> 运行命令: `npx playwright test e2e/`

#### 1. 导航与鉴权 (`e2e/navigation-auth.spec.ts`)
- **游客访问 (Guest)**
    - [x] **着陆页 (Landing Page)**: 页面正常加载，Header 链接 (FAQ) 可点击并正确跳转。
    - [x] **锚点导航**: 点击 "Demos" 等锚点按钮不应触发页面刷新或跳转至登录页。
    - [x] **Logo 点击**: 在非首页 (如 FAQ)，点击 Logo 应返回首页。
    - [x] **CTA 按钮**: 点击 "Get Started" / "Sign Up" 必须跳转至 `/login`。
    - [x] **受保护路由**: 访问 `/dashboard`, `/settings`, `/history` 应自动重定向至 `/login`。
- **登录状态 (Auth Scenarios)** - ✅ **Auth StorageState 已配置**
    - [x] **登录跳转**: 登录成功后应跳转至 `/dashboard`。
    - [ ] **注销**: 点击头像 -> Logout 应清除 Session 并返回首页 (Skip 待选择器调整)。

#### 2. 核心可用性 (`e2e/smoke.spec.ts`)
- **着陆页检查**
    - [x] **SEO Meta**: 检查 Title, Description, Open Graph 标签是否存在。
    - [x] **多语言**: 语言切换器存在，URL 包含 Locale (`/en`, `/zh`)。
    - [x] **输入框**: 视频 URL 输入框存在且可输入内容。
- **表单交互**
    - [x] **空提交**: 未输入 URL 点击生成，不应跳转。
    - [x] **错误提示**: 输入无效 URL 应显示 URL 帮助对话框。

#### 3. 任务创建流程 (`e2e/task-creation.spec.ts`) - ✅ 新增
- [x] **提交 URL 创建任务**: 输入有效 URL 应跳转到 task 详情页或登录页。
- [x] **空 URL 错误**: 显示 URL 帮助对话框。
- [x] **无效 URL 错误**: 显示 URL 帮助对话框。

---

### 📦 Component Unit Tests (组件单元测试)
> 运行命令: `npm run test:cov`

#### 1. Landing Page (着陆页)
- [x] `HeroSection.tsx`: **100%** Coverage
    - 验证标题文案渲染、TaskForm 集成、Bold Markdown 解析。
- [x] `LandingNav.tsx`: **~98%** Coverage
    - 验证 ScrollSpy 滚动监听、Anchor 导航、路由跳转、Mobile/Desktop 菜单渲染。
    - 覆盖了核心交互逻辑 (Click, Scroll)。

#### 2. 任务处理 (`src/components/tasks`) - 核心业务
- **Summary & Transcript**
    - [x] `transcript.ts`: **73.8%** Lines (Utils)
    - [x] `TranscriptTimeline.tsx`: **95.3%** Lines (UI)
        - 渲染时间轴片段，点击时间戳回调工作正常。
    - [x] `VideoEmbed.tsx`: **83.8%** Lines (UI)
        - 处理 YouTube 不同格式链接 (short/long id)，渲染 iframe。
- **Task Detail (`TaskDetailClient.test.tsx`)**
    - [x] `TaskDetailClient.tsx`: **44.3%** Lines (Improved)
        - **Initial Render**: 渲染任务标题和摘要。
        - **Empty State**: 数据加载中的 Loading 状态。
        - **Clipboard**: 复制 Markdown 到剪贴板功能。
        - **Error Handling**: 处理后端返回的 output error。
- **Missing Coverage (Uncovered)**:
    - [x] `YouTubePlayer.tsx`: **55%** Lines (Added Unit Tests)
    - [x] `Sidebar.tsx`: **Partial** (Tests added for rendering & navigation; Async auth tests skipped)

#### 2. 仪表盘交互 (`src/components/dashboard`)
- **Task Creation (`TaskForm.test.tsx`)**
    - [x] `TaskForm.tsx`: **88.8%** Lines
        - 表单渲染: 输入框、按钮显示文案正确 (I18n)。
        - 提交流程: 模拟 API 成功响应 (`task_id`)，断言路由跳转。
        - 参数传递: 验证 `FormData` 包含 `video_url` 和 `summary_language`。
        - 空值拦截: 空 URL 不触发 API 调用。
        - **配额耗尽**: Mock API 403 显示升级对话框。
        - **URL 帮助**: 无效 URL 显示支持平台列表。

#### 3. 基础 UI 组件 (`src/components/ui`)
- [x] `button.tsx`: **100%** Lines
- [ ] `card.tsx`
- [ ] `dialog.tsx`
- [ ] `input.tsx`
- [ ] `select.tsx` (下拉菜单交互)

---

## ⚙️ Backend (后端)

### 🚀 API 接口测试 (`tests/test_api.py`)
> 运行命令: `PYTHONPATH=. pytest tests/test_api.py`

- **基础服务**
    - [x] **Health Check**: `GET /` 返回 200 OK。
    - [x] **404 Handling**: 访问不存在路径返回 404。
    - [x] **Security**: 敏感接口 (如 `/api/config`) 确认已移除 (404)。
    - [x] **CORS**: 验证允许的 Origin (localhost) 和拒绝的 Origin (evil.com)。

### 🧠 核心逻辑模块 (Core Logic)

#### 1. 理解与摘要 (`tests/test_comprehension.py`)
- **Comprehension Agent**
    - [x] **JSON 输出结构**: 验证 LLM 返回的 JSON 包含 `core_intent`, `key_insights` 等必须字段。
    - [x] **多语言支持**: 分别测试 `target_language="zh"` 和 `en`。

#### 2. 异步流程与异常处理 (`tests/test_async_flow_failure.py`)
- **Fault Tolerance**
    - [x] **Transcribe Failure**: 当 Whisper 抛出异常时，Task 状态更新为 `error`。
    - [x] **Summarize Failure**: 当 LLM/Summarizer 抛出异常时，Output 状态更新为 `error`。

#### 3. 缺失覆盖 (Missing Backend Coverage)
以下核心模块目前缺乏单元测试或集成测试：
- [ ] **Transcriber (`transcriber.py`)**: Whisper 模型加载、音频片段处理、字幕生成逻辑。
- [ ] **Summarizer (`summarizer.py`)**: 长文本分块摘要 logic。
- [ ] **Database Client (`db_client.py`)**: 具体的 CRUD 操作 (Tasks, Users, Outputs)。

---

## 📊 测试覆盖总结 (Summary)

我们在 "Critical Uncovered Areas" 取得了很大进展：
1.  ✅ **Frontend TaskDetail**: 添加了基础测试，覆盖了渲染、复制和错误展示。
2.  ✅ **Backend Async Flow**: 添加了针对 Whisper/LLM 故障的容错测试。
3.  ⚠️ **Sidebar/Nav**: 虽然 E2E 覆盖了部分，但针对移动端菜单和滚动交互的单元测试仍需加强。

**下一步建议 (Next Steps)**:
- 完善 4.2 Logout 测试的用户菜单选择器。
- 为 `db_client` 添加集成测试容器支持。

---

## 🔐 Auth StorageState 配置

> **状态**: ✅ 已配置

### 文件结构

| 文件 | 说明 |
|------|------|
| `e2e/auth.setup.ts` | 认证脚本，登录测试账户并保存 Session |
| `playwright.config.ts` | 分离 `chromium-guest` 和 `chromium-auth` 项目 |
| `playwright/.auth/user.json` | 保存的登录 Session (自动生成) |

### 运行方式

```bash
# 运行认证测试
TEST_USER_EMAIL=xxx TEST_USER_PASSWORD=xxx npx playwright test --project=chromium-auth

# 运行 Guest 测试 (无需认证)
npx playwright test --project=chromium-guest
```

