"use client"

import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { formatSeconds, parseScriptRawPayload } from "@/components/tasks/transcript"

function buildTimelinePoints(scriptRawContent?: string) {
  const payload = parseScriptRawPayload(scriptRawContent)
  const segments = Array.isArray(payload?.segments) ? payload?.segments : []

  const points: Array<{ t: number; label: string }> = []

  let lastT = -Infinity
  const minGapSeconds = 90
  const maxPoints = 28

  for (const seg of segments) {
    if (points.length >= maxPoints) break
    const t = typeof seg?.start === "number" ? seg.start : null
    const text = (seg?.text || "").toString().trim().replace(/\s+/g, " ")
    if (t === null || !Number.isFinite(t)) continue
    if (!text || text.length < 12) continue
    if (t - lastT < minGapSeconds) continue

    points.push({ t, label: text.slice(0, 80) })
    lastT = t
  }

  return points
}

export function TranscriptKeyframesPanel({
  scriptRawContent,
  canSeek,
  onSeek,
}: {
  scriptRawContent?: string
  canSeek: boolean
  onSeek: (seconds: number) => void
}) {
  const points = useMemo(() => buildTimelinePoints(scriptRawContent), [scriptRawContent])

  // Keep UX unchanged by default: collapsed panel.
  if (!scriptRawContent) return null

  return (
    <details className="mt-4 rounded-xl border border-white/10 bg-black/10 px-4 py-3">
      <summary className="cursor-pointer select-none text-sm text-muted-foreground hover:text-foreground flex items-center justify-between">
        <span>Timeline (beta)</span>
        <span className="text-xs opacity-70">{canSeek ? "Click to seek" : "Player not seekable"}</span>
      </summary>

      <div className="mt-3 grid grid-cols-1 gap-2">
        {!canSeek ? (
          <div className="text-xs text-muted-foreground">
            This source is not seekable in-place. (Bilibili may reload; some sources may not support seeking.)
          </div>
        ) : null}

        {points.length ? (
          points.map((p) => (
            <button
              key={`tp-${p.t}`}
              type="button"
              onClick={() => onSeek(p.t)}
              disabled={!canSeek}
              className="w-full text-left rounded-lg border border-white/10 bg-black/20 hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2"
            >
              <div className="text-xs font-mono text-primary/90">{formatSeconds(p.t)}</div>
              <div className="text-sm text-foreground/90 mt-1">{p.label}</div>
            </button>
          ))
        ) : (
          <div className="text-xs text-muted-foreground">No raw transcript segments available for timeline.</div>
        )}
      </div>
    </details>
  )
}


