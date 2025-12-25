"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Mail, Sparkles } from "lucide-react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { LanguageInlineSelect } from "@/components/i18n/LanguageInlineSelect"

interface LoginFormProps {
    className?: string
    isModal?: boolean
}

export function LoginForm({ className, isModal = false }: LoginFormProps) {
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
        <Card className={`w-full max-w-md border-white/10 relative overflow-hidden transition-all duration-300 ${className} ${isModal ? 'bg-transparent shadow-none border-0' : 'glass'}`}>
            {!isModal && (
                <div className="absolute top-4 right-4 z-10">
                    <LanguageInlineSelect />
                </div>
            )}

            <CardHeader className="text-center space-y-2 relative z-10">
                <div className="mx-auto bg-primary/20 p-3 rounded-full w-fit mb-2 shadow-[0_0_20px_rgba(62,207,142,0.2)]">
                    <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60">
                    {t("auth.welcomeBack")}
                </CardTitle>
                <CardDescription className="text-muted-foreground/80">
                    {t("auth.signInToContinue", { appName: t("brand.name") })}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative z-10">
                {/* Google Login */}
                <Button
                    variant="outline"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full h-11 bg-white hover:bg-white/90 text-black hover:text-black border-0 font-medium transition-transform hover:scale-[1.02] duration-200"
                >
                    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    {t("auth.signInWithGoogle")}
                </Button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-transparent px-2 text-muted-foreground backdrop-blur-sm rounded-full">{t("auth.orWithEmail")}</span>
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
                            className="bg-black/20 border-white/10 h-11 focus:border-primary/50 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/50"
                        />
                    </div>
                    <Button type="submit" className="w-full h-11 gap-2 bg-primary text-black hover:bg-primary/90 shadow-[0_0_15px_rgba(62,207,142,0.3)] hover:shadow-[0_0_20px_rgba(62,207,142,0.5)] transition-all duration-300" disabled={loading}>
                        <Mail className="h-4 w-4" />
                        {loading ? t("auth.sending") : t("auth.sendMagicLink")}
                    </Button>
                </form>

                {message && (
                    <div className={`p-3 rounded-lg text-sm text-center animate-in fade-in slide-in-from-top-2 duration-300 ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                        {message.text}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
