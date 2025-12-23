import React from "react"

export function AudioEmbed({
  audioUrl,
  title,
  coverUrl,
}: {
  audioUrl: string
  title?: string
  coverUrl?: string
}) {
  if (!audioUrl) return null

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      {coverUrl ? (
        <div className="relative aspect-video w-full overflow-hidden bg-black/40">
          <img
            src={coverUrl}
            alt={title || "Audio cover"}
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          {title ? (
            <div className="absolute bottom-3 left-4 right-4">
              <div className="text-sm font-semibold text-white line-clamp-2 drop-shadow">
                {title}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="p-4">
        <audio className="w-full" controls preload="none">
          <source src={audioUrl} />
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  )
}


