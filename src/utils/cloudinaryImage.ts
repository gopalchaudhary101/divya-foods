/**
 * Builds responsive-size variants of a Cloudinary product image URL for use in
 * `srcSet`, so the browser downloads only as many pixels as the viewport needs
 * (smaller payload on mobile networks → better LCP/FCP) instead of always
 * fetching the fixed 800×800 master image the /upload endpoint stores.
 *
 * Every image URL in this app comes from our own POST /upload endpoints, which
 * always embed a `c_fill,g_auto,h_800,w_800` transformation segment — so a
 * targeted string replace of that segment is reliable here (this isn't a
 * general-purpose Cloudinary URL parser).
 */

const TRANSFORM_RE = /\/c_fill,g_auto,h_\d+,w_\d+\//

export function getResponsiveImageUrl(url: string, width: number): string {
  if (!url.includes('res.cloudinary.com') || !TRANSFORM_RE.test(url)) return url
  return url.replace(TRANSFORM_RE, `/c_fill,g_auto,h_${width},w_${width}/`)
}

export function getProductImageSrcSet(url: string, widths: number[] = [150, 400, 800]): string {
  if (!url.includes('res.cloudinary.com') || !TRANSFORM_RE.test(url)) return ''
  return widths.map(w => `${getResponsiveImageUrl(url, w)} ${w}w`).join(', ')
}
