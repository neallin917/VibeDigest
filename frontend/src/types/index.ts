export interface Task {
    id: string
    video_url: string
    video_title?: string
    thumbnail_url?: string
    status: string
    created_at: string
}

export interface Thread {
    id: string
    title: string
    updated_at: string
}
