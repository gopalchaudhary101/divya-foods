import { describe, it, expect } from 'vitest'
import { getResponsiveImageUrl, getProductImageSrcSet } from './cloudinaryImage'

const CLOUDINARY_URL = 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,h_800,w_800/q_auto:good,f_auto/v1/divyafoods/products/abc.jpg'

describe('getResponsiveImageUrl', () => {
  it('replaces the width/height transformation segment', () => {
    expect(getResponsiveImageUrl(CLOUDINARY_URL, 400)).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,h_400,w_400/q_auto:good,f_auto/v1/divyafoods/products/abc.jpg',
    )
  })

  it('returns non-Cloudinary URLs unchanged', () => {
    const url = 'https://example.com/some-image.jpg'
    expect(getResponsiveImageUrl(url, 400)).toBe(url)
  })

  it('returns Cloudinary URLs without the expected transformation segment unchanged', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1/divyafoods/products/abc.jpg'
    expect(getResponsiveImageUrl(url, 400)).toBe(url)
  })
})

describe('getProductImageSrcSet', () => {
  it('builds a srcset string with default widths', () => {
    const srcSet = getProductImageSrcSet(CLOUDINARY_URL)
    expect(srcSet).toContain('h_150,w_150')
    expect(srcSet).toContain('150w')
    expect(srcSet).toContain('h_400,w_400')
    expect(srcSet).toContain('400w')
    expect(srcSet).toContain('h_800,w_800')
    expect(srcSet).toContain('800w')
  })

  it('builds a srcset string with custom widths', () => {
    const srcSet = getProductImageSrcSet(CLOUDINARY_URL, [200, 600])
    expect(srcSet.split(', ')).toHaveLength(2)
    expect(srcSet).toContain('200w')
    expect(srcSet).toContain('600w')
  })

  it('returns an empty string for non-Cloudinary URLs', () => {
    expect(getProductImageSrcSet('https://example.com/img.jpg')).toBe('')
  })

  it('builds a two-size srcset for static bulk-imported product photos', () => {
    const url = '/assets/products/seafood/blue-crabs/blue-crabs-01.webp'
    const srcSet = getProductImageSrcSet(url)
    expect(srcSet).toBe(
      '/assets/products/seafood/blue-crabs/blue-crabs-thumb.webp 300w, /assets/products/seafood/blue-crabs/blue-crabs-01.webp 1200w',
    )
  })

  it('returns an empty string for a static path that is not the numbered master image', () => {
    expect(getProductImageSrcSet('/assets/products/seafood/blue-crabs/blue-crabs-thumb.webp')).toBe('')
  })
})
