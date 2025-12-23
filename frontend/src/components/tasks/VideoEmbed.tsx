import React from "react"

function getBilibiliVideoId(inputUrl: string): { bvid?: string; aid?: string; page?: string } | null {
  try {
    const url = new URL(inputUrl)
    const host = url.hostname.replace(/^www\./, "")

    // Handle already-embedded URLs like:
    // https://player.bilibili.com/player.html?bvid=BV...&page=1
    if (host === "player.bilibili.com") {
      const bvid = url.searchParams.get("bvid") || undefined
      const aid = url.searchParams.get("aid") || undefined
      const page = url.searchParams.get("page") || undefined
      if (!bvid && !aid) return null
      return { bvid, aid, page }
    }

    // Standard bilibili video URLs:
    // https://www.bilibili.com/video/BV...
    // https://www.bilibili.com/video/av123456
    if (host.endsWith("bilibili.com")) {
      const parts = url.pathname.split("/").filter(Boolean)
      const videoIdx = parts.indexOf("video")
      if (videoIdx !== -1 && parts.length > videoIdx + 1) {
        const id = parts[videoIdx + 1]
        const page = url.searchParams.get("p") || undefined
        if (/^BV/i.test(id)) return { bvid: id, page }
        if (/^av\d+$/i.test(id)) return { aid: id.replace(/^av/i, ""), page }
      }
    }

    // b23.tv short links are redirects; we can't reliably expand them client-side due to CORS.
    // Keep it as "no embed" and fall back to the external link UI.
    return null
  } catch {
    return null
  }
}

function getYouTubeVideoId(inputUrl: string): string | null {
  try {
    const url = new URL(inputUrl)
    const host = url.hostname.replace(/^www\./, "")

    // youtu.be/<id>
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id || null
    }

    // youtube.com/* variants
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      // /watch?v=<id>
      const v = url.searchParams.get("v")
      if (v) return v

      // /embed/<id>, /shorts/<id>, /live/<id>
      const parts = url.pathname.split("/").filter(Boolean)
      if (parts.length >= 2 && ["embed", "shorts", "live"].includes(parts[0])) {
        return parts[1] || null
      }
    }

    return null
  } catch {
    return null
  }
}

export function VideoEmbed({ videoUrl, title }: { videoUrl: string; title?: string }) {
  const bilibili = getBilibiliVideoId(videoUrl)
  if (bilibili?.bvid || bilibili?.aid) {
    const params = new URLSearchParams()
    if (bilibili.bvid) params.set("bvid", bilibili.bvid)
    if (bilibili.aid) params.set("aid", bilibili.aid)
    if (bilibili.page) params.set("page", bilibili.page)
    params.set("high_quality", "1")
    params.set("danmaku", "0")

    const src = `https://player.bilibili.com/player.html?${params.toString()}`

    return (
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
        <div className="aspect-video w-full">
          <iframe
            className="h-full w-full"
            src={src}
            title={title || "Embedded video player"}
            loading="lazy"
            allow="fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
      </div>
    )
  }

  const youtubeId = getYouTubeVideoId(videoUrl)
  if (!youtubeId) return null

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="aspect-video w-full">
        <iframe
          className="h-full w-full"
          src={src}
          title={title || "Embedded video player"}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    </div>
  )
}


