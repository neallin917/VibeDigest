"use client"

import { useState, useCallback, useRef, useEffect, RefObject } from "react"
import { createPortal } from "react-dom"
import { Share2, Camera, Copy, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toPng } from "html-to-image"

interface SummaryShareButtonProps {
    containerRef: RefObject<HTMLElement | null>
    title: string
    onCopyMarkdown: () => Promise<void>
    t: (key: string, vars?: Record<string, string | number>) => string
}

export function SummaryShareButton({ containerRef, title, onCopyMarkdown, t }: SummaryShareButtonProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isExporting, setIsExporting] = useState(false)
    const [showSuccess, setShowSuccess] = useState<"image" | "markdown" | null>(null)
    const buttonRef = useRef<HTMLButtonElement>(null)
    const menuRef = useRef<HTMLDivElement>(null)

    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

    // Position menu relative to button
    useEffect(() => {
        if (!isOpen || !buttonRef.current || !menuRef.current) return

        const rect = buttonRef.current.getBoundingClientRect()
        menuRef.current.style.top = `${rect.bottom + 8}px`
        menuRef.current.style.right = `${window.innerWidth - rect.right}px`
    }, [isOpen])

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return

        const handleClick = (e: MouseEvent) => {
            if (buttonRef.current?.contains(e.target as Node)) return
            if (menuRef.current?.contains(e.target as Node)) return
            setIsOpen(false)
        }

        document.addEventListener('click', handleClick, true)
        return () => document.removeEventListener('click', handleClick, true)
    }, [isOpen])

    const handleExportImage = useCallback(async () => {
        if (isExporting || !containerRef.current) return
        setIsExporting(true)
        setIsOpen(false)

        try {
            const element = containerRef.current

            // Hide action buttons before capture
            const buttons = element.querySelectorAll('[data-export-hide="true"]') as NodeListOf<HTMLElement>
            buttons.forEach(btn => btn.style.visibility = 'hidden')

            // Append Brand Footer
            const footer = document.createElement('div')
            footer.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; padding-top: 24px; padding-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 24px;">
                    <span style="font-weight: 700; font-size: 16px; color: white;">VibeData</span>
                    <span style="width: 4px; height: 4px; background: #666; border-radius: 50%;"></span>
                    <span style="color: #888; font-size: 13px;">AI Video Assistant</span>
                </div>
            `
            element.appendChild(footer)

            // Capture the DOM element
            const dataUrl = await toPng(element, {
                backgroundColor: '#0A0A0A',
                pixelRatio: 2,
                quality: 0.95,
                skipFonts: true,
            })

            // Cleanup
            if (footer.parentNode === element) {
                element.removeChild(footer)
            }
            buttons.forEach(btn => btn.style.visibility = '')

            if (isMobile) {
                // Mobile: Open image in new tab for easy long-press save
                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=3">
    <title>${t("tasks.longPressToSave")}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            min-height: 100vh;
            background: #000;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            padding-top: 70px;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        }
        .header {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 56px;
            background: rgba(0,0,0,0.9);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            z-index: 100;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .close-btn {
            background: rgba(255,255,255,0.1);
            border: none;
            color: #fff;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .close-btn:active {
            background: rgba(255,255,255,0.2);
        }
        .header-title {
            color: #10B981;
            font-size: 14px;
            font-weight: 600;
        }
        .hint {
            color: #10B981;
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            text-align: center;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
        }
        .arrow {
            font-size: 32px;
            margin-bottom: 16px;
            animation: bounce 1s infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(10px); }
        }
        img {
            max-width: 100%;
            height: auto;
            border-radius: 16px;
            border: 3px solid #10B981;
            box-shadow: 0 0 40px rgba(16, 185, 129, 0.3);
        }
        .close-hint {
            color: #666;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <button class="close-btn" onclick="window.close()">← ${t("tasks.goBack")}</button>
        <span class="header-title">VibeDigest</span>
    </div>
    <div class="hint">👇 ${t("tasks.longPressToSave")}</div>
    <div class="arrow">⬇️</div>
    <img src="${dataUrl}" alt="Summary">
    <p class="close-hint">${t("tasks.closeTabAfterSave")}</p>
</body>
</html>
`
                const blob = new Blob([htmlContent], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                window.open(url, '_blank')
                setTimeout(() => URL.revokeObjectURL(url), 60000)
            } else {
                // Desktop: direct download
                const link = document.createElement('a')
                link.download = `${sanitizeFilename(title)}.png`
                link.href = dataUrl
                link.click()
            }

            setShowSuccess("image")
            setTimeout(() => setShowSuccess(null), 2000)
        } catch (err) {
            console.error("Export failed:", err)
        } finally {
            setIsExporting(false)
        }
    }, [isExporting, containerRef, title, isMobile, t])

    const handleCopyMarkdown = useCallback(async () => {
        setIsOpen(false)
        await onCopyMarkdown()
        setShowSuccess("markdown")
        setTimeout(() => setShowSuccess(null), 2000)
    }, [onCopyMarkdown])

    return (
        <div className="relative" data-export-hide="true">
            <Button
                ref={buttonRef}
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 bg-black/50 hover:bg-black/70 text-muted-foreground hover:text-white border border-white/10 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
                disabled={isExporting}
            >
                {isExporting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : showSuccess ? (
                    <Check className="h-4 w-4 text-green-500" />
                ) : (
                    <Share2 className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                    {showSuccess === "image"
                        ? t("tasks.exported")
                        : showSuccess === "markdown"
                            ? t("tasks.copied")
                            : t("tasks.share")}
                </span>
                <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>

            {/* Dropdown Menu - Rendered via Portal to body */}
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-[9999] min-w-[180px] rounded-lg border border-white/10 bg-[#1A1A1A] shadow-xl overflow-hidden"
                    style={{ top: 0, right: 0 }}
                >
                    <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors"
                        onClick={handleExportImage}
                    >
                        <Camera className="h-4 w-4 text-primary" />
                        {t("tasks.exportAsImage")}
                    </button>
                    <div className="h-px bg-white/10" />
                    <button
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors"
                        onClick={handleCopyMarkdown}
                    >
                        <Copy className="h-4 w-4 text-primary" />
                        {t("tasks.copyToClipboard")}
                    </button>
                </div>,
                document.body
            )}
        </div>
    )
}

function sanitizeFilename(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s-]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 50) || "summary"
}
