import type { Product } from '@/types'
import { formatCurrency } from '@/utils/formatCurrency'
import { fillWhatsAppTemplate } from '@/hooks/useWhatsApp'

const SITE_URL = 'https://divya-foods.vercel.app'

export function getProductShareUrl(slug: string): string {
  return `${SITE_URL}/products/${slug}`
}

export function buildProductShareMessage(template: string, product: Product, categoryName: string): string {
  return fillWhatsAppTemplate(template, {
    productName: product.name,
    description: product.description?.slice(0, 150) ?? '',
    price: formatCurrency(product.price),
    category: categoryName,
    availability: product.inStock ? 'In Stock' : 'Out of Stock',
    link: getProductShareUrl(product.slug),
  })
}
