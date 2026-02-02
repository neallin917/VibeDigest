'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase'
import { VideoPlayer } from '@/components/tasks/shared/VideoPlayer'
import { supportsVideoEmbed } from '@/components/tasks/VideoEmbed'
import { Button } from '@/components/ui/button'
import { X, StickyNote, PlayCircle, Quote, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

type SummaryKeyPoint = {
  title: string
  detail: string
  startSeconds?: number
  why_it_matters?: string
  evidence?: string
}

type SummarySectionItem = {
  content: string
  metadata?: Record<string, unknown>
}

type SummarySection = {
  section_type: string
  title?: string
  description?: string
  items: SummarySectionItem[]
}

type StructuredSummary = {
  version?: number
  tl_dr?: string
  overview?: string
  keypoints: SummaryKeyPoint[]
  sections: SummarySection[]
}

// --- Sub-components ---

function KeypointCard({ 
  kp, 
  idx, 
  onSeek 
}: { 
  kp: SummaryKeyPoint
  idx: number
  onSeek: (seconds: number) => void 
}) {
  const [showEvidence, setShowEvidence] = useState(true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.1 }}
      className={cn(
        "rounded-[26px] p-5 group relative overflow-hidden transition-all duration-300 backdrop-blur-xl border",
        // Light: Active Glass Gradient
        "bg-gradient-to-br from-white/90 to-white/60 shadow-glass border-white/80 hover:shadow-xl",
        // Dark: Dark Glass
        "dark:bg-none dark:bg-zinc-900/50 dark:border-white/5 dark:shadow-none dark:hover:bg-zinc-800/50"
      )}
    >
      <div className="absolute inset-y-3 left-3 w-[3px] rounded-full bg-gradient-to-b from-emerald-500/80 via-emerald-300/50 to-transparent dark:from-emerald-400/80 dark:via-emerald-500/30" />
      
      {/* Header & Title */}
      <div 
        className="flex items-start justify-between gap-3 mb-3 cursor-pointer"
        onClick={() => kp.startSeconds !== undefined && onSeek(kp.startSeconds)}
      >
        <h5 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 leading-snug">
          {kp.title}
        </h5>
        {kp.startSeconds !== undefined && (
          <span className="shrink-0 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-2 py-1 rounded-md backdrop-blur-sm flex items-center gap-1.5 transition-colors group-hover:bg-emerald-100/50 dark:group-hover:bg-emerald-500/20">
            <PlayCircle className="w-3.5 h-3.5" />
            {formatSeconds(kp.startSeconds)}
          </span>
        )}
      </div>

      {/* Main Detail */}
      <p 
        className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed cursor-pointer"
        onClick={() => kp.startSeconds !== undefined && onSeek(kp.startSeconds)}
      >
        {kp.detail}
      </p>

      {kp.why_it_matters && (
        <div className="mt-3 pt-3 flex items-start gap-2.5 border-t border-slate-100 dark:border-white/5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-500/80 mt-[3px] shrink-0" />
          <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed italic">
            {kp.why_it_matters}
          </p>
        </div>
      )}

      {/* Collapsible Evidence (Grounding) */}
      {kp.evidence && (
        <div className="mt-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowEvidence(!showEvidence)
            }}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors uppercase tracking-wide select-none"
          >
            <Quote className="w-3 h-3" />
            <span>Source Evidence</span>
            {showEvidence ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          
          <AnimatePresence>
            {showEvidence && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <div className="rounded-xl border border-slate-200/60 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 px-4 py-3 relative">
                    {/* Decorative quote mark */}
                    <Quote className="absolute top-2 left-2 w-4 h-4 text-slate-200 dark:text-white/5 rotate-180" />
                    <p className="text-[13px] italic text-slate-600 dark:text-slate-400 leading-relaxed pl-2 relative z-10">
                      "{kp.evidence}"
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}

export function VideoDetailPanel({
  taskId,
  onClose,
  className
}: VideoDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null)
  const [summary, setSummary] = useState<StructuredSummary | null>(null)
  const [mediaController, setMediaController] = useState<MediaController | null>(null)
  const [audioData, setAudioData] = useState<{ audioUrl: string, coverUrl?: string } | null>(null)
  const supabase = createClient()

  const normalizeSummary = (value: any): StructuredSummary | null => {
    if (!value || typeof value !== 'object') return null

    const keypointsRaw = Array.isArray(value.keypoints) ? value.keypoints : []
    const keypoints = keypointsRaw
      .map((kp: any) => ({
        title: typeof kp?.title === 'string' ? kp.title : '',
        detail: typeof kp?.detail === 'string' ? kp.detail : '',
        startSeconds: typeof kp?.startSeconds === 'number' ? kp.startSeconds : undefined,
        why_it_matters: typeof kp?.why_it_matters === 'string' ? kp.why_it_matters : undefined,
        evidence: typeof kp?.evidence === 'string' ? kp.evidence : undefined,
      }))
      .filter((kp: SummaryKeyPoint) => kp.title || kp.detail || kp.why_it_matters || kp.evidence)

    const sectionsRaw = Array.isArray(value.sections) ? value.sections : []
    const sections = sectionsRaw
      .map((section: any) => {
        const itemsRaw = Array.isArray(section?.items) ? section.items : []
        const items = itemsRaw
          .map((item: any) => ({
            content: typeof item?.content === 'string' ? item.content : '',
            metadata: item?.metadata && typeof item.metadata === 'object' ? item.metadata : undefined,
          }))
          .filter((item: SummarySectionItem) => item.content)

        return {
          section_type: typeof section?.section_type === 'string' ? section.section_type : 'section',
          title: typeof section?.title === 'string' ? section.title : undefined,
          description: typeof section?.description === 'string' ? section.description : undefined,
          items,
        }
      })
      .filter((section: SummarySection) => section.items.length || section.title || section.description)

    return {
      version: typeof value.version === 'number' ? value.version : undefined,
      tl_dr: typeof value.tl_dr === 'string' ? value.tl_dr : undefined,
      overview: typeof value.overview === 'string' ? value.overview : undefined,
      keypoints,
      sections,
    }
  }

  const stripCodeFence = (text: string) => {
    if (!text.startsWith('```')) return text
    const match = text.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/)
    return match ? match[1].trim() : text
  }

  const parseSummaryContent = (content: any): StructuredSummary | null => {
    if (!content) return null
    if (typeof content === 'object') {
      return normalizeSummary(content)
    }
    if (typeof content !== 'string') return null

    const trimmed = content.trim()
    if (!trimmed) return null

    const jsonCandidate = stripCodeFence(trimmed)

    if (jsonCandidate.startsWith('{') || jsonCandidate.startsWith('[')) {
      try {
        const parsed = JSON.parse(jsonCandidate)
        return normalizeSummary(parsed)
      } catch (e) {
        console.error("Failed to parse summary JSON", e)
      }
    }

    return {
      overview: trimmed,
      keypoints: [],
      sections: []
    }
  }

  const formatSectionTitle = (value: string) =>
    value
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())

  const getMetadataTags = (metadata?: Record<string, unknown>) => {
    if (!metadata) return []
    return Object.values(metadata).flatMap((value) => {
      if (typeof value === 'string' && value.trim()) return [value]
      if (typeof value === 'number' || typeof value === 'boolean') return [String(value)]
      return []
    })
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

        {summary?.tl_dr && (
          <div className="rounded-2xl px-5 py-4 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-glass backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-wide">
                TL;DR
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent dark:from-emerald-500/30" />
            </div>
            <p className="text-[15px] font-medium text-slate-700 dark:text-slate-200 leading-relaxed text-balance">
              {summary.tl_dr}
            </p>
          </div>
        )}

        {summary?.overview && (
          <div className="rounded-2xl px-5 py-4 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-glass backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-wide">
                Summary
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-emerald-200 to-transparent dark:from-emerald-500/30" />
            </div>
            <p className="text-[15px] text-slate-700 dark:text-slate-300 leading-relaxed text-balance">
              {summary.overview}
            </p>
          </div>
        )}

        {/* Divider for Key Insights */}
        <div className="flex items-center gap-3 px-2 pt-2">
          <span data-testid="header-key-insights" className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
            Key Insights
          </span>
          {summary?.keypoints?.length ? (
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
              {summary.keypoints.length}
            </span>
          ) : null}
          <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" />
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
          <KeypointCard 
            key={idx} 
            kp={kp} 
            idx={idx} 
            onSeek={(seconds) => mediaController?.seek(seconds)} 
          />
        ))}

        {summary?.sections?.length ? (
          <>
            <div className="flex items-center gap-3 px-2 pt-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                Sections
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-200 bg-emerald-100/80 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 px-2 py-0.5 rounded-full">
                {summary.sections.length}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent dark:from-slate-700" />
            </div>
            <div className="space-y-4">
              {summary.sections.map((section, sectionIndex) => {
                const title = section.title || formatSectionTitle(section.section_type)
                return (
                  <div
                    key={`${section.section_type}-${sectionIndex}`}
                    className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/70 dark:bg-zinc-900/40 shadow-glass backdrop-blur-xl overflow-hidden flex flex-col"
                  >
                    <div className="sticky top-0 z-10 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-5 py-4 border-b border-white/20 dark:border-white/5 flex items-center justify-between gap-3">
                      <h4 className="text-[16px] font-bold text-slate-800 dark:text-slate-100">
                        {title}
                      </h4>
                      <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/15 border border-emerald-200/80 dark:border-emerald-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                        {section.section_type}
                      </span>
                    </div>
                    
                    <div className="p-5 pt-4">
                      {section.description && (
                        <p className="text-[13.5px] text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                          {section.description}
                        </p>
                      )}
                      <div className="space-y-3">
                      {section.items.map((item, itemIndex) => {
                        const metadataTags = getMetadataTags(item.metadata)
                        return (
                          <div
                            key={`${section.section_type}-${sectionIndex}-${itemIndex}`}
                            className="rounded-xl border border-white/70 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3"
                          >
                            <div className="flex items-start gap-3">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-emerald-400/80 dark:bg-emerald-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-slate-700 dark:text-slate-200 leading-relaxed">
                                  {item.content}
                                </p>
                                {metadataTags.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {metadataTags.map((tag, i) => (
                                      <span key={i} className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                )
              })}
            </div>
          </>
        ) : null}

      </div>
    </div>
  )
}
