"use client"

import { useState, useEffect } from "react"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, History, PlusCircle, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const sidebarItems = [
    {
        title: "New Task",
        href: "/dashboard",
        icon: PlusCircle,
    },
    {
        title: "History",
        href: "/history",
        icon: History,
    },
    {
        title: "Settings",
        href: "/settings",
        icon: Settings,
    },
]

export function Sidebar() {
    const pathname = usePathname()
    const [userEmail, setUserEmail] = useState<string | null>(null)
    const supabase = createClient()

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            setUserEmail(user?.email || null)
        })
    }, [])

    return (
        <div className="flex h-screen w-64 flex-col border-r bg-card">
            <div className="p-6">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-primary text-2xl">⚡</span> Transcriber
                </h1>
            </div>

            <div className="flex-1 px-4 py-2 space-y-1">
                {sidebarItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                            pathname === item.href
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <item.icon className="h-4 w-4" />
                        {item.title}
                    </Link>
                ))}
            </div>

            <div className="p-4 border-t border-white/5 space-y-4">
                {userEmail && (
                    <div className="px-1 py-2 mb-2 text-xs text-muted-foreground truncate border-b border-white/5">
                        {userEmail}
                    </div>
                )}
                <Button
                    variant="ghost"
                    onClick={async () => {
                        await supabase.auth.signOut()
                        window.location.href = '/login'
                    }}
                    className="w-full justify-start gap-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                >
                    <LogOut className="h-4 w-4" />
                    Logout
                </Button>
            </div>
        </div>
    )
}
