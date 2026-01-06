"use client"

import { useI18n } from "@/components/i18n/I18nProvider"

export default function TermsOfService() {
    const { t } = useI18n()

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] p-8 md:p-16">
            <div className="max-w-3xl mx-auto space-y-8">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    {t("policies.terms.title")}
                </h1>

                <p className="text-muted-foreground">
                    {t("policies.common.lastUpdated")}
                </p>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">
                        {t("policies.terms.service.title")}
                    </h2>
                    <p>
                        {t("policies.terms.service.content")}
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">
                        {t("policies.terms.payments.title")}
                    </h2>
                    <p>
                        {t("policies.terms.payments.content")}
                    </p>
                    <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                        <li>{t("policies.terms.payments.list.l1")}</li>
                        <li>{t("policies.terms.payments.list.l2")}</li>
                        <li>{t("policies.terms.payments.list.l3")}</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">
                        {t("policies.terms.responsibilities.title")}
                    </h2>
                    <p>
                        {t("policies.terms.responsibilities.content")}
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">
                        {t("policies.common.contactTitle")}
                    </h2>
                    <p>
                        {t("policies.common.contactText")}
                        <a href="mailto:support@vibedigest.com" className="text-blue-500 hover:underline ml-1">support@vibedigest.com</a>
                    </p>
                </section>
            </div>
        </div>
    )
}
