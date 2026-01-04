"use client"

import { useState, useCallback, useRef, useEffect, RefObject } from "react"
import { createPortal } from "react-dom"
import { Share2, Camera, Copy, Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toPng } from "html-to-image"

interface SummaryShareButtonProps {
    containerRef: RefObject<HTMLElement | null>
    title: string
    coverUrl?: string
    onCopyMarkdown: () => Promise<void>
    t: (key: string, vars?: Record<string, string | number>) => string
}

export function SummaryShareButton({ containerRef, title, coverUrl, onCopyMarkdown, t }: SummaryShareButtonProps) {
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

        // Keep track of what we need to clean up
        let cloneContainer: HTMLElement | null = null

        try {
            const originalElement = containerRef.current

            // 1. Create a hidden container for the clone
            // We append to body to ensure it has a DOM context for rendering
            // Position it fixed behind everything. 
            // NOTE: Do NOT use opacity: 0 or visibility: hidden, as html-to-image might capture that state.
            cloneContainer = document.createElement('div')
            cloneContainer.style.position = 'fixed'
            cloneContainer.style.top = '0'
            cloneContainer.style.left = '0'
            // Match the width to ensure consistent layout
            cloneContainer.style.width = `${originalElement.offsetWidth}px`
            cloneContainer.style.zIndex = '-9999'
            // Point events none to avoid interfering with mouse
            cloneContainer.style.pointerEvents = 'none'
            document.body.appendChild(cloneContainer)

            // 2. Clone the content
            const clonedElement = originalElement.cloneNode(true) as HTMLElement
            // Ensure background color is set on the clone if transparent
            clonedElement.style.backgroundColor = '#0A0A0A'
            clonedElement.style.borderRadius = '0' // Reset if needed, or keep
            cloneContainer.appendChild(clonedElement)

            // 3. Hide action buttons in the clone
            const buttons = clonedElement.querySelectorAll('[data-export-hide="true"]') as NodeListOf<HTMLElement>
            buttons.forEach(btn => btn.style.visibility = 'hidden')

            // 4. Append Brand Footer
            const footer = document.createElement('div')
            footer.innerHTML = `
                <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding-top: 24px; padding-bottom: 8px; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 24px;">
                    <span style="font-weight: 700; font-size: 16px; color: white;">VibeDigest.ai</span>
                    <span style="color: #888; font-size: 13px;">AI Podcast Assistant</span>
                </div>
            `
            clonedElement.appendChild(footer)


            // 5. Preload cover image and Prepend Header
            let coverDataUrl: string | null = null
            if (coverUrl) {
                try {
                    console.log('[Export] Fetching cover image via proxy:', coverUrl)
                    // Use our proxy API to bypass CORS restrictions
                    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(coverUrl)}`
                    const response = await fetch(proxyUrl)
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    const blob = await response.blob()
                    coverDataUrl = await new Promise((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.readAsDataURL(blob)
                    })
                    console.log('[Export] Cover image converted to data URL successfully')
                } catch (e) {
                    console.warn('[Export] Failed to preload cover image:', e)
                    // Cover will not be included if fetch fails
                    coverDataUrl = null
                }
            }

            const header = document.createElement('div')
            header.style.marginBottom = '24px'
            header.style.display = 'flex'
            header.style.flexDirection = 'column'
            header.style.gap = '16px'

            // Build header: Title first, then Cover Image (matching page layout)
            let headerHTML = `
                <h1 style="font-size: 24px; font-weight: 700; line-height: 1.3; color: white; margin: 0;">
                    ${title}
                </h1>
            `
            if (coverDataUrl) {
                headerHTML += `
                    <div style="width: 100%; overflow: hidden; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);">
                        <img src="${coverDataUrl}" style="width: 100%; height: auto; max-height: 300px; object-fit: cover; display: block;" data-cover-image="true" />
                    </div>
                `
            }
            header.innerHTML = headerHTML
            clonedElement.insertBefore(header, clonedElement.firstChild)

            // Force reflow/wait for images
            void clonedElement.offsetHeight

            // Wait for header image to load (it's a data URL so should be instant)
            if (coverDataUrl) {
                const img = header.querySelector('img')
                if (img && !img.complete) {
                    await new Promise(resolve => {
                        if (!img) { resolve(null); return; }
                        img.onload = resolve
                        img.onerror = resolve
                        setTimeout(resolve, 3000)
                    })
                }
            }

            // Quick pause to ensure DOM settle
            await new Promise(resolve => setTimeout(resolve, 100))

            // Validate dimensions before capture
            const width = clonedElement.offsetWidth
            const height = clonedElement.offsetHeight
            console.log('[Export] Clone dimensions:', { width, height })

            if (width === 0 || height === 0) {
                throw new Error(`Invalid element dimensions: ${width}x${height}`)
            }

            // 6. Pre-convert all OTHER images in clone to data URLs
            // Skip images already converted (data URLs) and the cover image we just added
            const allImages = clonedElement.querySelectorAll('img:not([data-cover-image])') as NodeListOf<HTMLImageElement>
            console.log('[Export] Found other images to process:', allImages.length)

            for (const img of Array.from(allImages)) {
                const src = img.src
                // Skip if already a data URL or empty
                if (!src || src.startsWith('data:')) continue

                try {
                    // Use proxy for external images to bypass CORS
                    const fetchUrl = src.startsWith('http')
                        ? `/api/image-proxy?url=${encodeURIComponent(src)}`
                        : src
                    const response = await fetch(fetchUrl)
                    if (!response.ok) throw new Error(`HTTP ${response.status}`)
                    const blob = await response.blob()
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result as string)
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                    })
                    img.src = dataUrl
                } catch (e) {
                    console.warn('[Export] Failed to convert image, removing:', src, e)
                    // Remove non-cover images that can't be converted
                    img.remove()
                }
            }

            // Wait for all converted images to be painted
            await new Promise(resolve => setTimeout(resolve, 100))

            // 7. Capture
            const dataUrl = await toPng(clonedElement, {
                backgroundColor: '#0A0A0A',
                pixelRatio: 2,
                quality: 0.95,
                skipFonts: true,
                style: {
                    margin: '0',
                }
            })

            // 7. Handle Download / Share
            if (isMobile) {
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
        <button class="close-btn" style="color: white; background: rgba(255,255,255,0.1); border:none; padding:8px 16px; border-radius:8px;" onclick="window.close()">← ${t("tasks.goBack")}</button>
        <span class="header-title" style="color:#10B981; font-weight:600;">VibeDigest</span>
    </div>
    <div style="color:#10B981; margin-bottom:20px; font-weight:600; text-align:center;">👇 ${t("tasks.longPressToSave")}</div>
    <img src="${dataUrl}" alt="Summary" style="max-width:100%; border:3px solid #10B981; border-radius:16px;">
    <p style="color:#666; margin-top:20px; font-size:14px;">${t("tasks.closeTabAfterSave")}</p>
</body>
</html>
`
                const blob = new Blob([htmlContent], { type: 'text/html' })
                const url = URL.createObjectURL(blob)
                window.open(url, '_blank')
                // Revoke after a somewhat longer delay to ensure mobile browser loads it
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
            // Log additional details - handle both Error and non-Error types
            if (err instanceof Error) {
                console.error("Error details:", err.message, err.stack)
            } else {
                // Try to serialize as JSON for non-Error objects (e.g., DOMException, security errors)
                try {
                    console.error("Error (serialized):", JSON.stringify(err, Object.getOwnPropertyNames(err as object)))
                } catch {
                    console.error("Error type:", typeof err, Object.prototype.toString.call(err))
                }
            }
        } finally {
            // Guarantee cleanup
            if (cloneContainer && cloneContainer.parentNode) {
                cloneContainer.parentNode.removeChild(cloneContainer)
            }
            setIsExporting(false)
        }
    }, [isExporting, containerRef, title, isMobile, t, coverUrl])

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
