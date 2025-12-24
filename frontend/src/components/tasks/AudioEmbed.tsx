import React from "react"

import { ApplePodcastsIcon } from "@/components/icons/ApplePodcastsIcon"
import { XiaoyuzhouIcon } from "@/components/icons/XiaoyuzhouIcon"
import { Heading } from "@/components/ui/typography"

export function AudioEmbed({
  audioUrl,
  title,
  coverUrl,
  sourceUrl,
}: {
  audioUrl: string
  title?: string
  coverUrl?: string
  sourceUrl?: string
}) {
  if (!audioUrl) return null

  // Determine if it looks like an Apple Podcast (square-ish large image)
  // Or simply always use the "card" layout if there's a cover.
  // The user screenshot shows a card layout with image on left/top and metadata.

  // Actually, for better adaptation, let's look at the implementation.
  // We want to avoid the "video" aspect ratio wrapper if it's a square image.

  const isXiaoyuzhou = sourceUrl?.includes("xiaoyuzhoufm.com")
  const isApple = sourceUrl?.includes("apple.com")

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
            <audio className="w-full" controls preload="none">
              <source src={audioUrl} />
              Your browser does not support the audio element.
            </audio>
          </div>
        </div>
      </div>
    </div>
  )
}


