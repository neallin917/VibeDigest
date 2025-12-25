"use client"

import { useState, useCallback, useEffect } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"

export type NotificationPermissionStatus = "default" | "granted" | "denied" | "unsupported"

export function useTaskNotification() {
    const { t } = useI18n()
    const [permission, setPermission] = useState<NotificationPermissionStatus>("default")
    // activeTaskIds is a Set of task IDs that the user wants to be notified about
    const [subbedTaskIds, setSubbedTaskIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            setPermission("unsupported")
            return
        }
        // Map Notification.permission to our status type
        setPermission(window.Notification.permission as NotificationPermissionStatus)
    }, [])

    const requestPermission = useCallback(async () => {
        if (!("Notification" in window)) return "unsupported"

        try {
            const result = await window.Notification.requestPermission()
            setPermission(result as NotificationPermissionStatus)
            return result
        } catch (error) {
            console.error("Failed to request notification permission:", error)
            return "denied"
        }
    }, [])

    const subscribeToTask = useCallback(async (taskId: string) => {
        // optimistically add to set
        setSubbedTaskIds(prev => {
            const next = new Set(prev)
            next.add(taskId)
            return next
        })

        if (permission === "default") {
            const newPermission = await requestPermission()
            if (newPermission !== "granted") {
                // If denied/closed, remove the subscription
                setSubbedTaskIds(prev => {
                    const next = new Set(prev)
                    next.delete(taskId)
                    return next
                })
                return false
            }
        } else if (permission !== "granted") {
            return false
        }

        return true
    }, [permission, requestPermission])

    const sendTaskNotification = useCallback((taskId: string, title: string) => {
        if (permission !== "granted") return

        // Check if we are subscribed to this task
        if (!subbedTaskIds.has(taskId)) return

        try {
            const n = new Notification(t("tasks.notificationTitle"), {
                body: t("tasks.notificationBody", { title }),
                icon: "/favicon.ico", // Using default favicon or a specific icon if available
                tag: `task-${taskId}`, // Prevent duplicate notifications
            })

            n.onclick = () => {
                window.focus()
                n.close()
            }

            // Unsubscribe after notifying
            setSubbedTaskIds(prev => {
                const next = new Set(prev)
                next.delete(taskId)
                return next
            })
        } catch (err) {
            console.error("Notification error:", err)
        }
    }, [permission, subbedTaskIds, t])

    return {
        permission,
        requestPermission,
        subscribeToTask,
        isSubscribed: (taskId: string) => subbedTaskIds.has(taskId),
        sendTaskNotification
    }
}
