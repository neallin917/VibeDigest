'use client'

import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, CheckCircle, AlertCircle, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoCardMessageProps {
  taskId: string
  videoUrl: string
  title?: string
  thumbnailUrl?: string
  status: 'processing' | 'completed' | 'failed' | 'pending'
  progress?: number
  onViewClick?: (taskId: string) => void
}

export function VideoCardMessage({
  taskId,
  videoUrl,
  title,
  thumbnailUrl,
  status,
  progress = 0,
  onViewClick
}: VideoCardMessageProps) {
  const isProcessing = status === 'processing' || status === 'pending'
  const isCompleted = status === 'completed'
  const isFailed = status === 'failed'

  return (
    <Card className={cn(
      "w-full max-w-sm overflow-hidden mt-2 border transition-all",
      "bg-white/50 border-white/40 shadow-sm", // Light
      "dark:bg-card dark:border-white/10" // Dark
    )}>
      {/* Thumbnail Section */}
      <div className="relative aspect-video bg-black/50">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title || "Video"}
            className="w-full h-full object-cover opacity-80"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Play className="w-8 h-8 opacity-20" />
          </div>
        )}

        {/* Status Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isProcessing && (
            <div className="bg-black/60 backdrop-blur-sm rounded-full p-3">
              <Loader2 className="w-6 h-6 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        <h3 className="font-medium text-sm line-clamp-2 leading-snug text-slate-800 dark:text-slate-200">
          {title || videoUrl}
        </h3>

        {/* Status Indicator */}
        <div className="flex items-center gap-2 text-xs">
          {isProcessing && (
            <>
              <span className="text-blue-500 dark:text-blue-400">Processing...</span>
              <span className="text-muted-foreground">{progress}%</span>
            </>
          )}
          {isCompleted && (
            <>
              <CheckCircle className="w-3 h-3 text-emerald-500" />
              <span className="text-emerald-500">Ready</span>
            </>
          )}
          {isFailed && (
            <>
              <AlertCircle className="w-3 h-3 text-red-500" />
              <span className="text-red-500">Failed</span>
            </>
          )}
        </div>

        {/* Progress Bar */}
        {isProcessing && (
          <Progress value={progress} className="h-1 bg-slate-200 dark:bg-white/10" />
        )}

        {/* Action Button */}
        {isCompleted && onViewClick && (
          <Button
            onClick={() => onViewClick(taskId)}
            className="w-full h-8 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            View Summary
          </Button>
        )}
      </div>
    </Card>
  )
}
