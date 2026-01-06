"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"

type OnReady = (ctrl: { seek: (seconds: number) => void }) => void

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

let ytApiPromise: Promise<any> | null = null

function loadYouTubeIframeAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"))
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise

  ytApiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
    if (!existing) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      tag.async = true
      tag.onerror = () => reject(new Error("Failed to load YouTube IFrame API"))
      document.head.appendChild(tag)
    }

    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      try {
        resolve(window.YT)
      } finally {
        // Preserve any previous handler.
        if (prev && prev !== window.onYouTubeIframeAPIReady) {
          try {
            prev()
          } catch {
            // ignore
          }
        }
      }
    }

    // Safety timeout in case the global callback never fires
    setTimeout(() => {
      if (window.YT?.Player) resolve(window.YT)
    }, 8000)
  })

  return ytApiPromise
}

export function YouTubePlayer({
  videoId,
  title,
  coverUrl,
  onReady,
}: {
  videoId: string
  title?: string
  coverUrl?: string
  onReady?: OnReady
}) {
  const containerId = useMemo(() => `yt-${videoId}-${Math.random().toString(16).slice(2)}`, [videoId])
  const playerRef = useRef<any>(null)
  const onReadyRef = useRef<OnReady | undefined>(onReady)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Auto-play if no coverUrl is provided (backward compatibility / legacy behavior)
  useEffect(() => {
    if (!coverUrl) setIsPlaying(true)
  }, [coverUrl])

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    if (!isPlaying) return

    let disposed = false

    void (async () => {
      try {
        const YT = await loadYouTubeIframeAPI()
        if (disposed) return

        // Destroy any previous player instance
        if (playerRef.current?.destroy) {
          try {
            playerRef.current.destroy()
          } catch {
            // ignore
          }
          playerRef.current = null
        }

        const player = new YT.Player(containerId, {
          width: "100%",
          height: "100%",
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            autoplay: coverUrl ? 1 : 0, // Autoplay if coming from facade click
            origin: typeof window !== "undefined" ? window.location.origin : undefined,
          },
          events: {
            onReady: () => {
              if (disposed) return
              setIsReady(true)
              onReadyRef.current?.({
                seek: (seconds: number) => {
                  try {
                    const s = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
                    player.seekTo(s, true)
                    player.playVideo()
                  } catch {
                    // ignore
                  }
                },
              })
            },
          },
        })

        playerRef.current = player
      } catch {
        // If API fails, we simply stay non-seekable; parent can fall back to iframe elsewhere if desired.
      }
    })()

    return () => {
      disposed = true
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy()
        } catch {
          // ignore
        }
      }
      playerRef.current = null
    }
  }, [containerId, videoId, isPlaying, coverUrl])

  if (coverUrl && !isPlaying) {
    return (
      <div
        className="overflow-hidden rounded-xl border border-white/10 bg-black/20 cursor-pointer group relative"
        onClick={() => setIsPlaying(true)}
      >
        <div className="aspect-video w-full relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt={title || "Video thumbnail"}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-110 transition-transform">
              <svg className="w-8 h-8 text-white fill-current" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="aspect-video w-full relative">
        <div id={containerId} className="h-full w-full" aria-label={title || "YouTube player"} />
        {!isReady ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : null}
      </div>
    </div>
  )
}


