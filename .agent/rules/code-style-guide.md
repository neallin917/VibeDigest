---
trigger: always_on          # 设置为 always_on 表示只要在这个 workspace 工作，这些规则始终生效
glob: ["**/*"]             # (可选) 指定规则适用的文件范围 ["src/**/*"]
description: 项目统一的代码风格指南，遵循业界最佳实践，严禁 Dirty Hack
---

# Code Style & Best Practices

## 🔴 Prime Directive (最高准则)
> **严格按照 业界最佳实践 来编写符合我们框架版本的新版代码。**
> **不要用 hardcoded glue-like code 来讨好解决 bug。**
> **如果遇到无法解决的问题，查官方文档 或者 停止并询问用户。**

## 1. Quality Assurance & Problem Solving (质量保证与问题解决)
- **Root Cause Analysis (根因分析)**: 遇到 Bug 时，必须分析根本原因，禁止仅仅“修补”症状 (Symptom patching)。
  - *Bad*: "加个 if check 就不报错了"
  - *Good*: "为什么这里的数据会是 null？上游逻辑有问题，修复上游。"
- **No Magic Values**: 禁止 Hardcode 魔法值（ID、URL、配置项）。所有配置应来自环境变量 (`.env`) 或统一的常量文件。
- **Official Patterns (官方模式)**: 优先使用框架（Next.js, FastAPI, Supabase）当前版本推荐的“官方”写法。
  - *Rule*: 如果现有代码使用了过时写法，在新功能中应使用新写法，并标记 Technical Debt。

## 2. Frontend (React / TypeScript / Next.js / Tailwind)
- **TypeScript Rigor**:
  - **Forbidden**: `any` 类型。必须定义明确的 Interface 或 Type。
  - **Forbidden**: `// @ts-ignore` (除非有极其充分的理由并附带注释说明)。
  - Props 必须显式定义类型。
- **React Implementation**:
  - **Hooks**: 必须遵循 Rules of Hooks。`useEffect` 不应用于派生状态计算 (Derived State)，直接在 Render 阶段计算。
  - **Components**: 优先使用 **Function Components**。
  - **Naming**: 组件文件使用 `PascalCase` (e.g., `TaskItem.tsx`)，Hook 使用 `use` 前缀。
- **Styling**:
  - 优先使用 **Tailwind CSS** utility classes。
  - 避免行内 `style={{...}}`。
  - 保持 UI 一致性，复用 Design System 中的 token。

## 3. Backend (Python / FastAPI / Supabase)
- **Type Safety**:
  - 所有函数签名必须包含 Type Hints (e.g., `def process(x: int) -> bool:`).
  - 使用 `Pydantic` 模型进行数据校验和序列化，禁止手动解析 JSON 字典。
- **Error Handling**:
  - **Forbidden**: 裸露的 `try...except` (Bare except scopes)。必须捕获具体异常。
  - 错误处理应包含上下文日志，不仅仅是 print。
- **Code Structure**:
  - 保持模块化。业务逻辑应与 API 路由层分离 (Service Layer Pattern)。

## 4. Agent Behavior (AI 行为规范)
- **Stop & Ask**: 当发现现有代码逻辑极其混乱，或者需求与现有架构严重冲突时，**不要强行写 Glue Code (胶水代码)**。
- **Documentation First**: 在使用复杂的三方库 API 前，如果“好像记得是这样”，请**停止**并在思考中确认需要查阅文档，或者要求用户提供文档上下文。
- **Clean Commits**: 生成的代码不应包含调试用的 `console.log` 或 `print` 语句（除非是在 debug 模式下显式要求）。