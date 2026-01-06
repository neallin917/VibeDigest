import { MetadataRoute } from 'next'
import { supabasePublic } from '@/lib/supabase-public'

const locales = ["en", "zh", "es", "ar", "fr", "ru", "pt", "hi", "ja", "ko"];
const defaultLocale = "en";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vibedigest.neallin.xyz'
  const supabase = supabasePublic

  // Static routes
  const staticPaths = [
    '',
    '/pricing',
    '/login',
    '/privacy',
    '/terms',
    '/explore',
    '/about',
    '/faq',
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

  const sitemapEntries: MetadataRoute.Sitemap = []

  // Generate static entries for each locale
  for (const path of staticPaths) {
    for (const locale of locales) {
      const url = `${baseUrl}/${locale}${path}`
      const alternates = {
        languages: locales.reduce((acc, l) => {
          acc[l] = `${baseUrl}/${l}${path}`
          return acc
        }, {} as Record<string, string>)
      }

      sitemapEntries.push({
        url,
        lastModified: new Date(),
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1.0 : 0.8,
        alternates
      })
    }
  }

  // Generate dynamic entries for each task and each locale
  if (tasks) {
    for (const task of tasks) {
      const slug = generateSlug(task.video_title)
      for (const locale of locales) {
        const path = `/tasks/${task.id}/${slug}`
        const url = `${baseUrl}/${locale}${path}`
        const alternates = {
          languages: locales.reduce((acc, l) => {
            acc[l] = `${baseUrl}/${l}${path}`
            return acc
          }, {} as Record<string, string>)
        }

        sitemapEntries.push({
          url,
          lastModified: new Date(task.created_at),
          changeFrequency: 'monthly',
          priority: 0.6,
          alternates
        })
      }
    }
  }

  return sitemapEntries
}
