import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const SITE_URL = 'https://divya-foods.vercel.app'
const SITE_NAME = 'Divya Luxury Seafoods'
const DEFAULT_OG_IMAGE = `${SITE_URL}/icons/icon-512.png`

interface PageSEOProps {
  title: string
  description: string
  ogImage?: string
  ogType?: 'website' | 'product'
  children?: ReactNode
}

export function PageSEO({
  title,
  description,
  ogImage,
  ogType = 'website',
  children,
}: PageSEOProps) {
  const { pathname } = useLocation()
  const canonical = `${SITE_URL}${pathname}`
  const image = ogImage ?? DEFAULT_OG_IMAGE

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="512" />
      <meta property="og:image:height" content="512" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {children}
    </Helmet>
  )
}
