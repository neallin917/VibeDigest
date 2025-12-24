"use client"

import { useI18n } from "@/components/i18n/I18nProvider"

export default function RefundPolicy() {
    const { t } = useI18n()

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
            <h1 className="text-3xl font-bold">{t("policies.refund.title")}</h1>
            <p className="text-muted-foreground">{t("policies.common.lastUpdated")}</p>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.refund.general.title")}</h2>
                <p dangerouslySetInnerHTML={{ __html: t("policies.refund.general.content") }} />
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.refund.crypto.title")}</h2>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500">
                    <p className="font-semibold">{t("policies.refund.crypto.noticeTitle")}</p>
                    <p className="text-sm mt-1">{t("policies.refund.crypto.noticeContent")}</p>
                </div>
                <ul className="list-disc pl-5 space-y-2">
                    <li dangerouslySetInnerHTML={{ __html: t("policies.refund.crypto.list.noRefunds") }} />
                    <li dangerouslySetInnerHTML={{ __html: t("policies.refund.crypto.list.networkErrors") }} />
                    <li dangerouslySetInnerHTML={{ __html: t("policies.refund.crypto.list.underpayments") }} />
                    <li dangerouslySetInnerHTML={{ __html: t("policies.refund.crypto.list.gas") }} />
                </ul>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.common.contactTitle")}</h2>
                <p>
                    {t("policies.common.contactRefundText")}
                    <a href="mailto:support@vibedigest.com" className="text-blue-500 hover:underline ml-1">support@vibedigest.com</a>
                </p>
            </section>
        </div>
    )
}
