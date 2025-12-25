"use client"

import { useI18n } from "@/components/i18n/I18nProvider"

export default function PrivacyPage() {
    const { t } = useI18n()

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] p-8 md:p-16">
            <div className="max-w-3xl mx-auto space-y-8">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Privacy Policy
                </h1>

                <section className="space-y-4">
                    <p className="text-muted-foreground">
                        Last updated: {new Date().toLocaleDateString()}
                    </p>
                    <p>
                        This Privacy Policy describes how {t("brand.name")} ("we", "us", or "our") collects, uses, and discloses your personal information when you use our website and services.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">1. Information We Collect</h2>
                    <p>
                        We collect information you provide directly to us, such as when you create an account, specifically:
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                        <li>Email address</li>
                        <li>Name (if provided via Social Login)</li>
                        <li>Profile picture (if provided via Social Login)</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">2. How We Use Your Information</h2>
                    <p>
                        We use the information we collect to:
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                        <li>Provide, maintain, and improve our services</li>
                        <li>Authenticate your identity</li>
                        <li>Send you technical notices and support messages</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">3. Data Security</h2>
                    <p>
                        We implement reasonable security measures to protect your personal information. We use Supabase for authentication and data storage, which employs industry-standard security practices.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">4. Contact Us</h2>
                    <p>
                        If you have any questions about this Privacy Policy, please contact us.
                    </p>
                </section>
            </div>
        </div>
    )
}
