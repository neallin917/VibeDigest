
import { createClient } from "@/lib/supabase-server";
import { redirect } from "next/navigation";

type Props = {
    params: Promise<{
        id: string;
    }>
}

async function getTask(id: string) {
    const supabase = await createClient()
    const { data: task } = await supabase
        .from('tasks')
        .select('video_title')
        .eq('id', id)
        .single()
    return task
}

function generateSlug(title: string): string {
    if (!title) return "video";
    return encodeURIComponent(title.trim().replace(/\s+/g, '-'));
}

export default async function TaskRedirectPage(props: Props) {
    const params = await props.params;
    const { id } = params;
    const task = await getTask(id);

    if (!task) {
        return <div className="p-10 text-center">Task not found</div>
    }

    const slug = generateSlug(task.video_title || "video");
    redirect(`/tasks/${id}/${slug}`);
}
