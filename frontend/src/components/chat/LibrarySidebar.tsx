'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Search, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface LibrarySidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectTask: (taskId: string) => void
}

export function LibrarySidebar({ 
  isOpen, 
  onClose, 
  onSelectTask 
}: LibrarySidebarProps) {
  const [tasks, setTasks] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(50)

    if (searchQuery) {
      query = query.ilike('video_title', `%${searchQuery}%`)
    }

    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }, [supabase, searchQuery])

  useEffect(() => {
    if (isOpen) fetchTasks()
  }, [isOpen, fetchTasks])

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="left" className={cn(
        "w-[320px] p-0 flex flex-col border-r shadow-2xl backdrop-blur-xl transition-all",
        "bg-white/80 border-white/40", // Light
        "dark:bg-black/80 dark:border-white/10" // Dark
      )}>
        <SheetHeader className="p-4 border-b border-slate-200 dark:border-white/10 shrink-0">
          <SheetTitle className="text-slate-800 dark:text-white">Library</SheetTitle>
        </SheetHeader>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(
                "pl-9 border-none focus-visible:ring-1 transition-all rounded-xl",
                "bg-black/5 placeholder:text-slate-400 focus-visible:bg-white", // Light
                "dark:bg-white/5 dark:placeholder:text-slate-500 dark:focus-visible:bg-white/10" // Dark
              )}
            />
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center p-8 text-slate-400 text-sm">
              {searchQuery ? 'No results' : 'No history yet'}
            </div>
          ) : (
            tasks.map(task => (
              <button
                key={task.id}
                onClick={() => { onSelectTask(task.id); onClose() }}
                className={cn(
                  "group w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 border border-transparent",
                  "hover:bg-white/60 hover:shadow-sm hover:border-white/50", // Light Hover
                  "dark:hover:bg-white/5 dark:hover:border-white/5" // Dark Hover
                )}
              >
                {/* Thumbnail */}
                <div className="w-12 h-12 shrink-0 bg-slate-200 dark:bg-white/5 rounded-lg overflow-hidden relative border border-black/5 dark:border-white/10">
                  {task.thumbnail_url ? (
                    <img src={task.thumbnail_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Clock className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate leading-tight mb-1">
                    {task.video_title || task.video_url}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <StatusIcon status={task.status} />
                    <span>
                      {task.created_at ? formatDistanceToNow(new Date(task.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
    case 'processing': return <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
    case 'failed': return <AlertCircle className="w-3.5 h-3.5 text-red-500" />
    default: return <Clock className="w-3.5 h-3.5 text-slate-400" />
  }
}
