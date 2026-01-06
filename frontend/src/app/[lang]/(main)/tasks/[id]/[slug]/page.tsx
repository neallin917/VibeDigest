
import { createClient } from "@/lib/supabase-server"
import TaskDetailClient from "./TaskDetailClient"
import type { Metadata, ResolvingMetadata } from "next"
import { redirect } from "next/navigation"

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

    return {
        title: task.video_title || "Processed Video",
        description: `View the AI-generated summary and transcript for "${task.video_title || 'this video'}".`,
        openGraph: {
            title: task.video_title,
            description: `AI-powered summary and insights for ${task.video_title}`,
            images: task.thumbnail_url ? [task.thumbnail_url, ...previousImages] : previousImages,
            url: `/${lang}/tasks/${id}/${currentSlug}`,
        },
        alternates: {
            canonical: `/${lang}/tasks/${id}/${currentSlug}`,
            languages: {
                'en': `/en/tasks/${id}/${currentSlug}`,
                'zh': `/zh/tasks/${id}/${currentSlug}`, // Add more as needed
            }
        }
    }
}

export default async function TaskDetailPage(props: Props) {
    const params = await props.params;
    const { id, lang, slug } = params
    const { task, outputs } = await getTaskAndOutputs(id)

    if (!task) {
        return <div className="p-10 text-center">Task not found</div>
    }

    // SLUG ENFORCEMENT
    const correctSlug = generateSlug(task.video_title);
    if (slug !== correctSlug) {
        redirect(`/${lang}/tasks/${id}/${correctSlug}`);
    }

    // JSON-LD
    const videoObject = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": task.video_title,
        "description": `AI summary for ${task.video_title}`,
        "thumbnailUrl": [task.thumbnail_url || ""],
        "uploadDate": task.created_at,
        "contentUrl": task.video_url,
        "duration": task.duration ? `PT${Math.floor(task.duration)}S` : undefined
    }

    const breadcrumbList = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": `https://vibedigest.neallin.xyz/${lang}`
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": task.video_title,
                "item": `https://vibedigest.neallin.xyz/${lang}/tasks/${id}/${correctSlug}`
            }
        ]
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify([videoObject, breadcrumbList]) }}
            />
            <TaskDetailClient
                id={id}
                initialTask={task}
                initialOutputs={outputs}
            />
        </>
    )
}
