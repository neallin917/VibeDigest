# 计划：反幻觉引擎升级 (VibeDigest)

## 摘要 (TL;DR)

> **快速总结**：通过实施“交易机器人”风格的架构（上下文组合器、严格系统提示词、落地结构化输出和强制低温），升级 VibeDigest 的 AI 引擎以防止幻觉。
>
> **交付物**：
> - `ContextComposer` 服务，用于严格的数据注入
> - `SystemPromptFactory`，用于基于约束的严格提示词构建
> - 更新后的 Pydantic Schema，包含 `citations`（引用 - **纯文本**）和 `confidence`（置信度）字段
> - 重构 `SummaryEngine` 和 `ComprehensionAgent`
>
> **预估工作量**：中等（仅后端）
> **并行执行**：是 - 2 波
> **关键路径**：Composer → Prompt Factory → Service Refactor

---

## 背景 (Context)

### 原始需求
基于 "ValueCell" 交易机器人架构实施反幻觉机制：
1. 严格的系统提示词（"权威来源"，"优先无操作/NOOP"）
2. 上下文注入 / Composer 模式
3. 结构化输出（Schema 强制执行）
4. 配置（低温度，无状态）

### 当前状态分析
- **提示词**：目前使用硬编码的格式化字符串 (`SUMMARY_V4_PHASE1_SYSTEM`)。
- **数据**：字幕作为原始字符串传递，被任意截断。
- **Schema**：存在 Pydantic 模型 (`SummaryResponseV4`) 但缺乏“落地/Grounding”。
- **配置**：`DEFAULT_TEMPERATURE` 为 0.1（良好），但“智能”模型使用的是 `REASONING_TEMPERATURE` (1.0)。
- **约束**：项目对**时间戳要求低**。落地必须依赖**文本引用 (Text Quotes)** 而非时间码。

---

## 工作目标 (Work Objectives)

### 核心目标
将 AI 管道从“生成式创意写作”转变为“落地事实提取”。

### 具体交付物
- `backend/services/composer/core.py`: 上下文组合器 (Context Composer)
- `backend/prompts/factory.py`: 系统提示词工厂 (System Prompt Factory)
- `backend/services/summarizer/models.py`: 带有**文本引用**的更新版 Schema
- `backend/services/summarizer/summary_engine.py`: 重构以使用 Composer
- `backend/services/comprehension.py`: 重构以使用 Composer

### 完成定义 (Definition of Done)
- [ ] 所有 AI 输出（摘要、洞察）均作为严格的 JSON 返回。
- [ ] 摘要中的每个关键事实都包含 `citation`（**原文引用**）。
- [ ] 所有提取任务的 Temperature 强制设为 `0.0` 或 `0.1`。
- [ ] 空内容/无意义的字幕触发优雅的 "NOOP" 响应（无幻觉）。

### 必须包含 (Must Have)
- **上下文落地**：必须明确告知模型“仅使用此上下文回答”。
- **严格 Schema**：如果模型无法适应 Schema，必须失败（或重试），而不是输出文本。
- **文本证明**：模型必须提供它使用的*原文引用*作为依据（时间码可选）。

### 绝不包含 (Guardrails)
- **无前端变更**：UI 将接收新数据，但忽略额外字段是可以的。
- **无外部知识**：模型必须严格拒绝使用字幕中不存在的外部知识。

---

## 验证策略 (Verification Strategy)

> **通用规则：零人工干预**
> 所有任务必须由 Agent 验证。

### 测试决策
- **基础设施存在**：是 (`pytest`)
- **自动化测试**：是 (TDD)
- **框架**：`pytest`

### TDD 工作流
1.  **红 (RED)**：创建 `backend/tests/services/test_composer.py` 定义预期的 JSON 结构。
2.  **绿 (GREEN)**：实现 `ContextComposer`。
3.  **重构 (REFACTOR)**：集成到 `SummaryEngine` 中。

### Agent 执行的 QA 场景

```
场景：Composer 正确打包字幕和约束
  工具：Bash (pytest)
  前置条件：无
  步骤：
    1. 运行 `uv run pytest backend/tests/services/test_composer.py`
  预期结果：Composer 返回包含 "transcript_segments" (或文本块), "metadata", 和 "constraints" 的 JSON 对象。
  证据：测试输出截图。

场景：系统提示词工厂注入严格约束
  工具：Bash (python script)
  前置条件：工厂已实现
  步骤：
    1. 创建脚本 `scripts/debug_prompt.py` 调用工厂。
    2. 使用 `uv run` 运行脚本。
    3. 断言输出包含 "Answer ONLY using the provided context" (仅使用提供的上下文回答)。
    4. 断言输出包含 "Prefer NOOP" (优先无操作)。
  预期结果：提示词字符串包含所有关键字。
  证据：脚本输出。
```

