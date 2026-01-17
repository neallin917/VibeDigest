"use client"

import { LoginForm } from "@/components/auth/LoginForm"

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-transparent text-slate-800 dark:text-[#EDEDED] p-4 relative overflow-hidden">
            {/* Background Blobs (Light Mode) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none dark:hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/60 rounded-full blur-[120px]" />
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/60 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-emerald-200/60 rounded-full blur-[120px]" />
            </div>

            {/* Background Gradients (Dark Mode) */}
            <div className="fixed inset-0 z-0 pointer-events-none hidden dark:block">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/15 rounded-full blur-[120px]" />
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/15 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-emerald-500/15 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <LoginForm />
            </div>
        </div>
    )
}
