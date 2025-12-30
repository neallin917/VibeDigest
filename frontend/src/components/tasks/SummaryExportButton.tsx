"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, Download, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import html2canvas from "html2canvas"

type StructuredSummaryV1 = {
    version: number
    language: string
    overview: string
    keypoints: Array<{
        title: string
        detail: string
        evidence?: string
        startSeconds?: number
        endSeconds?: number
    }>
}

interface SummaryExportButtonProps {
    title: string
    summary: StructuredSummaryV1
    t: (key: string, vars?: Record<string, string | number>) => string
}

export function SummaryExportButton({ title, summary, t }: SummaryExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const exportContainerRef = useRef<HTMLDivElement>(null)

    const handleExport = useCallback(async () => {
        if (isExporting) return
        setIsExporting(true)

        try {
            // Create a temporary container for rendering
            const container = document.createElement("div")
            container.style.position = "fixed"
            container.style.left = "-9999px"
            container.style.top = "0"
            container.style.width = "390px" // iPhone width
            container.style.backgroundColor = "#0A0A0A"
            container.style.padding = "24px"
            container.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

            // Build the export content HTML
            container.innerHTML = `
                <div style="background: linear-gradient(135deg, #0A0A0A 0%, #1A1A1A 100%); border-radius: 24px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                    <!-- Header with gradient -->
                    <div style="background: linear-gradient(135deg, #059669 0%, #10B981 50%, #34D399 100%); padding: 32px 24px;">
                        <h1 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #000; line-height: 1.4; word-break: break-word;">
                            ${escapeHtml(title)}
                        </h1>
                        <div style="display: flex; align-items: center; gap: 8px; margin-top: 16px;">
                            <div style="background: rgba(0,0,0,0.2); padding: 4px 10px; border-radius: 12px; font-size: 12px; color: rgba(0,0,0,0.8); font-weight: 500;">
                                ✨ AI Summary
                            </div>
                        </div>
                    </div>
                    
                    <!-- Content -->
                    <div style="padding: 24px;">
                        <!-- Overview Section -->
                        <div style="margin-bottom: 24px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                <span style="font-size: 16px;">🎯</span>
                                <span style="font-size: 14px; font-weight: 600; color: #fff;">${escapeHtml(t("tasks.summaryStructured.overviewTitle"))}</span>
                            </div>
                            <p style="margin: 0; font-size: 14px; line-height: 1.7; color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                ${escapeHtml(summary.overview)}
                            </p>
                        </div>
                        
                        <!-- Keypoints Section -->
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                <span style="font-size: 16px;">⚡</span>
                                <span style="font-size: 14px; font-weight: 600; color: #fff;">${escapeHtml(t("tasks.summaryStructured.keypointsTitle"))}</span>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 10px;">
                                ${summary.keypoints.map((kp, idx) => `
                                    <div style="background: rgba(255,255,255,0.03); padding: 14px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                                        <div style="display: flex; gap: 10px; align-items: flex-start;">
                                            <div style="width: 22px; height: 22px; background: linear-gradient(135deg, #059669 0%, #10B981 100%); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #000; flex-shrink: 0;">
                                                ${idx + 1}
                                            </div>
                                            <div style="flex: 1; min-width: 0;">
                                                <div style="font-size: 13px; font-weight: 600; color: #fff; line-height: 1.4; margin-bottom: ${kp.detail ? '6px' : '0'};">
                                                    ${escapeHtml(kp.title)}
                                                </div>
                                                ${kp.detail ? `<div style="font-size: 12px; color: rgba(255,255,255,0.6); line-height: 1.5;">${escapeHtml(kp.detail)}</div>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div style="padding: 16px 24px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <span style="font-size: 12px; color: rgba(255,255,255,0.4);">Generated by</span>
                        <span style="font-size: 12px; font-weight: 600; color: #10B981;">VibeDigest</span>
                    </div>
                </div>
            `

            document.body.appendChild(container)

            // Use html2canvas to capture
            const canvas = await html2canvas(container, {
                backgroundColor: "#0A0A0A",
                scale: 2, // Retina quality
                useCORS: true,
                logging: false,
            })

            document.body.removeChild(container)

            // Convert to blob and download
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    console.error("Failed to generate image blob")
                    setIsExporting(false)
                    return
                }

                // Try native share on mobile first
                if (navigator.share && navigator.canShare) {
                    const file = new File([blob], `${sanitizeFilename(title)}.png`, { type: "image/png" })
                    const shareData = { files: [file] }

                    if (navigator.canShare(shareData)) {
                        try {
                            await navigator.share(shareData)
                            setShowSuccess(true)
                            setTimeout(() => setShowSuccess(false), 2000)
                            setIsExporting(false)
                            return
                        } catch (err) {
                            // User cancelled or share failed, fall through to download
                            if ((err as Error).name !== 'AbortError') {
                                console.error("Share failed:", err)
                            }
                        }
                    }
                }

                // Fallback to download
                const url = URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url
                a.download = `${sanitizeFilename(title)}.png`
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)

                setShowSuccess(true)
                setTimeout(() => setShowSuccess(false), 2000)
                setIsExporting(false)
            }, "image/png")

        } catch (err) {
            console.error("Export failed:", err)
            setIsExporting(false)
        }
    }, [isExporting, title, summary, t])

    return (
        <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 bg-black/50 hover:bg-black/70 text-muted-foreground hover:text-white border border-white/10 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            onClick={handleExport}
            disabled={isExporting}
            aria-label={t("tasks.exportAsImage")}
        >
            {isExporting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : showSuccess ? (
                <Check className="h-4 w-4 text-green-500" />
            ) : (
                <Camera className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">
                {showSuccess ? t("tasks.exported") : t("tasks.exportAsImage")}
            </span>
        </Button>
    )
}

// Helper functions
function escapeHtml(text: string): string {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50) || "summary"
}