---

## 执行策略 (Execution Strategy)

### 并行执行波次

```
第 1 波 (基础):
├── 任务 1: 上下文组合器 (数据布局)
└── 任务 2: 系统提示词工厂 (约束逻辑)

第 2 波 (集成):
├── 任务 3: Schema 更新 (落地字段 - 文本引用)
└── 任务 4: 摘要引擎重构
└── 任务 5: 理解 Agent 重构

第 3 波 (清理):
└── 任务 6: 清理与最终验证
```

---

## 待办事项 (TODOs)

- [ ] 1. 创建上下文组合器 (数据打包器)

  **要做什么**：
  - 创建 `backend/services/composer/core.py`。
  - 实现 `ContextComposer` 类。
  - 方法 `compose(transcript: str, metadata: dict) -> dict`。
  - 逻辑：严格分块字幕。
  - 逻辑：为缺失的元数据添加“数据不可用”标记。

  **推荐 Agent 配置**：
  - **类别**：`backend-patterns`
  - **技能**：`python`

  **参考**：
  - `backend/services/summarizer/summary_engine.py` (当前的输入处理)

  **验收标准**：
  - [ ] `uv run pytest backend/tests/services/test_composer.py` -> PASS
  - [ ] 输出 JSON 包含 `context_data` 键。
  - [ ] 输出 JSON 包含 `constraints` 键。

- [ ] 2. 创建系统提示词工厂 (严格约束)

  **要做什么**：
  - 创建 `backend/prompts/factory.py`。
  - 实现 `build_system_prompt(task_type: str, language: str) -> str`。
  - **约束注入**：
    - "You are a precise data extractor." (你是一个精确的数据提取者)
    - "Treat the provided Context as AUTHORITATIVE." (将提供的上下文视为权威)
    - "If the answer is not in the context, return null/NOOP." (如果答案不在上下文中，返回 null/NOOP)
    - "Do not use external knowledge." (不要使用外部知识)
  - 支持 `task_type="summary"` 和 `task_type="insight"`。

  **推荐 Agent 配置**：
  - **类别**：`writing` (Prompt Engineering)

  **验收标准**：
  - [ ] 脚本 `scripts/debug_prompt.py` 显示带有 "AUTHORITATIVE" 和 "NOOP" 关键字的提示词。

- [ ] 3. 更新 Pydantic Schema (落地 - 文本引用)

  **要做什么**：
  - 修改 `backend/services/summarizer/models.py`。
  - 更新 `SummaryResponseV4` 以包含：
    - `grounding`: List[Citation]
  - 创建 `Citation` 模型：
    - `quote`: str (字幕中的原文引用)
    - `confidence`: float
    - `start_time`: Optional[float] (可选，不强制)
  - 同样更新 `backend/services/comprehension.py` -> `ComprehensionBriefResponse`。

  **参考**：
  - `backend/services/summarizer/models.py`

  **验收标准**：
  - [ ] `uv run pytest backend/tests/models/test_schemas.py` -> PASS

- [ ] 4. 重构 SummaryEngine 以使用 Composer

  **要做什么**：
  - 修改 `backend/services/summarizer/summary_engine.py`。
  - 用 `ContextComposer.compose()` 替换原始字符串格式化。
  - 用 `PromptFactory.build()` 替换原始 `SystemMessage`。
  - **配置**：在 `get_llm` 调用中强制 `temperature=0.1`（覆盖默认值）。

  **参考**：
  - `backend/services/summarizer/summary_engine.py`

  **验收标准**：
  - [ ] `uv run pytest backend/tests/services/test_summary_engine.py` -> PASS
  - [ ] 验证日志显示 "ContextComposer" 输出。

- [ ] 5. 重构 ComprehensionAgent 以使用 Composer

  **要做什么**：
  - 修改 `backend/services/comprehension.py`。
  - 应用与任务 4 相同的重构。

  **参考**：
  - `backend/services/comprehension.py`

  **验收标准**：
  - [ ] `uv run pytest backend/tests/services/test_comprehension.py` -> PASS

---

## 成功标准 (Success Criteria)

### 最终检查清单
- [ ] 通过 `scripts/test_summary.py`（模拟）生成的摘要返回有效的 JSON。
- [ ] 输出中没有 "作为 AI 模型" 或幻觉产生的外部事实。
- [ ] 输出包含原文文本引用 (Citations)。
