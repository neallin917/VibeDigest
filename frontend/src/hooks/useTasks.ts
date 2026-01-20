"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Task } from "@/types"

export function useTasks(shouldFetch: boolean = true) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const supabase = useMemo(() => createClient(), [])

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setTasks([])
                return
            }

            const { data, error: fetchError } = await supabase
                .from('tasks')
                .select('id, video_url, video_title, thumbnail_url, status, created_at')
                .eq('user_id', user.id)
                .eq('is_deleted', false)
                .order('created_at', { ascending: false })
                .limit(30)

            if (fetchError) throw fetchError
            setTasks(data || [])
        } catch (err) {
            console.error('Error fetching tasks:', err)
            setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
        } finally {
            setLoading(false)
        }
    }, [supabase])

    const deleteTask = useCallback(async (taskId: string) => {
        // Optimistic update
        setTasks(prev => prev.filter(t => t.id !== taskId))

        try {
            const { error } = await supabase
                .from('tasks')
                .update({ is_deleted: true })
                .eq('id', taskId)

            if (error) {
                // Revert on error
                throw error
            }
        } catch (err) {
            console.error('Error deleting task:', err)
            // Ideally we should re-fetch or revert the state here
            fetchTasks()
        }
    }, [supabase, fetchTasks])

    useEffect(() => {
        if (shouldFetch) {
            fetchTasks()
        }
    }, [shouldFetch, fetchTasks])

    return {
        tasks,
        loading,
        error,
        refreshTasks: fetchTasks,
        deleteTask
    }
}
