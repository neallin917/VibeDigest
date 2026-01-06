import type { Metadata } from "next"
import { Heading, Text } from "@/components/ui/typography"
import { LandingNav } from "@/components/landing/LandingNav"
import { LandingUserButton } from "@/components/auth/LandingUserButton"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"

type Props = {
    params: Promise<{
        lang: string
    }>
}

const FAQS = {
    en: [
        {
            question: "What is VibeDigest?",
            answer: "VibeDigest is an AI-powered video summarizer and transcription tool. It helps you quickly understand long YouTube videos, podcasts, and interviews by providing structured summaries, interactive transcripts, and mind maps. It's designed for researchers, students, and content creators who want to save time."
        },
        {
            question: "Is VibeDigest free to use?",
            answer: "Yes, VibeDigest offers a free Starter plan that allows you to summarize up to 3 videos per month with a 15-minute limit per video. For power users, we offer a Plus plan with unlimited summaries, longer video limits, and advanced features like Notion export."
        },
        {
            question: "Which platforms do you support?",
            answer: "Currently, we support YouTube, Apple Podcasts, Bilibili, and Xiaoyuzhou. We are constantly adding support for more platforms to help you consolidate your knowledge from various sources."
        },
        {
            question: "How accurate is the transcription and summary?",
            answer: "We use state-of-the-art AI models (like OpenAI's GPT-4o and Anthropic's Claude 3.5 Sonnet) to ensure high accuracy. While AI is not perfect, our interactive transcript feature allows you to verify any part of the summary against the original video instantly."
        },
        {
            question: "Can I export my summaries?",
            answer: "Yes! You can export your summaries and notes to Markdown, PDF, or directly to Notion. This makes it easy to integrate your learning into your personal knowledge base (PKM)."
        },
        {
            question: "Do you support multiple languages?",
            answer: "Absolutely. VibeDigest can transcribe and summarize videos in over 50 languages. It also includes a translation layer, so you can consume foreign content in your native language seamlessly."
        }
    ],
    zh: [
        {
            question: "什么是 VibeDigest?",
            answer: "VibeDigest 是一款 AI 驱动的视频摘要和转写工具。它通过提供结构化摘要、交互式逐字稿和思维导图，帮助您快速理解冗长的 YouTube 视频、播客和访谈。它是为希望节省时间的研究人员、学生和内容创作者设计的。"
        },
        {
            question: "VibeDigest 是免费的吗？",
            answer: "是的，VibeDigest 提供免费的入门版，允许您每月摘要最多 3 个视频（每个视频限时 15 分钟）。对于深度用户，我们要提供 Plus 版，包含无限摘要、更长的视频时长限制以及 Notion 导出等高级功能。"
        },
        {
            question: "你们支持哪些平台？",
            answer: "目前，我们支持 YouTube、Apple Podcasts、Bilibili 和小宇宙。我们正在不断增加对更多平台的支持，帮助您整合来自不同来源的知识。"
        },
        {
            question: "转写和摘要的准确度如何？",
            answer: "我们使用最先进的 AI 模型（如 OpenAI 的 GPT-4o 和 Anthropic 的 Claude 3.5 Sonnet）来确保高准确度。虽然 AI 并非完美，但我们的交互式逐字稿功能允许您随时将摘要的任何部分与原始视频进行核对。"
        },
        {
            question: "我可以导出摘要吗？",
            answer: "当然！您可以将摘要和笔记导出为 Markdown、PDF 或直接导出到 Notion。这使得将学习内容整合到您的个人知识库 (PKM) 变得非常容易。"
        },
        {
            question: "你们支持多种语言吗？",
            answer: "当然。VibeDigest 可以转写和摘要超过 50 种语言的视频。它还包含翻译层，因此您可以用母语无障碍地消费外语内容。"
        }
    ]
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
    const { lang } = params
    const isZh = lang === "zh"

    return {
        title: isZh ? "常见问题 (FAQ) - VibeDigest AI 视频摘要助手" : "Frequently Asked Questions (FAQ) - VibeDigest AI Video Summarizer",
        description: isZh
            ? "关于 VibeDigest 的常见问题解答。了解如何使用 AI 快速摘要 YouTube 和 Bilibili 视频，以及我们的定价和功能详情。"
            : "Answers to common questions about VibeDigest. Learn how to summarize YouTube videos with AI, pricing details, and supported platforms.",
        alternates: {
            languages: {
                'en': '/en/faq',
                'zh': '/zh/faq',
            }
        }
    }
}

export default async function FAQPage(props: Props) {
    const params = await props.params;
    const { lang } = params
    const isZh = lang === "zh"
    const content = isZh ? FAQS.zh : FAQS.en

    // Schema.org FAQPage Structured Data
    const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": content.map(item => ({
            "@type": "Question",
            "name": item.question,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": item.answer
            }
        }))
    }

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5] font-sans selection:bg-primary/30">
            {/* Reuse LandingNav but we might need to adjust it to support non-hash links if we want reusable nav */}
            {/* For now, we will just put a simple back link or header */}
            <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0A0A0A]/80 backdrop-blur-md">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <a href={`/${lang}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-black font-bold text-xl">
                            V
                        </div>
                        <span className="font-bold text-lg tracking-tight">VibeDigest</span>
                    </a>

                    <div className="flex items-center gap-4">
                        <LanguageInlineSelect />
                        <LandingUserButton />
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-16">
                        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 mb-6">
                            {isZh ? "常见问题" : "Frequently Asked Questions"}
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            {isZh ? "关于 VibeDigest 您需要了解的一切" : "Everything you need to know about VibeDigest"}
                        </p>
                    </div>

                    <div className="space-y-8">
                        {content.map((item, index) => (
                            <div
                                key={index}
                                className="group p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all duration-300"
                            >
                                <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-primary transition-colors">
                                    {item.question}
                                </h3>
                                <p className="text-muted-foreground leading-relaxed">
                                    {item.answer}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-20 text-center p-8 rounded-3xl bg-gradient-to-b from-emerald-900/10 to-transparent border border-white/5">
                        <h2 className="text-2xl font-bold mb-4">
                            {isZh ? "还有其他问题？" : "Still have questions?"}
                        </h2>
                        <p className="text-muted-foreground mb-8">
                            {isZh ? "我们随时为您提供帮助。发送邮件给我们。" : "We're here to help. Send us an email."}
                        </p>
                        <a
                            href="mailto:support@vibedigest.neallin.xyz"
                            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-black font-medium hover:bg-gray-200 transition-colors"
                        >
                            {isZh ? "联系支持" : "Contact Support"}
                        </a>
                    </div>
                </div>
            </main>

            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
            />
        </div>
    )
}
