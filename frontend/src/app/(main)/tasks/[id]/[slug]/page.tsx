
import { createClient } from "@/lib/supabase-server"
import type { Metadata, ResolvingMetadata } from "next"
import { redirect } from "next/navigation"

type Props = {
    params: Promise<{
        id: string
        slug: string
    }>
}

function generateSlug(title: string): string {
    if (!title) return "video";
    return encodeURIComponent(title.trim().replace(/\s+/g, '-'));
}

async function getTaskAndOutputs(id: string) {
    const supabase = await createClient()

    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()

    let outputs: { id: string; kind: string; content: string; status: string }[] = []
    if (task) {
        const { data } = await supabase
            .from('task_outputs')
            .select('*')
            .eq('task_id', id)
            .order('created_at', { ascending: true })
        outputs = data || []
    }

    return { task, outputs }
}

export async function generateMetadata(
    props: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const params = await props.params;
    const { id } = params
    const { task } = await getTaskAndOutputs(id)

    if (!task) {
        return {
            title: "Task Not Found",
        }
    }

    const previousImages = (await parent).openGraph?.images || []
    const currentSlug = generateSlug(task.video_title);

    return {
        title: task.video_title || "Processed Video",
        description: `View the AI-generated summary and transcript for "${task.video_title || 'this video'}".`,
        openGraph: {
            title: task.video_title,
            description: `AI-powered summary and insights for ${task.video_title}`,
            images: task.thumbnail_url ? [task.thumbnail_url, ...previousImages] : previousImages,
            url: `/tasks/${id}/${currentSlug}`,
        },
        alternates: {
            canonical: `/tasks/${id}/${currentSlug}`,
        }
    }
}

export default async function TaskDetailPage(props: Props) {
    const params = await props.params;
    const { id, slug } = params
    const { task } = await getTaskAndOutputs(id)

    if (!task) {
        return <div className="p-10 text-center">Task not found</div>
    }

    const correctSlug = generateSlug(task.video_title);
    if (slug !== correctSlug) {
        redirect(`/tasks/${id}/${correctSlug}`);
    }

    redirect(`/chat?task=${id}`)
}
