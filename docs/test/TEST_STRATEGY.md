# 测试策略与场景矩阵 (Test Strategy & Scenario Matrix)

> **文档状态**: 已更新 ✅  
> **最后更新**: 2026-01-20 (适配 Chat-First 架构)  
> **维护者**: 团队

本文档以**用户旅程 (User Journey)** 为中心，定义可执行的测试契约。

---

## 📐 策略决策

### 技术选型

| 决策项 | 选择 | 理由 |
|--------|------|------|
| **Auth Mock** | Playwright `storageState` | Session 有效期长；CI 用 GitHub Secret；设置简单 |
| **Backend API Mock** | MSW/page.route() (日常) + Staging (验收) | 避免 LLM/Whisper 成本；日常快速反馈 |
| **YouTubePlayer 测试** | Unit + Integration (不测真实 iframe) | iframe 不稳定；验证回调和组件协作即可 |
| **Chat API 测试** | AI SDK Mock (E2E) + Unit | 验证流式响应、工具调用、UI 渲染 (VideoCard) |
| **路由架构** | Chat First | 主要测试集中在 `/chat`，Dashboard 相关测试已弃用 |

---

## 📊 优先级定义

| 优先级 | 定义 | 业务依据 |
|--------|------|----------|
| **P0** | 核心转化/核心使用路径 | 影响付费转化、核心功能不可用、数据丢失 |
| **P1** | 重要但可降级 | 影响用户体验但有 workaround |
| **P2** | 体验增强 | 锦上添花，失败不影响核心流程 |

---

## Journey 1: Chat-First 核心交互 (P0)

> **业务目标**: 用户通过对话界面提交视频，获取摘要并进行后续问答。
> **失败成本**: 核心产品价值失效。

### 1.1 [P0] 提交 URL 并触发分析
| Given | 已登录用户，在 `/chat` 欢迎界面 |
|-------|----------------------------------------|
| When | 在输入框粘贴 YouTube URL 并发送 |
| Then | 消息列表显示用户 URL → 显示 "Thinking..." → 显示 **VideoCardMessage** (Processing) |
| 层级 | **E2E** (Mock Backend API) |
| 状态 | ✅ 已覆盖 (`e2e/chat.spec.ts`) |

### 1.2 [P0] 视频卡片交互 (Context Panel)
| Given | 聊天流中已显示 VideoCardMessage |
|-------|-----------------|
| When | 点击卡片上的 "View" 按钮或区域 |
| Then | 右侧 **Context Panel** 滑出，加载 VideoPlayer 和 Summary |
| 层级 | **E2E** |
| 状态 | ✅ 已覆盖 (`e2e/chat.spec.ts`) |

### 1.3 [P1] 历史记录访问 (Sidebar)
| Given | 用户有历史任务 |
|-------|----------------|
| When | 点击 Sidebar 中的 "Tasks" 列表项 |
| Then | 路由更新 `?task={id}` → Context Panel 打开对应任务 |
| 层级 | **E2E** / **Integration** |
| 状态 | ⏳ 待完善 |

---

## Journey 2: 任务详情与播放 (Context Panel)

> **业务目标**: 在侧边栏中消费内容，点击时间戳跳转。

### 2.1 [P0] 时间戳点击 → 视频跳转
| Given | Context Panel 中摘要包含时间戳 |
|-------|-------------------------------------|
| When | 点击时间戳徽章 |
| Then | VideoPlayer 调用 `seekTo(seconds)` |
| 层级 | **Unit/Integration** (`VideoDetailPanel`, `VideoPlayer`) |
| 状态 | ✅ 已覆盖 |

### 2.2 [P1] 摘要复制
| Given | 摘要已渲染 |
|-------|-----------|
| When | 点击 "复制" |
| Then | 内容写入剪贴板 |
| 层级 | **Unit** |
| 状态 | ✅ 已覆盖 |

---

## Journey 3: 游客获客与转化 (Acquisition)

> **业务目标**: 游客在着陆页尝试功能，被引导注册。

### 3.1 [P0] 落地页尝试 → 登录引导
| Given | 游客在 `/` (Landing Page) |
|-------|-------------|
| When | 输入 URL 并点击 "Generate" |
| Then | 跳转 `/login` (保留意图) |
| 层级 | **E2E**: `task-creation.spec.ts` |
| 状态 | ✅ 已覆盖 |

### 3.2 [P0] 受保护路由重定向
| Given | 游客 (未登录) |
|-------|---------------|
| When | 访问 `/chat` 或 `/history` |
| Then | 重定向 `/login` |
| 层级 | **E2E** |
| 状态 | ✅ 已覆盖 |

---

## Journey 4: 认证流程

### 4.1 [P0] 登录成功跳转 Chat
| Given | 用户在 `/login` |
|-------|-----------------|
| When | 登录成功 |
| Then | 跳转 `/chat` (不再是 `/dashboard`) |
| 层级 | **E2E** |
| 状态 | ✅ 已覆盖 |

---

## 🔗 相关文档

- [TEST_COVERAGE.md](./TEST_COVERAGE.md) - 覆盖率追踪
- [e2e/chat.spec.ts](../../frontend/e2e/chat.spec.ts) - 核心 Chat 流程
- [e2e/task-creation.spec.ts](../../frontend/e2e/task-creation.spec.ts) - 获客流程
