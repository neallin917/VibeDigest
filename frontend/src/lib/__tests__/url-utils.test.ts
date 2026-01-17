import { describe, it, expect } from 'vitest'
import { detectVideoURLs, hasMultipleURLs, extractYouTubeID } from '../url-utils'

describe('URL Utils', () => {
  describe('detectVideoURLs', () => {
    it('detects standard YouTube URLs', () => {
      const text = 'Check this out: https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      expect(detectVideoURLs(text)).toEqual(['https://www.youtube.com/watch?v=dQw4w9WgXcQ'])
    })

    it('detects short YouTube URLs (youtu.be)', () => {
      const text = 'Short link: https://youtu.be/dQw4w9WgXcQ'
      expect(detectVideoURLs(text)).toEqual(['https://youtu.be/dQw4w9WgXcQ'])
    })

    it('detects Bilibili URLs', () => {
      const text = 'Bili video https://www.bilibili.com/video/BV1GJ411x7h7'
      expect(detectVideoURLs(text)).toEqual(['https://www.bilibili.com/video/BV1GJ411x7h7'])
    })

    it('detects multiple URLs in one string', () => {
      const text = 'Watch https://youtu.be/abc12345678 and https://www.bilibili.com/video/BV1234567890'
      const urls = detectVideoURLs(text)
      expect(urls).toHaveLength(2)
      expect(urls).toContain('https://youtu.be/abc12345678')
      expect(urls).toContain('https://www.bilibili.com/video/BV1234567890')
    })

    it('returns empty array when no URLs present', () => {
      expect(detectVideoURLs('Just some normal text here.')).toEqual([])
    })
  })

  describe('hasMultipleURLs', () => {
    it('returns true for multiple URLs', () => {
      expect(hasMultipleURLs('Link 1: https://youtu.be/dQw4w9WgXcQ Link 2: https://youtu.be/abc12345678')).toBe(true)
    })

    it('returns false for single URL', () => {
      expect(hasMultipleURLs('Just one https://youtu.be/abc')).toBe(false)
    })

    it('returns false for no URLs', () => {
      expect(hasMultipleURLs('No links here')).toBe(false)
    })
  })

  describe('extractYouTubeID', () => {
    it('extracts ID from standard URL', () => {
      expect(extractYouTubeID('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('extracts ID from short URL', () => {
      expect(extractYouTubeID('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    })

    it('returns null for non-YouTube URL', () => {
      expect(extractYouTubeID('https://google.com')).toBe(null)
    })
  })
})
