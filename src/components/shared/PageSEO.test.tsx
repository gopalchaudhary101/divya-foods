import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { MemoryRouter } from 'react-router-dom'
import { PageSEO } from './PageSEO'

function renderSEO(props: React.ComponentProps<typeof PageSEO>) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/products/salmon']}>
        <PageSEO {...props} />
      </MemoryRouter>
    </HelmetProvider>
  )
}

describe('PageSEO', () => {
  it('sets the document title', async () => {
    renderSEO({ title: 'Norwegian Salmon | Divya Foods', description: 'Fresh salmon' })
    await waitFor(() => expect(document.title).toBe('Norwegian Salmon | Divya Foods'))
  })

  it('sets a canonical link using the current pathname', async () => {
    renderSEO({ title: 'T', description: 'D' })
    await waitFor(() => {
      const link = document.querySelector('link[rel="canonical"]')
      expect(link?.getAttribute('href')).toBe('https://divya-foods.vercel.app/products/salmon')
    })
  })

  it('defaults the og:image when none is provided', async () => {
    renderSEO({ title: 'T', description: 'D' })
    await waitFor(() => {
      const meta = document.querySelector('meta[property="og:image"]')
      expect(meta?.getAttribute('content')).toContain('/icons/icon-512.png')
    })
  })

  it('uses a custom og:image when provided', async () => {
    renderSEO({ title: 'T', description: 'D', ogImage: 'https://cdn/custom.jpg' })
    await waitFor(() => {
      const meta = document.querySelector('meta[property="og:image"]')
      expect(meta?.getAttribute('content')).toBe('https://cdn/custom.jpg')
    })
  })
})
