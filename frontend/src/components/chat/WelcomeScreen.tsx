'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Sparkles, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n/I18nProvider'
import { createClient } from '@/lib/supabase'
import { QuickTemplateCard } from './QuickTemplateCard'
import { ChatInput } from './ChatInput'
import { PAGINATION_CONFIG } from '@/lib/constants'

interface Task {
  id: string
  video_url: string
  video_title?: string
  thumbnail_url?: string
}

interface WelcomeScreenProps {
  onSelectExample: (taskId: string) => void
  /** Handler for input submission */
  onSubmit: (text: string) => void
  /** Loading state for input */
  isLoading?: boolean
}

export function WelcomeScreen({ onSelectExample, onSubmit, isLoading }: WelcomeScreenProps) {
  const { t } = useI18n()
  const [examples, setExamples] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchExamples = useCallback(async (offset = 0, append = false) => {
    if (offset === 0) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    const limit = offset === 0 ? PAGINATION_CONFIG.initialCount : PAGINATION_CONFIG.loadMoreCount

    const { data, count } = await supabase
      .from('tasks')
      .select('id, video_url, video_title, thumbnail_url', { count: 'exact' })
      .eq('is_demo', true)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (data) {
      if (append) {
        setExamples(prev => [...prev, ...data])
      } else {
        setExamples(data)
      }
      // Check if there are more items to load
      const totalLoaded = append ? examples.length + data.length : data.length
      setHasMore(count !== null && totalLoaded < count)
    }
    
    setLoading(false)
    setLoadingMore(false)
  }, [supabase, examples.length])

  useEffect(() => {
    fetchExamples(0, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchExamples(examples.length, true)
    }
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-full px-6 py-8 md:py-12">
      {/* Hero Section */}
      <div className="text-center max-w-lg mb-8">
        {/* Brand Icon */}
        <div className={cn(
          "mx-auto mb-6 h-16 w-16 rounded-2xl flex items-center justify-center shadow-lg",
          "bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-emerald-500 dark:to-teal-600"
        )}>
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        {/* Title */}
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white mb-3">
          {t('chat.welcome.title')}
        </h1>

        {/* Subtitle */}
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 leading-relaxed">
          {t('chat.welcome.subtitle')}
        </p>
      </div>

      {/* Inline Chat Input - Centered, part of the content flow */}
      <div className="w-full max-w-2xl mb-10">
        <ChatInput 
          variant="inline"
          onSubmit={onSubmit}
          isLoading={isLoading}
          showTypewriter={true}
          hideDisclaimer={true}
        />
      </div>

      {/* Examples Section */}
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading examples...</span>
        </div>
      ) : examples.length > 0 ? (
        <div className="w-full max-w-4xl">
          {/* Section Header */}
          <div className="flex items-center gap-2 mb-4 px-1">
            <span className={cn(
              "text-xs font-medium uppercase tracking-wider",
              "text-slate-400 dark:text-slate-500"
            )}>
              {t('chat.welcome.tryExamples')}
            </span>
            <div className="flex-1 h-px bg-slate-200/60 dark:bg-white/10" />
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {examples.map((task) => (
              <QuickTemplateCard
                key={task.id}
                task={task}
                onSelect={onSelectExample}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  "bg-white/60 hover:bg-white/80 text-slate-600 border border-white/60 shadow-sm",
                  "dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 dark:border-white/10",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('chat.loadingMore') || 'Loading...'}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    <span>{t('chat.loadMore') || 'Load More'}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
