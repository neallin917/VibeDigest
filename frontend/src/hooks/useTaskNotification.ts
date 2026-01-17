"use client"

import { useState, useCallback, useEffect } from "react"
import { useI18n } from "@/components/i18n/I18nProvider"

export type NotificationPermissionStatus = "default" | "granted" | "denied" | "unsupported"

const STORAGE_KEY = "antigravity_task_subscriptions"
const EVENT_KEY = "antigravity_task_subscriptions_updated"

export function useTaskNotification() {
    const { t } = useI18n()
    const [permission, setPermission] = useState<NotificationPermissionStatus>("default")
    // activeTaskIds is a Set of task IDs that the user wants to be notified about
    const [subbedTaskIds, setSubbedTaskIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        // Handle initial permission state
        if (typeof window !== "undefined" && "Notification" in window) {
            setPermission(window.Notification.permission as NotificationPermissionStatus)
        } else {
            setPermission("unsupported")
            return
        }

        // Load from localStorage
        const loadFromStorage = () => {
            try {
                const stored = localStorage.getItem(STORAGE_KEY)
                if (stored) {
                    setSubbedTaskIds(new Set(JSON.parse(stored)))
                } else {
                    setSubbedTaskIds(new Set())
                }
            } catch (e) {
                console.error("Failed to load task subscriptions", e)
            }
        }

        loadFromStorage()

        // Listen for storage changes (cross-tab)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) {
                loadFromStorage()
            }
        }

        // Listen for local changes (same-tab)
        const handleLocalChange = () => {
            loadFromStorage()
        }

        window.addEventListener("storage", handleStorageChange)
        window.addEventListener(EVENT_KEY, handleLocalChange)

        return () => {
            window.removeEventListener("storage", handleStorageChange)
            window.removeEventListener(EVENT_KEY, handleLocalChange)
        }
    }, [])

    const updateSubscriptions = (newSet: Set<string>) => {
        // Optimistically update local state first to prevent flicker
        setSubbedTaskIds(newSet)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(newSet)))
            // Dispatch custom event for other components in the same window (e.g. global listener)
            window.dispatchEvent(new Event(EVENT_KEY))
        } catch (e) {
            console.error("Failed to save task subscriptions", e)
        }
    }

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
        const next = new Set(subbedTaskIds)
        next.add(taskId)
        updateSubscriptions(next)

        if (permission === "default") {
            const newPermission = await requestPermission()
            if (newPermission !== "granted") {
                // If denied/closed, remove the subscription
                const reverted = new Set(subbedTaskIds)
                reverted.delete(taskId)
                updateSubscriptions(reverted)
                return false
            }
        } else if (permission !== "granted") {
            return false
        }

        return true
    }, [permission, requestPermission, subbedTaskIds])

    const unsubscribeFromTask = useCallback((taskId: string) => {
        const next = new Set(subbedTaskIds)
        next.delete(taskId)
        updateSubscriptions(next)
    }, [subbedTaskIds])

    const sendTaskNotification = useCallback((taskId: string, title: string) => {
        if (permission !== "granted") return

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
            unsubscribeFromTask(taskId)
        } catch (err) {
            console.error("Notification error:", err)
        }
    }, [permission, t, unsubscribeFromTask])

    return {
        permission,
        requestPermission,
        subscribeToTask,
        unsubscribeFromTask,
        isSubscribed: (taskId: string) => subbedTaskIds.has(taskId),
        sendTaskNotification,
        subbedTaskIds // Exporting for the listener
    }
}
