import { describe, it, expect } from 'vitest'
import { withTrailingSlash } from '@/utils/url'

describe('url utilities', () => {
  describe('withTrailingSlash', () => {
    it('should add trailing slash if missing', () => {
      expect(withTrailingSlash('https://example.com')).toBe(
        'https://example.com/',
      )
      expect(withTrailingSlash('https://example.com/path')).toBe(
        'https://example.com/path/',
      )
      expect(withTrailingSlash('/local/path')).toBe('/local/path/')
    })

    it('should not add trailing slash if already present', () => {
      expect(withTrailingSlash('https://example.com/')).toBe(
        'https://example.com/',
      )
      expect(withTrailingSlash('https://example.com/path/')).toBe(
        'https://example.com/path/',
      )
      expect(withTrailingSlash('/local/path/')).toBe('/local/path/')
    })

    it('should handle root path', () => {
      expect(withTrailingSlash('/')).toBe('/')
    })

    it('should handle empty string', () => {
      expect(withTrailingSlash('')).toBe('/')
    })

    it('should handle URLs with query parameters', () => {
      expect(withTrailingSlash('https://example.com/path?query=value')).toBe(
        'https://example.com/path?query=value/',
      )
    })

    it('should handle URLs with hash fragments', () => {
      expect(withTrailingSlash('https://example.com/path#section')).toBe(
        'https://example.com/path#section/',
      )
    })
  })
})
