/**
 * Utility functions for URL detection and validation
 */

// Regex for extracting ID (no global flag)
const YOUTUBE_ID_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
const BILIBILI_ID_REGEX = /(?:https?:\/\/)?(?:www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/

// Global Regex for searching
const YOUTUBE_GLOBAL = new RegExp(YOUTUBE_ID_REGEX.source, 'g')
const BILIBILI_GLOBAL = new RegExp(BILIBILI_ID_REGEX.source, 'g')

/**
 * Detect all YouTube URLs in a string
 */
export function detectYouTubeURLs(text: string): string[] {
  const matches = text.match(YOUTUBE_GLOBAL)
  return matches || []
}

/**
 * Detect all Bilibili URLs in a string
 */
export function detectBilibiliURLs(text: string): string[] {
  const matches = text.match(BILIBILI_GLOBAL)
  return matches || []
}

/**
 * Detect all video URLs (YouTube + Bilibili)
 */
export function detectVideoURLs(text: string): string[] {
  return [
    ...detectYouTubeURLs(text),
    ...detectBilibiliURLs(text)
  ]
}

/**
 * Check if text contains multiple video URLs
 */
export function hasMultipleURLs(text: string): boolean {
  return detectVideoURLs(text).length > 1
}

/**
 * Extract video ID from YouTube URL
 */
export function extractYouTubeID(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX)
  return match ? match[1] : null
}
