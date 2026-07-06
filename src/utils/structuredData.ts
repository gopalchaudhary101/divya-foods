/**
 * Shared schema.org JSON-LD builders — BreadcrumbList and FAQPage.
 * Product/Organization/WebSite JSON-LD already exist inline where they're used
 * (ProductDetail, Home); these two are shared here since breadcrumbs and FAQs
 * both appear on more than one page with the same shape.
 */

export interface BreadcrumbItem {
  name: string
  url: string
}

export function getBreadcrumbLD(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

export interface FAQItem {
  question: string
  answer: string
}

export function getFAQLD(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
