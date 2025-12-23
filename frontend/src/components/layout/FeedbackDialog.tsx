"use client"

import { useState } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"
import { ApiClient } from "@/lib/api"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { MessageSquare, Loader2 } from "lucide-react"

export function FeedbackDialog() {
    const { t } = useI18n()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [category, setCategory] = useState("bug")
    const [message, setMessage] = useState("")
    const [contactEmail, setContactEmail] = useState("")

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const supabase = createClient()
            const { data: { session } } = await supabase.auth.getSession()

            if (!session?.access_token) {
                // Should not happen in sidebar if not logged in, but just in case
                console.error("No session found")
                return
            }

            await ApiClient.submitFeedback(
                {
                    category,
                    message,
                    contact_email: contactEmail || undefined,
                },
                session.access_token
            )

            // Reset form
            setMessage("")
            setCategory("bug")
            setContactEmail("")
            setOpen(false)

            // Optional: Toast success message
            // toast.success(t("feedback.success"))
            alert(t("feedback.success"))

        } catch (error) {
            console.error(error)
            alert(t("feedback.error"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
                >
                    <MessageSquare className="h-4 w-4" />
                    {t("feedback.title")}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card text-card-foreground border-white/10">
                <DialogHeader>
                    <DialogTitle>{t("feedback.title")}</DialogTitle>
                    <DialogDescription>
                        {t("feedback.subtitle")}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="category">{t("feedback.category")}</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger id="category" className="bg-muted border-white/5">
                                <SelectValue placeholder={t("feedback.category")} />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-white/10">
                                <SelectItem value="bug">{t("feedback.types.bug")}</SelectItem>
                                <SelectItem value="feature">{t("feedback.types.feature")}</SelectItem>
                                <SelectItem value="complaint">{t("feedback.types.complaint")}</SelectItem>
                                <SelectItem value="other">{t("feedback.types.other")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="message">{t("feedback.message")}</Label>
                        <Textarea
                            id="message"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder={t("feedback.message")}
                            className="bg-muted border-white/5 min-h-[100px]"
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="email">{t("feedback.contactEmail")}</Label>
                        <Input
                            id="email"
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="bg-muted border-white/5"
                        />
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t("feedback.submit")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
