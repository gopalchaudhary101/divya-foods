import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import axiosInstance from '@/services/api/axiosInstance'
import { queryKeys } from '@/services/queryKeys'
import CountdownTimer from '@/components/shared/CountdownTimer'
import type { Product } from '@/types'
import { ROUTES } from '@/constants/routes'
import { useDispatch } from 'react-redux'
import { addToCart } from '@/features/cart/cartSlice'

type FlashProduct = Pick<Product, 'id' | 'name' | 'slug' | 'price' | 'salePrice' | 'saleEndsAt' | 'images' | 'brand' | 'rating' | 'reviewCount' | 'inStock' | 'stockQuantity'>

export default function FlashSalesPage() {
  const dispatch = useDispatch()

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.flashSales.all(),
    queryFn: async () => {
      const res = await axiosInstance.get<{ success: boolean; data: FlashProduct[] }>('/flash-sales')
      return res.data.data
    },
    refetchInterval: 60_000,
  })

  const items = data ?? []

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/10 py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold mb-3">
            <Zap size={14} fill="white" />
            Limited Time Deals
          </div>
          <h1 className="text-3xl font-bold text-ocean-900 dark:text-ocean-100">Flash Sales</h1>
          <p className="text-ocean-500 mt-1">Prices drop — grab them before the timer runs out!</p>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse bg-white dark:bg-ocean-900 rounded-2xl h-64" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-20 text-ocean-400">
            <Zap size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No flash sales right now</p>
            <p className="text-sm mt-1">Check back soon — deals drop without warning!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
            {items.map((item, i) => {
              const savings = item.salePrice ? Math.round(((item.price - item.salePrice) / item.price) * 100) : 0
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-ocean-900 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <Link to={ROUTES.PRODUCT_DETAIL.replace(':slug', item.slug)} className="block relative">
                    <img
                      src={item.images[0] || '/placeholder.png'}
                      alt={item.name}
                      className="w-full h-40 object-cover"
                    />
                    {savings > 0 && (
                      <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        -{savings}%
                      </span>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="p-3 space-y-2">
                    <p className="text-sm font-medium text-ocean-900 dark:text-ocean-100 line-clamp-2">{item.name}</p>
                    {item.brand && <p className="text-xs text-ocean-400">{item.brand}</p>}

                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-red-600">₹{item.salePrice?.toLocaleString()}</span>
                      <span className="text-xs text-ocean-400 line-through">₹{item.price.toLocaleString()}</span>
                    </div>

                    {item.saleEndsAt && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-ocean-400">Ends in:</span>
                        <CountdownTimer endsAt={item.saleEndsAt} onExpire={() => refetch()} />
                      </div>
                    )}

                    <button
                      onClick={() =>
                        dispatch(
                          addToCart({
                            productId: item.id,
                            name: item.name,
                            price: item.salePrice ?? item.price,
                            quantity: 1,
                            image: item.images[0] || '',
                            maxQuantity: item.stockQuantity,
                          })
                        )
                      }
                      disabled={!item.inStock}
                      className="w-full py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {item.inStock ? 'Add to Cart' : 'Out of Stock'}
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
