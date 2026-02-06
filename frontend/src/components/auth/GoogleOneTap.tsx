"use client"

import { useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { toast } from "sonner"

declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: {
                        client_id: string
                        callback: (response: { credential: string }) => void
                        auto_select?: boolean
                        cancel_on_tap_outside?: boolean
                        context?: string
                        itp_support?: boolean
                    }) => void
                    prompt: (callback?: (notification: {
                        isNotDisplayed: () => boolean
                        isSkippedMoment: () => boolean
                        isDismissedMoment: () => boolean
                        getNotDisplayedReason: () => string
                        getSkippedReason: () => string
                        getDismissedReason: () => string
                    }) => void) => void
                    cancel: () => void
                    disableAutoSelect: () => void
                    revoke: (email: string, callback?: () => void) => void
                }
            }
        }
    }
}

export function GoogleOneTap() {
    const supabase = useMemo(() => createClient(), [])
    const initializedRef = useRef(false)

    useEffect(() => {
        // Prevent double initialization in React Strict Mode
        if (initializedRef.current) return
        initializedRef.current = true

        const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
        if (!clientId) {
            console.warn("Google One Tap: Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID")
            return
        }

        // Check if user is already logged in
        const checkAuthAndInitialize = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Already logged in, don't show One Tap
                return
            }

            // Load Google Identity Services script
            const script = document.createElement("script")
            script.src = "https://accounts.google.com/gsi/client"
            script.async = true
            script.defer = true
            script.onload = () => {
                if (!window.google) return

                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleCredentialResponse,
                    auto_select: true,
                    cancel_on_tap_outside: true,
                    context: "signin",
                    itp_support: true,
                })

                // Show the One Tap prompt
                window.google.accounts.id.prompt((notification) => {
                    if (notification.isNotDisplayed()) {
                        console.log("One Tap not displayed:", notification.getNotDisplayedReason())
                    }
                    if (notification.isSkippedMoment()) {
                        console.log("One Tap skipped:", notification.getSkippedReason())
                    }
                })
            }

            document.body.appendChild(script)

            return () => {
                // Cleanup
                if (window.google) {
                    window.google.accounts.id.cancel()
                }
                script.remove()
            }
        }

        const handleCredentialResponse = async (response: { credential: string }) => {
            try {
                const { data, error } = await supabase.auth.signInWithIdToken({
                    provider: "google",
                    token: response.credential,
                })

                if (error) {
                    console.error("One Tap sign-in error:", error.message)
                    toast.error("Sign in failed. Please try again.")
                    return
                }

                if (data.session) {
                    // Successfully signed in - auth state listener will update the UI
                    console.log("One Tap sign-in successful")
                    toast.success("Signed in successfully!")
                }
            } catch (err) {
                console.error("One Tap error:", err)
                toast.error("An unexpected error occurred.")
            }
        }

        checkAuthAndInitialize()
    }, [supabase])

    // This component doesn't render anything visually
    return null
}
