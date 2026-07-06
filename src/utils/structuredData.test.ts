import { describe, it, expect } from 'vitest'
import { getBreadcrumbLD, getFAQLD } from './structuredData'

describe('getBreadcrumbLD', () => {
  it('builds a valid BreadcrumbList schema with 1-based positions', () => {
    const ld = getBreadcrumbLD([
      { name: 'Home', url: 'https://example.com' },
      { name: 'Products', url: 'https://example.com/products' },
      { name: 'Salmon', url: 'https://example.com/products/salmon' },
    ])

    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('BreadcrumbList')
    expect(ld.itemListElement).toHaveLength(3)
    expect(ld.itemListElement[0]).toEqual({ '@type': 'ListItem', position: 1, name: 'Home', item: 'https://example.com' })
    expect(ld.itemListElement[2]).toEqual({ '@type': 'ListItem', position: 3, name: 'Salmon', item: 'https://example.com/products/salmon' })
  })
})

describe('getFAQLD', () => {
  it('builds a valid FAQPage schema', () => {
    const ld = getFAQLD([
      { question: 'Is it fresh?', answer: 'Yes, always.' },
    ])

    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity[0]).toEqual({
      '@type': 'Question',
      name: 'Is it fresh?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes, always.' },
    })
  })
})
