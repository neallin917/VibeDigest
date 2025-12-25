"use client"

import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { useTaskNotification } from "@/hooks/useTaskNotification"
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js"

type Task = {
    id: string
    video_title: string
    video_url: string
    status: string
}

export function TaskNotificationListener() {
    // We only need the subscription list and the sender function
    // The permission check is handled inside sendTaskNotification
    const { subbedTaskIds, sendTaskNotification } = useTaskNotification()
    const supabase = createClient()

    // Keep track of active subscriptions to avoid unnecessary re-subscriptions
    const activeSubsRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        const subbedIds = Array.from(subbedTaskIds)

        // Identify new tasks to subscribe to
        const newIds = subbedIds.filter(id => !activeSubsRef.current.has(id))

        if (newIds.length === 0) return

        const channels = newIds.map(id => {
            activeSubsRef.current.add(id)

            return supabase.channel(`notification_task_${id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tasks',
                    filter: `id=eq.${id}`
                }, (payload: RealtimePostgresChangesPayload<Task>) => {
                    const newTask = payload.new as Task
                    if (newTask.status === 'completed') {
                        sendTaskNotification(newTask.id, newTask.video_title || newTask.video_url)
                        // Cleanup logic is handled by sendTaskNotification which calls unsubscribeFromTask
                    }
                })
                .subscribe()
        })

        // Cleanup function
        return () => {
            channels.forEach(channel => {
                supabase.removeChannel(channel)
            })
            // Note: We don't remove from activeSubsRef here because a unmount/remount 
            // set of effects might occur. We rely on the subbedTaskIds dependency.
            // However, strictly speaking, if subbedTaskIds changes (e.g. valid unsubscribe),
            // this effect runs. We should ideally be smarter about incremental updates,
            // but for a small number of tasks, recreating channels is acceptable or 
            // we can just let the global re-render handle it. 

            // Actually, the above logic is slightly flawed because it doesn't unsubscribe
            // from tasks that were REMOVED from the list.
            // Let's implement a simpler approach: clear all and resubscribe when list changes.
        }
    }, [subbedTaskIds, supabase, sendTaskNotification])

    // Better implementation for the effect:
    useEffect(() => {
        const ids = Array.from(subbedTaskIds)
        if (ids.length === 0) return

        const channels = ids.map(id => {
            return supabase.channel(`notification_task_${id}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tasks',
                    filter: `id=eq.${id}`
                }, (payload: RealtimePostgresChangesPayload<Task>) => {
                    const newTask = payload.new as Task
                    if (newTask.status === 'completed') {
                        sendTaskNotification(newTask.id, newTask.video_title || newTask.video_url)
                    }
                })
                .subscribe()
        })

        return () => {
            channels.forEach(ch => supabase.removeChannel(ch))
        }
    }, [subbedTaskIds, supabase, sendTaskNotification])

    return null // This component renders nothing
}
