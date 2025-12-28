# VibeDigest

[English](./README.md)


**VibeDigest** 是一个现代化的全栈应用程序，旨在无缝下载视频、转录音频并生成 AI 驱动的摘要。它专为性能和美学而设计，利用了 OpenAI 的强大功能和 Next.js 的速度。

## ✨ 主要亮点 (v3)

- **下一代前端**：使用 **Next.js 14+ (App Router)** 和 **TailwindCSS** 构建，以获得响应迅速、流畅的体验。
- **卓越的用户体验**：以暗模式为主的设计，具有“Supabase 风格”的玻璃拟态和精致的动画。
- **高级后端**：由 **FastAPI** 和官方 **OpenAI API**驱动，以获得业界领先的转录准确性。
- **实时更新**：通过 **Supabase Realtime** 即时反馈任务进度。

## 🚀 功能

- **通用视频支持**：通过 `yt-dlp` 提供强大的视频下载功能。
- **智能处理**：大文件的自动音频提取和智能分块。
- **实时仪表板**：实时观看任务从排队到完成的进度。
- **入职演示**：新用户会看到一个实时演示任务，以立即了解平台的功能。
- **浏览器通知**：即使在后台，也可以在任务完成时获得即时警报。
- **安全认证**：通过 Supabase Auth 集成电子邮件和 Google 登录支持。
- **多语言 UI (i18n)**：内置 UI 语言切换器，支持阿拉伯语的 RTL。
- **灵活定价**：混合模式（订阅 + 按需付费），具有年度计费选项和透明的使用跟踪。
- **支付（可选）**：通过 Stripe 进行卡支付，通过 Coinbase Commerce 进行加密货币结帐。

## 🛠 技术栈

### 前端 (The Thick Client)
- **框架**: Next.js 14
- **语言**: TypeScript
- **样式**: TailwindCSS, Framer Motion, Lucide React
- **数据**: Supabase Client & Custom API Client

### 后端 (The Service Worker)
- **核心**: FastAPI (Python 3.10+)
- **AI 引擎**: OpenAI API (Whisper)
- **处理**: `yt-dlp` (下载), `pydub` (音频操作)
- **管理器**: `uv` 用于快速 Python 包管理

## 🏁 快速开始

### 先决条件
- Python 3.10 或更高版本
- Node.js & npm
- Supabase 项目
- OpenAI API Key

### 安装

1.  **克隆仓库**
    ```bash
    git clone https://github.com/your-repo/ai-video-transcriber.git
    cd ai-video-transcriber
    ```

2.  **后端设置 (Docker)**
    ```bash
    # 确保 Docker Desktop 正在运行
    docker-compose up -d
    ```
    *配置环境*：创建 `backend/.env` 并包含：
    - `SUPABASE_URL`
    - `SUPABASE_SERVICE_KEY`
    - `SUPABASE_SERVICE_KEY`
    - `OPENAI_API_KEY`
    - `RESEND_API_KEY` (可选，用于反馈邮件)
    - `STRIPE_SECRET_KEY` (可选，用于定价 / Stripe 结帐)
    - `COINBASE_API_KEY` (可选，用于加密货币结帐)
    - `COINBASE_WEBHOOK_SECRET` (可选，用于 Coinbase webhook 验证)
    - `OPENAI_SUMMARY_MATCH_THRESHOLD` (可选，默认: 4.0。越低 = 时间戳匹配越多，越高 = 更严格)
    - `FRONTEND_URL` (可选，用于支付重定向 URL；默认为 `http://localhost:3000`)

    > **注意**：如果您更新了 `requirements.txt`，请运行 `docker-compose up --build -d transcriber-backend`。

3.  **前端设置**
    ```bash
    cd frontend
    npm install
    ```
    *配置环境*：创建 `frontend/.env.local` 并包含：
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `NEXT_PUBLIC_API_URL=http://localhost:8000`

### 使用

1.  **启动后端 Worker**
    后端通过 Docker 在后台运行。
    查看日志：
    ```bash
    docker logs -f transcriber-backend
    ```

2.  **启动用户界面**
    从 `frontend` 目录：
    ```bash
    npm run dev
    ```

3.  **打开浏览器** 访问 `http://localhost:3000`。

## 📖 架构概览

系统基于 **控制平面 vs 数据平面** 模型运行：

-   **控制**：前端通过 HTTP 向后端发送指令（如“处理视频”）。
-   **数据**：后端更新数据库。前端 **从不** 等待 HTTP 响应来获取状态；它订阅数据库更改。这确保了 UI 始终与任务的真实状态同步。

## 🌍 i18n (UI 多语言)

- **支持的语言环境**: `en`, `zh`, `es`, `ar`, `fr`, `ru`, `pt`, `hi`, `ja`, `ko`
- **持久化**: 存储在 `localStorage` 的键 `vd.locale` 中
- **支持 RTL**: 阿拉伯语 (`ar`) 自动设置 `<html dir="rtl">`
- **用户更改语言的地方**:
  - `frontend/src/app/(main)/settings/page.tsx` (设置 → 语言)
  - 公共页面: 落地页 (`/`) 和 登录页 (`/login`) 右上角
- **开发者说明**:
  - 唯一真相源: `frontend/src/lib/i18n.ts`
  - Hook: `useI18n()` 来自 `frontend/src/components/i18n/I18nProvider.tsx`
  - 如果您添加新的 UI 字符串，请在 `messages.en` 中添加键并为所有支持的语言环境提供翻译。
  - **智能默认值**：“新任务”表单会自动选择与您当前 UI 语言首选项匹配的翻译目标语言。

## 🧱 数据库迁移 (Supabase)

- **定价架构**: `backend/sql/01_pricing_schema.sql`
- **支付订单 (Stripe + Coinbase)**: `backend/sql/02_payment_orders.sql`

## 🧪 运行测试

### 后端测试 (Pytest)
使用模拟的外部服务（安全且免费）运行 `pytest`。
```bash
# 从项目根目录运行
export PYTHONPATH=backend
pytest -c backend/pytest.ini backend
```

### 前端测试 (Vitest)
运行组件集成测试。
```bash
cd frontend
npm test
```

## 📄 许可证

本项目根据 [LICENSE](LICENSE) 文件中的条款进行许可。

---
*有关架构细节和贡献指南，开发人员应参考 `AGENTS.md`。*
