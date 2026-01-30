'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { VideoPlayer } from '@/components/tasks/shared/VideoPlayer'
import { supportsVideoEmbed } from '@/components/tasks/VideoEmbed'
import { Button } from '@/components/ui/button'
import { X, Lightbulb, StickyNote, PlayCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { formatSeconds } from '@/components/tasks/transcript'

interface VideoDetailPanelProps {
  taskId: string
  onClose?: () => void
  className?: string
}

interface Task {
  id: string
  video_url: string
  video_title?: string
  thumbnail_url?: string
  status: string
}

interface MediaController {
  seek: (seconds: number) => void
}

type StructuredSummaryV1 = {
  overview: string
  keypoints: Array<{
    title: string
    detail: string
    startSeconds?: number
  }>
}

export function VideoDetailPanel({
  taskId,
  onClose,
  className
}: VideoDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [summary, setSummary] = useState<StructuredSummaryV1 | null>(null)
  const [mediaController, setMediaController] = useState<MediaController | null>(null)
  const [audioData, setAudioData] = useState<{ audioUrl: string, coverUrl?: string } | null>(null)
  const supabase = createClient()

  const parseSummaryContent = (content: any): StructuredSummaryV1 | null => {
    if (!content) return null
    if (typeof content === 'object') {
      return content as StructuredSummaryV1
    }
    if (typeof content !== 'string') return null

    const trimmed = content.trim()
    if (!trimmed) return null

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed) as StructuredSummaryV1
      } catch (e) {
        console.error("Failed to parse summary JSON", e)
      }
    }

    return {
      overview: trimmed,
      keypoints: []
    }
  }

  const parseAudioContent = (content: string | null | undefined): { audioUrl: string, coverUrl?: string } | null => {
    if (!content || typeof content !== 'string') return null
    try {
      const parsed = JSON.parse(content)
      return {
        audioUrl: parsed.audioUrl,
        coverUrl: parsed.coverUrl
      }
    } catch {
      // If it's just a raw URL string
      if (content.startsWith('http')) {
        return { audioUrl: content }
      }
    }
    return null
  }

  useEffect(() => {
    if (!taskId) return
    if (!taskId) return

    // States are reset via key-based remounting in parent
    const fetchData = async () => {
      // 1. Fetch Task
      const { data: t } = await supabase.from('tasks').select('*').eq('id', taskId).single()
      if (t) setTask(t)

      // 2. Fetch Outputs (Summary & Audio)
      const { data: outputs } = await supabase
        .from('task_outputs')
        .select('*')
        .eq('task_id', taskId)
        .in('kind', ['summary', 'audio'])

      if (outputs) {
        const summaryOut = outputs.find(o => o.kind === 'summary' && o.status === 'completed')
        if (summaryOut) {
          const parsed = parseSummaryContent(summaryOut.content)
          setSummary(parsed)
        }

        const audioOut = outputs.find(o => o.kind === 'audio')
        if (audioOut) {
          const parsed = parseAudioContent(audioOut.content)
          if (parsed?.audioUrl) {
            setAudioData(parsed)
          }
        }
      }
    }
    fetchData()

    // Realtime updates
    const channel = supabase.channel(`task_ctx_${taskId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'tasks', filter: `id=eq.${taskId}`
      }, (payload) => setTask(payload.new as Task))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'task_outputs', filter: `task_id=eq.${taskId}`
      }, async (payload) => {
        if (payload.new.kind === 'summary' && payload.new.status === 'completed') {
          const parsed = parseSummaryContent(payload.new.content)
          setSummary(parsed)
        } else if (payload.new.kind === 'audio') {
          // For audio, we accept any status as long as content parses to a URL
          const parsed = parseAudioContent(payload.new.content)
          if (parsed?.audioUrl) {
            setAudioData(parsed)
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'task_outputs', filter: `task_id=eq.${taskId}`
      }, async (payload) => {
        if (payload.new.kind === 'summary' && payload.new.status === 'completed') {
          const parsed = parseSummaryContent(payload.new.content)
          setSummary(parsed)
        } else if (payload.new.kind === 'audio') {
          const parsed = parseAudioContent(payload.new.content)
          if (parsed?.audioUrl) {
            setAudioData(parsed)
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [taskId, supabase])

  // Determine media type based on task URL and available audio data
  const mediaType: 'video' | 'audio' = useMemo(() => {
    if (!task) return 'video'
    if (supportsVideoEmbed(task.video_url)) {
      return 'video'
    }
    if (audioData?.audioUrl) {
      return 'audio'
    }
    return 'video' // Default fallback
  }, [task, audioData])

  if (!task) return null

  return (
    <div className={cn("h-full flex flex-col gap-5 overflow-hidden px-2 pt-2 pb-4", className)}>

      {/* Header */}
      <div className="flex items-center justify-between px-2 shrink-0">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <span className="p-1.5 bg-white/50 dark:bg-white/10 rounded-lg shadow-sm ring-1 ring-white dark:ring-white/20 backdrop-blur-md">
            <StickyNote className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          </span>
          Context Panel
        </h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 hover:bg-white/20 dark:hover:bg-white/10">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-5 px-1 pb-4 custom-scrollbar">

        {/* Video Player Card */}
        <VideoPlayer
          mediaType={mediaType}
          videoUrl={task.video_url}
          title={task.video_title}
          coverUrl={task.thumbnail_url}
          audioUrl={audioData?.audioUrl}
          audioCoverUrl={audioData?.coverUrl}
          sourceUrl={task.video_url}
          onMediaReady={setMediaController}
        />

        {/* Summary Overview (Reordered to top) */}
        {summary?.overview && (
          <div className="rounded-2xl px-4 py-3 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-glass backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[13px] font-semibold text-emerald-500 dark:text-emerald-300 tracking-wide">
                Summary
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent dark:from-emerald-500/30" />
            </div>
            <p className="text-[13px] text-slate-700 dark:text-slate-200 leading-7 text-balance">
              {summary.overview}
            </p>
          </div>
        )}

        {/* Divider for Key Insights */}
        <div className="flex items-center gap-3 px-2">
          <span data-testid="header-key-insights" className="text-[13px] font-semibold text-emerald-500 dark:text-emerald-300 uppercase tracking-wide">
            Key Insights
          </span>
          {summary?.keypoints?.length ? (
            <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
              {summary.keypoints.length}
            </span>
          ) : null}
          <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent dark:from-emerald-500/30" />
        </div>

        {/* Loading State */}
        {!summary && task.status === 'processing' && (
          <div className="rounded-2xl px-4 py-6 text-center border border-white/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-glass backdrop-blur-xl">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 dark:border-emerald-400 mb-2"></div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Analyzing video...</p>
          </div>
        )}

        {/* Empty State */}
        {!summary && task.status === 'completed' && (
          <div className="rounded-2xl px-4 py-5 text-center text-[12px] text-slate-500 dark:text-slate-400 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-glass backdrop-blur-xl">
            No summary available.
          </div>
        )}

        {/* Insights Cards */}
        {summary?.keypoints?.map((kp, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              onClick={() => kp.startSeconds && mediaController?.seek(kp.startSeconds)}
              whileHover={{ y: -2 }}
              className={cn(
                "rounded-[26px] p-5 cursor-pointer group relative overflow-hidden transition-all duration-300 backdrop-blur-xl border",
                // Light: Active Glass Gradient
                "bg-gradient-to-br from-white/90 to-white/60 shadow-glass border-white/80 hover:shadow-xl",
                // Dark: Dark Glass
                "dark:bg-none dark:bg-zinc-900/50 dark:border-white/5 dark:shadow-none dark:hover:bg-zinc-800/50"
              )}
            >
              <div className="absolute inset-y-3 left-3 w-[2px] rounded-full bg-gradient-to-b from-emerald-400/70 via-emerald-200/30 to-transparent dark:from-emerald-300/70 dark:via-emerald-500/20" />
              <div className="flex justify-between items-start mb-3">
                <span className="bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 text-[9px] font-semibold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                  <Lightbulb className="w-3.5 h-3.5" />
                  Insight {idx + 1}
                </span>
                {kp.startSeconds !== undefined && (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-white/5 px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1 transition-colors group-hover:bg-white/80 dark:group-hover:bg-white/10">
                    <PlayCircle className="w-3 h-3" />
                    {formatSeconds(kp.startSeconds)}
                  </span>
                )}
              </div>
              <h5 className="text-[15px] font-semibold text-slate-800 dark:text-slate-100 mb-2 leading-tight">
                {kp.title}
              </h5>
              <p className="text-[12px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-5">
                {kp.detail}
              </p>
            </motion.div>
        ))}

      </div>
    </div>
  )
}
