/**
 * Thread API Client
 * Fetch wrappers for chat thread management endpoints
 */

import { API_BASE_URL } from "../api";

// Types
export interface Thread {
    id: string;
    user_id: string;
    task_id: string;
    title: string;
    status: "active" | "archived" | "deleted";
    created_at: string;
    updated_at: string;
    metadata: Record<string, unknown>;
}

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

// API Functions

/**
 * List threads for a specific task
 */
export async function listThreads(
    taskId: string,
    token: string
): Promise<Thread[]> {
    const response = await fetch(
        `${API_BASE_URL}/api/threads?task_id=${encodeURIComponent(taskId)}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to list threads: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Create a new thread
 */
export async function createThread(
    taskId: string,
    token: string
): Promise<Thread> {
    const response = await fetch(`${API_BASE_URL}/api/threads`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ task_id: taskId }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to create thread: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Update thread title
 */
export async function updateThread(
    threadId: string,
    title: string,
    token: string
): Promise<Thread> {
    const response = await fetch(`${API_BASE_URL}/api/threads/${threadId}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to update thread: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Soft delete a thread
 */
export async function deleteThread(
    threadId: string,
    token: string
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/threads/${threadId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to delete thread: ${response.statusText}`);
    }
}

/**
 * Get thread message history
 */
export async function getThreadMessages(
    threadId: string,
    token: string
): Promise<Message[]> {
    const response = await fetch(
        `${API_BASE_URL}/api/threads/${threadId}/messages`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `Failed to get messages: ${response.statusText}`);
    }

    return response.json();
}
