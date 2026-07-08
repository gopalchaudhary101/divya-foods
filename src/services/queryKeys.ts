/**
 * Centralized React Query key factory.
 *
 * WHY THIS MATTERS:
 * React Query uses arrays as cache keys. If you write ['products', slug]
 * in ProductDetailPage and ['products', slug] in RelatedProducts, they share
 * the same cache — no duplicate fetch. But if you typo one as ['product', slug],
 * they get different caches and you fetch twice.
 *
 * This factory ensures every key is spelled consistently and is TypeScript-checked.
 * Invalidating all product queries is just:
 *   queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
 */

export const queryKeys = {
  // ─── Products ─────────────────────────────────────────────────────────────
  products: {
    all: () => ['products'] as const,
    list: (filters?: unknown) => ['products', 'list', filters] as const,
    detail: (slug: string) => ['products', 'detail', slug] as const,
    featured: () => ['products', 'featured'] as const,
    bestSellers: () => ['products', 'best-sellers'] as const,
    search: (query: string) => ['products', 'search', query] as const,
  },

  // ─── Categories ───────────────────────────────────────────────────────────
  categories: {
    all: () => ['categories'] as const,
    detail: (slug: string) => ['categories', 'detail', slug] as const,
  },

  // ─── Auth / User ──────────────────────────────────────────────────────────
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  user: {
    profile: () => ['user', 'profile'] as const,
    addresses: () => ['user', 'addresses'] as const,
  },

  // ─── Cart ─────────────────────────────────────────────────────────────────
  cart: {
    all: () => ['cart'] as const,
  },

  // ─── Wishlist ─────────────────────────────────────────────────────────────
  wishlist: {
    all: () => ['wishlist'] as const,
  },

  // ─── Orders ───────────────────────────────────────────────────────────────
  orders: {
    all: () => ['orders'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },

  // ─── Returns ──────────────────────────────────────────────────────────────
  returns: {
    forOrder: (orderId: string) => ['returns', 'for-order', orderId] as const,
  },

  // ─── Reviews ──────────────────────────────────────────────────────────────
  reviews: {
    byProduct:  (productId: string) => ['reviews', productId] as const,
    canReview:  (productId: string) => ['reviews', 'can-review', productId] as const,
  },

  // ─── Banners ──────────────────────────────────────────────────────────────
  banners: {
    active: () => ['banners', 'active'] as const,
  },

  // ─── Admin ────────────────────────────────────────────────────────────────
  admin: {
    dashboard: () => ['admin', 'dashboard'] as const,
    products: (filters?: unknown) => ['admin', 'products', filters] as const,
    orders: (filters?: unknown) => ['admin', 'orders', filters] as const,
    customers: () => ['admin', 'customers'] as const,
    analytics: () => ['admin', 'analytics'] as const,
  },

  // ─── Q&A ──────────────────────────────────────────────────────────────────
  qa: (productId: string) => ['qa', productId] as const,

  // ─── Subscriptions ────────────────────────────────────────────────────────
  subscriptions: {
    all: () => ['subscriptions'] as const,
  },

  // ─── Loyalty ──────────────────────────────────────────────────────────────
  loyalty: {
    balance: () => ['loyalty', 'balance'] as const,
    membership: () => ['loyalty', 'membership'] as const,
  },

  // ─── Flash Sales ──────────────────────────────────────────────────────────
  flashSales: {
    all: () => ['flash-sales'] as const,
  },
} as const
