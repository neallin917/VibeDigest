# 测试策略与场景矩阵 (Test Strategy & Scenario Matrix)

> **文档状态**: 已确认 ✅  
> **最后更新**: 2026-01-07 (Auth StorageState 已配置)  
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
| **后端单测范围** | 仅前端本次 | 后端已有基本覆盖；Transcriber 单测 ROI 低 |

---

## 📊 优先级定义

| 优先级 | 定义 | 业务依据 |
|--------|------|----------|
| **P0** | 核心转化/核心使用路径 | 影响付费转化、核心功能不可用、数据丢失 |
| **P1** | 重要但可降级 | 影响用户体验但有 workaround |
| **P2** | 体验增强 | 锦上添花，失败不影响核心流程 |

---

## Journey 1: 视频摘要生成

> **业务目标**: 用户提交 YouTube URL → 获得结构化摘要  
> **失败成本**: 核心卖点失效，直接导致用户流失

### 1.1 [P0] 提交 URL 并获取摘要

| Given | 已登录用户 (有配额)，在 Dashboard 页面 |
|-------|----------------------------------------|
| When | 输入有效 YouTube URL，点击 "生成摘要" |
| Then | 跳转 `/tasks/{id}` → Loading → 渲染 Summary |
| 层级 | **E2E** (Mock Backend API) |
| 状态 | ✅ 已覆盖 (`e2e/task-creation.spec.ts`) |

<details>
<summary>接口契约</summary>

```typescript
// POST /api/process_video → { task_id: string }
// GET /api/tasks/{id} → Task + Output[]

interface StructuredSummaryV1 {
  version: number
  overview: string
  keypoints: Array<{ title: string; detail: string; startSeconds?: number }>
}
```

```json
// ✅ 成功 | ❌ 失败 | ⚪ 处理中
{ "status": "completed", "outputs": [{ "kind": "summary", "content": "{...}" }] }
{ "status": "error", "outputs": [{ "error_message": "..." }] }
{ "status": "processing", "progress": 45 }
```
</details>

### 1.2 [P0] 空/无效 URL 拦截

| Given | 用户在 TaskForm |
|-------|-----------------|
| When | 输入为空 / 非 YouTube URL |
| Then | 不发起 API；显示校验错误 |
| 层级 | **Unit**: `TaskForm.test.tsx` |
| 状态 | ✅ 部分覆盖 |

### 1.3 [P0] 配额耗尽处理

| Given | 用户配额已用完 |
|-------|----------------|
| When | 尝试提交新任务 |
| Then | 显示 "配额已用尽，请升级" + 升级按钮 |
| 层级 | **Integration** (Mock API 403) |
| 状态 | ✅ 已覆盖 (`TaskForm.test.tsx`) |

---

## Journey 2: 任务详情页交互

> **业务目标**: 用户查看摘要、点击时间戳跳转视频  
> **失败成本**: 核心体验受损

### 2.1 [P0] 时间戳点击 → 视频跳转

| Given | 摘要包含 `startSeconds` 的 Keypoint |
|-------|-------------------------------------|
| When | 点击时间戳徽章 |
| Then | YouTubePlayer 调用 `seekTo(seconds)` |
| 层级 | **Unit**: 回调触发 → **Integration**: 组件联动 |
| 状态 | ✅ 已覆盖 (`TranscriptTimeline.test.tsx`, `TaskDetailClient.test.tsx`) |

```typescript
// Unit: TranscriptTimeline.test.tsx
it("click badge → onSeek(120)", () => {
  fireEvent.click(screen.getByRole("button", { name: /2:00/ }))
  expect(onSeek).toHaveBeenCalledWith(120)
})
```

### 2.2 [P0] 摘要复制到剪贴板

| Given | 摘要已渲染 |
|-------|-----------|
| When | 点击 "复制" |
| Then | 调用 clipboard API + 显示 Toast |
| 层级 | **Unit** |
| 状态 | ✅ 已覆盖 |

### 2.3 [P1] 错误状态展示

| Given | output.status = "error" |
|-------|-------------------------|
| When | 页面加载 |
| Then | 显示 error_message + "重试" 按钮 |
| 层级 | **Unit** |
| 状态 | ✅ 已覆盖 (`TaskDetailClient.test.tsx`) |

---

## Journey 3: 游客着陆页

> **业务目标**: 游客了解产品 → 注册转化

### 3.1 [P0] CTA 跳转登录页 ✅

| Given | 游客在着陆页 |
|-------|-------------|
| When | 点击 "Get Started" |
| Then | 跳转 `/login` |
| 层级 | **E2E**: `navigation-auth.spec.ts` |
| 状态 | ✅ 已覆盖 |

### 3.2 [P0] 受保护路由重定向 ✅

| Given | 游客 (未登录) |
|-------|---------------|
| When | 访问 `/dashboard` |
| Then | 重定向 `/login` |
| 层级 | **E2E** |
| 状态 | ✅ 已覆盖 |

### 3.3 [P1] 锚点导航不刷新 ✅

| Given | 游客在着陆页 |
|-------|-------------|
| When | 点击 "Demos" 锚点 |
| Then | 平滑滚动，不跳转 |
| 层级 | **Unit + E2E** |
| 状态 | ✅ 已覆盖 |

---

## Journey 4: 认证流程

### 4.1 [P0] 登录成功跳转 Dashboard

| Given | 用户在 `/login` |
|-------|-----------------|
| When | 输入有效凭据 |
| Then | 跳转 `/dashboard` |
| 层级 | **E2E** (storageState) |
| 状态 | ✅ 已覆盖 (`navigation-auth.spec.ts`) |

### 4.2 [P0] 登出清除 Session

| Given | 已登录用户在 Dashboard |
|-------|------------------------|
| When | 点击 Logout |
| Then | 清除 Session → 跳转首页 |
| 层级 | **E2E** |
| 状态 | ⚠️ Skip (待用户菜单选择器调整) |

---

## Journey 5: 后端核心处理

### 5.1 [P0] Transcriber 容错 ✅

| Given | 视频 URL 有效 |
|-------|---------------|
| When | Whisper 抛异常 |
| Then | Task → error |
| 层级 | **Unit**: `test_async_flow_failure.py` |
| 状态 | ✅ 已覆盖 |

### 5.2 [P0] Summarizer 容错 ✅

| Given | 转录成功 |
|-------|---------|
| When | LLM 抛异常 |
| Then | Output → error |
| 层级 | **Unit** |
| 状态 | ✅ 已覆盖 |

---

## 📋 实施优先级

### 第一批 (P0 必须)

| ID | 场景 | 层级 | 状态 |
|----|------|------|------|
| 1.1 | 提交 URL 获取摘要 | E2E | ✅ |
| 1.3 | 配额耗尽 | Integration | ✅ |
| 2.1 | 时间戳跳转 | Unit+Integration | ✅ |
| 4.1 | 登录跳转 | E2E | ✅ |
| 4.2 | 登出 | E2E | ⚠️ Skip |

### 第二批 (P1 重要)

| ID | 场景 | 层级 | 状态 |
|----|------|------|------|
| 2.3 | 错误状态展示 | Unit | ✅ |

### 第三批 (P2 增强)

纯展示组件 (Features, HowItWorks, Pricing) 仅做冒烟 Snapshot。

---

## 🔗 相关文档

- [TEST_COVERAGE.md](./TEST_COVERAGE.md) - 覆盖率追踪
- [e2e/navigation-auth.spec.ts](../frontend/e2e/navigation-auth.spec.ts) - 导航 E2E
- [e2e/smoke.spec.ts](../frontend/e2e/smoke.spec.ts) - 冒烟测试
