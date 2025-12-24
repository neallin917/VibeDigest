"use client"

import { useI18n } from "@/components/i18n/I18nProvider"

export default function TermsOfService() {
    const { t } = useI18n()

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 space-y-6">
            <h1 className="text-3xl font-bold">{t("policies.terms.title")}</h1>
            <p className="text-muted-foreground">{t("policies.common.lastUpdated")}</p>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.terms.service.title")}</h2>
                <p>
                    {t("policies.terms.service.content")}
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.terms.payments.title")}</h2>
                <p>
                    {t("policies.terms.payments.content")}
                </p>
                <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                    <li>{t("policies.terms.payments.list.l1")}</li>
                    <li>{t("policies.terms.payments.list.l2")}</li>
                    <li>{t("policies.terms.payments.list.l3")}</li>
                </ul>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.terms.responsibilities.title")}</h2>
                <p>
                    {t("policies.terms.responsibilities.content")}
                </p>
            </section>

            <section className="space-y-4">
                <h2 className="text-xl font-semibold">{t("policies.common.contactTitle")}</h2>
                <p>
                    {t("policies.common.contactText")}
                    <a href="mailto:support@vibedigest.com" className="text-blue-500 hover:underline ml-1">support@vibedigest.com</a>
                </p>
            </section>
        </div>
    )
}
