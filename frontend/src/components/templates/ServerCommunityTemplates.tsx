import { createClient } from "@/lib/supabase/server"
import { CommunityTemplates, Task } from "./CommunityTemplates"

export async function ServerCommunityTemplates({ limit = 8, showHeader = true }: { limit?: number, showHeader?: boolean }) {
  const supabase = await createClient()

  // Artificial delay for testing (Uncomment to test Skeleton)
  // await new Promise(resolve => setTimeout(resolve, 3000))

  const { data } = await supabase
    .from('tasks')
    .select(`
      id,
      video_url,
      video_title,
      thumbnail_url,
      status,
      created_at,
      author,
      author_image_url
    `)
    .eq('is_demo', true)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(limit)

  // Transform data to match Task interface
  // We need to type cast the join result because Supabase types are generic
  const initialTasks = (data || []) as any as Task[]

  return <CommunityTemplates limit={limit} showHeader={showHeader} initialTasks={initialTasks} />
}
