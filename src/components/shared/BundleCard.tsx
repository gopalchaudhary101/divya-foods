import React from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart, Package } from 'lucide-react'
import { formatCurrency } from '@/utils/formatCurrency'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { addToCart } from '@/features/cart/cartSlice'
import toast from 'react-hot-toast'

export interface BundleItem {
  productId: string
  quantity: number
  name: string
  image: string | null
  price: number
  slug: string
}

export interface Bundle {
  id: string
  name: string
  description: string
  image: string | null
  bundlePrice: number
  isActive: boolean
  items: BundleItem[]
  createdAt?: string
}

interface BundleCardProps {
  bundle: Bundle
}

export function BundleCard({ bundle }: BundleCardProps) {
  const dispatch = useAppDispatch()

  const originalTotal = bundle.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  )
  const savings = originalTotal - bundle.bundlePrice
  const savingsPct = originalTotal > 0 ? Math.round((savings / originalTotal) * 100) : 0

  function handleAddAll() {
    bundle.items.forEach(item => {
      dispatch(addToCart({
        productId: item.productId,
        name:      item.name,
        price:     bundle.bundlePrice / bundle.items.length,
        quantity:  item.quantity,
        image:     item.image ?? '',
        maxQuantity: 10,
      }))
    })
    toast.success(`${bundle.name} added to cart!`)
  }

  return (
    <div className="bg-white dark:bg-ocean-900 border border-premium-navy/10 dark:border-ocean-800 rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
      {/* Header image / gradient */}
      <div className="relative h-40 bg-gradient-to-br from-premium-navy to-[#1B3A4B] flex items-center justify-center">
        {bundle.image ? (
          <img src={bundle.image} alt={bundle.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex gap-2">
            {bundle.items.slice(0, 3).map(item =>
              item.image ? (
                <img
                  key={item.productId}
                  src={item.image}
                  alt={item.name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-white/30"
                />
              ) : (
                <div key={item.productId} className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center">
                  <Package size={24} className="text-white/50" />
                </div>
              ),
            )}
          </div>
        )}
        {savingsPct > 0 && (
          <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            Save {savingsPct}%
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="font-display font-semibold text-premium-navy dark:text-white text-base mb-1">{bundle.name}</h3>
        {bundle.description && (
          <p className="text-xs text-premium-navy/40 mb-3 line-clamp-2">{bundle.description}</p>
        )}

        {/* Items list */}
        <ul className="space-y-1 mb-4">
          {bundle.items.map(item => (
            <li key={item.productId} className="flex items-center justify-between text-xs">
              <Link
                to={`/products/${item.slug}`}
                className="text-premium-navy/70 dark:text-ocean-300 hover:text-premium-gold dark:hover:text-white truncate transition-colors"
              >
                {item.quantity > 1 && <span className="font-semibold mr-1">{item.quantity}×</span>}
                {item.name}
              </Link>
              <span className="text-premium-navy/40 ml-2 shrink-0">{formatCurrency(item.price)}</span>
            </li>
          ))}
        </ul>

        {/* Pricing + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-premium-navy/10 dark:border-ocean-800">
          <div>
            <span className="text-xl font-semibold text-premium-gold">{formatCurrency(bundle.bundlePrice)}</span>
            {savings > 0 && (
              <span className="ml-2 text-xs text-premium-navy/40 line-through">{formatCurrency(originalTotal)}</span>
            )}
          </div>
          <button
            onClick={handleAddAll}
            className="flex items-center gap-1.5 bg-premium-gold hover:bg-premium-gold-light text-premium-navy px-3 py-2 rounded-xl text-sm font-medium transition-colors"
          >
            <ShoppingCart size={14} /> Add Bundle
          </button>
        </div>
      </div>
    </div>
  )
}
