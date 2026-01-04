import { createClient } from "@/lib/supabase/server"
import { CommunityTemplates, Task, TaskOutput } from "./CommunityTemplates"

export async function ServerCommunityTemplates({ limit = 8, showHeader = true }: { limit?: number, showHeader?: boolean }) {
    const supabase = await createClient()

    // Artificial delay for testing (Uncomment to test Skeleton)
    // await new Promise(resolve => setTimeout(resolve, 3000))

    const { data } = await supabase
        .from('tasks')
        .select(`
      *,
      task_outputs (
        id,
        task_id,
        output_type,
        title,
        summary,
        created_at
      )
    `)
        .eq('is_demo', true)
        .order('created_at', { ascending: false })
        .limit(limit)

    // Transform data to match Task interface
    // We need to type cast the join result because Supabase types are generic
    const initialTasks = (data || []).map(task => ({
        ...task,
        task_outputs: task.task_outputs as any as TaskOutput[]
    })) as any as Task[]

    return <CommunityTemplates limit={limit} showHeader={showHeader} initialTasks={initialTasks} />
}
