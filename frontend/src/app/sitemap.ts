import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase-server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://vibedigest.neallin.xyz'
  const supabase = await createClient()

  // Static routes
  const routes = [
    '',
    '/pricing',
    '/login',
    '/privacy',
    '/terms',
    '/explore',
  ]

  // Dynamic routes from Tasks indicating public content (demos)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, created_at, video_title')
    .eq('status', 'completed')
    .eq('is_demo', true)
    .order('created_at', { ascending: false })
    .limit(1000)

  const generateSlug = (title: string | null): string => {
    if (!title) return "video"
    return encodeURIComponent(title.trim().replace(/\s+/g, '-'))
  }

  const dynamicRoutes = (tasks || []).map((task) => {
    const slug = generateSlug(task.video_title)
    return {
      url: `${baseUrl}/en/tasks/${task.id}/${slug}`,
      lastModified: new Date(task.created_at),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    }
  })

  const staticEntries = routes.map((route) => ({
    url: `${baseUrl}/en${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  return [...staticEntries, ...dynamicRoutes]
}
