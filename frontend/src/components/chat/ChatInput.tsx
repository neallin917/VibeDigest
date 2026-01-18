'use client'

import { useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useI18n } from '@/components/i18n/I18nProvider'
import { TypewriterPlaceholder } from './TypewriterPlaceholder'

interface ChatInputProps {
  onSubmit: (text: string) => void
  isLoading?: boolean
  error?: string
  disabled?: boolean
  /** Show typewriter animation in placeholder */
  showTypewriter?: boolean
  /** 
   * Layout variant:
   * - "floating": Absolute positioned at bottom (default, for chat mode)
   * - "inline": Normal block element (for welcome screen)
   */
  variant?: "floating" | "inline"
  /** Hide disclaimer text */
  hideDisclaimer?: boolean
}

export function ChatInput({ 
  onSubmit, 
  isLoading, 
  disabled, 
  showTypewriter = false,
  variant = "floating",
  hideDisclaimer = false
}: ChatInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const { t } = useI18n()

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isLoading || disabled) return
    onSubmit(input)
    setInput('')
  }

  // Show typewriter only when: enabled, no input, and not focused
  const showTypewriterPlaceholder = showTypewriter && !input && !isFocused

  const isFloating = variant === "floating"

  return (
    <div className={cn(
      "flex justify-center",
      isFloating 
        ? "absolute bottom-3 md:bottom-6 left-3 md:left-6 right-3 md:right-6 z-20" 
        : "w-full"
    )}>
      <div className={cn("w-full", isFloating ? "max-w-3xl" : "max-w-2xl")}>
        <motion.form
          onSubmit={handleSubmit}
          className={cn(
            "relative rounded-full p-1.5 md:p-2 pl-3 md:pl-5 flex items-center gap-2 md:gap-3 shadow-2xl ring-1 transition-all",
            "bg-white/85 backdrop-blur-xl ring-white/90 shadow-emerald-500/10", // Light - Enhanced
            "dark:bg-card/80 dark:ring-white/10 dark:shadow-none", // Dark
            isFocused && "ring-emerald-400/50 shadow-emerald-500/20" // Focus glow
          )}
        >
          {/* Input container with typewriter overlay */}
          <div className="relative flex-1 min-w-0">
            {/* Typewriter placeholder overlay */}
            <TypewriterPlaceholder visible={showTypewriterPlaceholder} />
            
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              aria-label="Chat input"
              className={cn(
                "w-full bg-transparent border-none focus:ring-0 focus:outline-none text-slate-800 dark:text-white",
                "py-2.5 md:py-3 text-sm md:text-[15px] font-medium",
                // Hide native placeholder when typewriter is active
                showTypewriterPlaceholder ? "placeholder-transparent" : "placeholder-slate-400"
              )}
              placeholder={showTypewriter ? "" : (t('chat.inputPlaceholder') || "Paste a video URL or ask anything...")}
              disabled={disabled}
            />
          </div>

          <motion.button
            type="submit"
            disabled={!input.trim() || isLoading || disabled}
            className={cn(
              "p-2 md:p-2.5 rounded-full shadow-lg transition-all duration-200 active:scale-90 shrink-0",
              input.trim() && !isLoading && !disabled
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:shadow-none"
                : "bg-slate-300 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 scale-95 cursor-not-allowed shadow-none"
            )}
            aria-label="Send message"
            whileHover={{ scale: input.trim() && !isLoading && !disabled ? 1.05 : 1 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              animate={{ 
                y: input.trim() && !isLoading && !disabled ? [0, -2, 0] : 0 
              }}
              transition={{ 
                duration: 0.5, 
                repeat: input.trim() && !isLoading && !disabled ? Infinity : 0,
                repeatType: "reverse"
              }}
            >
              <ArrowUp className="w-4 h-4 md:w-5 md:h-5" />
            </motion.div>
          </motion.button>
        </motion.form>

        {/* Disclaimer - hidden on mobile for more space */}
        {!hideDisclaimer && (
          <div className="hidden md:block text-center mt-3">
            <p className="text-[10px] text-slate-400 font-medium">
              AI can make mistakes. Please verify important information.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
