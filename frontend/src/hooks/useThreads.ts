/**
 * TanStack Query hooks for thread management
 * Provides caching, optimistic updates, and automatic refetching
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import {
    listThreads,
    createThread,
    updateThread,
    deleteThread,
    type Thread,
} from "@/lib/api/threads";

// Query key factory
export const threadKeys = {
    all: ["threads"] as const,
    lists: () => [...threadKeys.all, "list"] as const,
    list: (taskId: string) => [...threadKeys.lists(), taskId] as const,
    details: () => [...threadKeys.all, "detail"] as const,
    detail: (id: string) => [...threadKeys.details(), id] as const,
};

/**
 * Hook to get auth token
 */
async function getToken(): Promise<string> {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error("User not authenticated");
    }
    return session.access_token;
}

/**
 * Hook to list threads for a task
 */
export function useThreads(taskId: string) {
    return useQuery({
        queryKey: threadKeys.list(taskId),
        queryFn: async () => {
            const token = await getToken();
            return listThreads(taskId, token);
        },
        enabled: !!taskId,
        staleTime: 30000, // 30 seconds
    });
}

/**
 * Hook to create a new thread
 */
export function useCreateThread(taskId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const token = await getToken();
            return createThread(taskId, token);
        },
        onSuccess: () => {
            // Invalidate and refetch thread list
            queryClient.invalidateQueries({ queryKey: threadKeys.list(taskId) });
        },
    });
}

/**
 * Hook to update thread title
 */
export function useUpdateThread() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ threadId, title }: { threadId: string; title: string }) => {
            const token = await getToken();
            return updateThread(threadId, title, token);
        },
        onSuccess: (data) => {
            // Update cache directly
            queryClient.setQueryData(threadKeys.detail(data.id), data);
            // Invalidate list to refresh
            queryClient.invalidateQueries({ queryKey: threadKeys.lists() });
        },
    });
}

/**
 * Hook to delete a thread with optimistic update
 */
export function useDeleteThread(taskId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (threadId: string) => {
            const token = await getToken();
            return deleteThread(threadId, token);
        },
        onMutate: async (threadId) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: threadKeys.list(taskId) });

            // Snapshot previous value
            const previousThreads = queryClient.getQueryData<Thread[]>(
                threadKeys.list(taskId)
            );

            // Optimistically remove the thread
            queryClient.setQueryData<Thread[]>(threadKeys.list(taskId), (old) =>
                old?.filter((t) => t.id !== threadId) ?? []
            );

            return { previousThreads };
        },
        onError: (_err, _threadId, context) => {
            // Rollback on error
            if (context?.previousThreads) {
                queryClient.setQueryData(
                    threadKeys.list(taskId),
                    context.previousThreads
                );
            }
        },
        onSettled: () => {
            // Always refetch after error or success
            queryClient.invalidateQueries({ queryKey: threadKeys.list(taskId) });
        },
    });
}
