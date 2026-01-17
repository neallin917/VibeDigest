'use client'

import { useState } from 'react'
import { PlusCircle, Mic, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSubmit: (text: string) => void
  isLoading?: boolean
  error?: string
  disabled?: boolean
}

export function ChatInput({ onSubmit, isLoading, disabled }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading || disabled) return
    onSubmit(input)
    setInput('')
  }

  return (
    <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-center">
      <div className="w-full max-w-3xl">
        <form
          onSubmit={handleSubmit}
          className={cn(
            "rounded-full p-2 pl-5 flex items-center gap-3 shadow-2xl ring-1 transition-all",
            "bg-white/70 backdrop-blur-xl ring-white/80 shadow-indigo-500/10", // Light
            "dark:bg-[#1A1A1A]/80 dark:ring-white/10 dark:shadow-none" // Dark
          )}
        >
          <button type="button" aria-label="Upload file" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-emerald-500 transition-colors">
            <PlusCircle className="w-6 h-6" />
          </button>

          <div className="h-6 w-px bg-slate-300 dark:bg-white/10" />

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Chat input"
            className="flex-1 bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder-slate-400 py-3 text-[15px] font-medium"
            placeholder="Ask anything or paste a YouTube URL..."
            disabled={disabled}
          />

          <button type="button" aria-label="Voice input" className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-emerald-500 transition-colors">
            <Mic className="w-6 h-6" />
          </button>

          <button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            className={cn(
              "p-2.5 rounded-full text-white shadow-lg transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100",
              "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200", // Light
              "dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:shadow-none" // Dark
            )}
            aria-label="Send message"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>

        <div className="text-center mt-3">
          <p className="text-[10px] text-slate-400 font-medium">
            AI can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </div>
  )
}
