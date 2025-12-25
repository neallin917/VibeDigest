"use client"

import React, { useEffect, useRef } from "react"

import { ApplePodcastsIcon } from "@/components/icons/ApplePodcastsIcon"
import { XiaoyuzhouIcon } from "@/components/icons/XiaoyuzhouIcon"
import { Heading } from "@/components/ui/typography"

export function AudioEmbed({
  audioUrl,
  title,
  coverUrl,
  sourceUrl,
  onReady,
}: {
  audioUrl: string
  title?: string
  coverUrl?: string
  sourceUrl?: string
  onReady?: (ctrl: { seek: (seconds: number) => void }) => void
}) {
  if (!audioUrl) return null

  // Determine if it looks like an Apple Podcast (square-ish large image)
  // Or simply always use the "card" layout if there's a cover.
  // The user screenshot shows a card layout with image on left/top and metadata.

  // Actually, for better adaptation, let's look at the implementation.
  // We want to avoid the "video" aspect ratio wrapper if it's a square image.

  const isXiaoyuzhou = sourceUrl?.includes("xiaoyuzhoufm.com")
  const isApple = sourceUrl?.includes("apple.com")
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (!onReady) return
    onReady({
      seek: (seconds: number) => {
        const audio = audioRef.current
        if (!audio) return
        const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0)

        // IMPORTANT:
        // - Browsers often block `play()` unless it's called synchronously inside a user gesture.
        // - Timeline click is a user gesture, but our seek might wait for `loadedmetadata`,
        //   which would lose the gesture context and cause play to be ignored.
        // Strategy:
        // 1) Try `play()` immediately (gesture context) to "unlock" playback.
        // 2) Ensure network starts by calling `load()` (preload is none).
        // 3) Once metadata is ready, set `currentTime` and keep playing.

        try {
          const p = audio.play()
          if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {})
        } catch {
          // ignore
        }

        const apply = () => {
          try {
            audio.currentTime = s
          } catch {
            // ignore
          }
          try {
            const p = audio.play()
            if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {})
          } catch {
            // ignore
          }
        }

        // If metadata isn't loaded yet, wait once.
        if (audio.readyState >= 1) {
          apply()
          return
        }

        try {
          // With preload="none", this is needed to start fetching metadata.
          audio.load()
        } catch {
          // ignore
        }
        audio.addEventListener("loadedmetadata", apply, { once: true })
      },
    })
  }, [onReady])

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="flex flex-col md:flex-row">
        {coverUrl ? (
          <div className="relative shrink-0 md:w-64 aspect-square bg-black/40 overflow-hidden">
            <img
              src={coverUrl}
              alt={title || "Audio cover"}
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : null}

        <div className="flex-1 flex flex-col justify-between p-4 md:p-6 gap-4">
          <div>
            {isXiaoyuzhou && (
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#3D9DE1] uppercase mb-2">
                <XiaoyuzhouIcon className="w-4 h-4 text-[#3D9DE1]" />
                Xiaoyuzhou
              </div>
            )}
            {isApple && (
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#a855f7] uppercase mb-2">
                <ApplePodcastsIcon className="w-4 h-4" />
                Apple Podcasts
              </div>
            )}

            <Heading as="h3" variant="mediaTitle" className="mb-2">
              {title || "Episode"}
            </Heading>
            {/* Optional: Add date or "Podcast" subtitle if available in data */}
          </div>

          <div className="w-full">
            <audio ref={audioRef} className="w-full" controls preload="none">
              <source src={audioUrl} />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      </div>
    </div>
  )
}


