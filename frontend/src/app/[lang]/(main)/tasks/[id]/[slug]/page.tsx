
import { createClient } from "@/lib/supabase-server"
import type { Metadata, ResolvingMetadata } from "next"
import { redirect } from "next/navigation"
import { buildAlternateLanguages, buildLocalizedPath } from "@/lib/seo"

type Props = {
    params: Promise<{
        lang: string
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

    // Fetch task
    const { data: task } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id)
        .single()

    // Fetch outputs if task exists
    let outputs: any[] = []
    if (task) {
        const { data } = await supabase
            .from('task_outputs')
            .select('*')
            .eq('task_id', id)
            .order('created_at', { ascending: true }) // Ensure older outputs come first (or logic)
        outputs = data || []
    }

    return { task, outputs }
}

export async function generateMetadata(
    props: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const params = await props.params;
    const { id, lang, slug } = params
    const { task } = await getTaskAndOutputs(id)

    if (!task) {
        return {
            title: "Task Not Found",
        }
    }

    const previousImages = (await parent).openGraph?.images || []

    // Construct canonical and alternates
    // We assume the current slug is correct (validity checked in Page component, but for metadata we should use the "correct" one ideally)
    const currentSlug = generateSlug(task.video_title);

    const path = `/tasks/${id}/${currentSlug}`
    const shouldIndex = task.is_demo === true && task.status === "completed"

    return {
        title: task.video_title || "Processed Video",
        description: `View the AI-generated summary and transcript for "${task.video_title || 'this video'}".`,
        openGraph: {
            title: task.video_title,
            description: `AI-powered summary and insights for ${task.video_title}`,
            images: task.thumbnail_url ? [task.thumbnail_url, ...previousImages] : previousImages,
            url: buildLocalizedPath(lang, path),
        },
        alternates: {
            canonical: buildLocalizedPath(lang, path),
            languages: buildAlternateLanguages(path),
        },
        robots: shouldIndex
            ? { index: true, follow: true }
            : { index: false, follow: false },
    }
}

export default async function TaskDetailPage(props: Props) {
    const params = await props.params;
    const { id, lang, slug } = params
    const { task } = await getTaskAndOutputs(id)

    if (!task) {
        return <div className="p-10 text-center">Task not found</div>
    }

    // SLUG ENFORCEMENT
    const correctSlug = generateSlug(task.video_title);
    if (slug !== correctSlug) {
        redirect(`/tasks/${id}/${correctSlug}`);
    }

    // REDIRECT TO NEW CHAT UI
    redirect(`/chat?task=${id}`)
}
