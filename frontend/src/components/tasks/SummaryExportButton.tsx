"use client"

import { useState, useCallback, RefObject } from "react"
import { Camera, Check } from "lucide-react"
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
                pixelRatio: 2, // Retina quality
                quality: 0.95,
                skipFonts: true, // Faster, avoids font loading issues
            })

            // Restore buttons
            buttons.forEach(btn => btn.style.visibility = '')

            // Direct download
            const link = document.createElement('a')
            link.download = `${sanitizeFilename(title)}.png`
            link.href = dataUrl
            link.click()

            setShowSuccess(true)
            setTimeout(() => setShowSuccess(false), 2000)
        } catch (err) {
            console.error("Export failed:", err)
        } finally {
            setIsExporting(false)
        }
    }, [isExporting, containerRef, title])

    return (
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
    )
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50) || "summary"
}
