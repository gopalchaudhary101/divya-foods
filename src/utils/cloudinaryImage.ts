/**
 * Builds responsive-size variants of a product image URL for use in `srcSet`,
 * so the browser downloads only as many pixels as the viewport needs (smaller
 * payload on mobile networks → better LCP/FCP) instead of always fetching the
 * full master image.
 *
 * Two image sources exist in this app:
 *  - Cloudinary (admin-uploaded photos) — URLs always embed a
 *    `c_fill,g_auto,h_800,w_800` transformation segment, so a targeted string
 *    replace of that segment is reliable (this isn't a general-purpose
 *    Cloudinary URL parser).
 *  - Static bulk-imported photos under /assets/products/** — these ship
 *    exactly two real sizes per product, `<slug>-01.webp` (1200×1200) and
 *    `<slug>-thumb.webp` (300×300), produced by scripts/download_images.py.
 *    There's no on-the-fly resizing for these like Cloudinary, so the srcset
 *    offers exactly those two real files rather than fabricated widths.
 */

const TRANSFORM_RE = /\/c_fill,g_auto,h_\d+,w_\d+\//
const STATIC_PRODUCT_IMAGE_RE = /^(.+)-01\.webp$/

export function getResponsiveImageUrl(url: string, width: number): string {
  if (!url.includes('res.cloudinary.com') || !TRANSFORM_RE.test(url)) return url
  return url.replace(TRANSFORM_RE, `/c_fill,g_auto,h_${width},w_${width}/`)
}

export function getProductImageSrcSet(url: string, widths: number[] = [150, 400, 800]): string {
  if (url.includes('res.cloudinary.com') && TRANSFORM_RE.test(url)) {
    return widths.map(w => `${getResponsiveImageUrl(url, w)} ${w}w`).join(', ')
  }
  const staticMatch = url.match(STATIC_PRODUCT_IMAGE_RE)
  if (staticMatch) {
    return `${staticMatch[1]}-thumb.webp 300w, ${url} 1200w`
  }
  return ''
}
