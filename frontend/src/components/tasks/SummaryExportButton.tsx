"use client"

import { useState, useCallback, RefObject } from "react"
import { Camera, Check, X, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toPng } from "html-to-image"

interface SummaryExportButtonProps {
    containerRef: RefObject<HTMLElement | null>
    title: string
    t: (key: string, vars?: Record<string, string | number>) => string
}

export function SummaryExportButton({ containerRef, title, t }: SummaryExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false)
    const [showSuccess, setShowSuccess] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)

    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    const handleExport = useCallback(async () => {
        if (isExporting || !containerRef.current) return
        setIsExporting(true)

        try {
            const element = containerRef.current

            // Hide action buttons before capture
            const buttons = element.querySelectorAll('[data-export-hide="true"]') as NodeListOf<HTMLElement>
            buttons.forEach(btn => btn.style.visibility = 'hidden')

            // Capture the DOM element
            const dataUrl = await toPng(element, {
                backgroundColor: '#0A0A0A',
                pixelRatio: 2,
                quality: 0.95,
                skipFonts: true,
            })

            // Restore buttons
            buttons.forEach(btn => btn.style.visibility = '')

            if (isMobile) {
                // Mobile: show preview modal for long-press save
                setPreviewUrl(dataUrl)
            } else {
                // Desktop: direct download
                const link = document.createElement('a')
                link.download = `${sanitizeFilename(title)}.png`
                link.href = dataUrl
                link.click()

                setShowSuccess(true)
                setTimeout(() => setShowSuccess(false), 2000)
            }
        } catch (err) {
            console.error("Export failed:", err)
        } finally {
            setIsExporting(false)
        }
    }, [isExporting, containerRef, title, isMobile])

    const closePreview = useCallback(() => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl)
        }
        setPreviewUrl(null)
        setShowSuccess(true)
        setTimeout(() => setShowSuccess(false), 2000)
    }, [previewUrl])

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                data-export-hide="true"
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

            {/* Mobile Preview Modal */}
            {previewUrl && (
                <div
                    className="fixed inset-0 z-50 bg-black flex flex-col"
                    onClick={closePreview}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-black/80 backdrop-blur">
                        <div className="flex items-center gap-2 text-white">
                            <ArrowDown className="h-5 w-5 animate-bounce text-primary" />
                            <span className="text-sm font-medium">{t("tasks.longPressToSave")}</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20"
                            onClick={closePreview}
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </div>

                    {/* Image Container - takes remaining space */}
                    <div
                        className="flex-1 overflow-auto p-4 flex items-start justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Image with highlight border */}
                        <div className="relative">
                            {/* Glow effect */}
                            <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur-xl" />
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewUrl}
                                alt="Summary export preview"
                                className="relative max-w-full h-auto rounded-xl border-2 border-primary/50 shadow-2xl"
                                style={{ maxHeight: 'calc(100vh - 140px)' }}
                            />
                        </div>
                    </div>

                    {/* Footer hint */}
                    <div className="p-4 text-center bg-black/80 backdrop-blur">
                        <p className="text-white/60 text-xs">
                            {t("tasks.tapToClose")}
                        </p>
                    </div>
                </div>
            )}
        </>
    )
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50) || "summary"
}
