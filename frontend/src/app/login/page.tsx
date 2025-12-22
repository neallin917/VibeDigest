"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

import { Mail, Sparkles } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
    const supabase = createClient()
    const { t } = useI18n()

    const handleGoogleLogin = async () => {
        setLoading(true)
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`
            }
        })
        if (error) setMessage({ type: 'error', text: error.message })
        setLoading(false)
    }

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`
            }
        })

        if (error) {
            setMessage({ type: 'error', text: error.message })
        } else {
            setMessage({ type: 'success', text: t("auth.checkYourEmail") })
        }
        setLoading(false)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1C1C1C] text-[#EDEDED] p-4">
            <Card className="w-full max-w-md glass border-white/10 relative">
                <div className="absolute top-4 right-4">
                    <LanguageInlineSelect />
                </div>
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto bg-primary/20 p-3 rounded-full w-fit mb-2">
                        <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">{t("auth.welcomeBack")}</CardTitle>
                    <CardDescription>{t("auth.signInToContinue", { appName: t("brand.name") })}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Google Login */}

                    {/* Google Login */}
                    <Button
                        variant="outline"
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full h-11 bg-white text-black hover:bg-white/90 border-0 font-medium"
                    >
                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                        {t("auth.signInWithGoogle")}
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t border-white/10" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-[#1C1C1C] px-2 text-muted-foreground">{t("auth.orWithEmail")}</span>
                        </div>
                    </div>

                    {/* Email Login */}
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="email"
                                placeholder={t("auth.emailPlaceholder")}
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="bg-black/20 border-white/10 h-11"
                            />
                        </div>
                        <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
                            <Mail className="h-4 w-4" />
                            {loading ? t("auth.sending") : t("auth.sendMagicLink")}
                        </Button>
                    </form>

                    {message && (
                        <div className={`p-3 rounded-md text-sm text-center ${message.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            {message.text}
                        </div>
                    )}



                </CardContent>
            </Card>
        </div>
    )
}
