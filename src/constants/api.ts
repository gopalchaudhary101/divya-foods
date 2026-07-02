export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    ME: '/auth/me',
  },
  PRODUCTS: {
    LIST: '/products',
    DETAIL: (slug: string) => `/products/${slug}`,
    FEATURED: '/products/featured',
    BEST_SELLERS: '/products/best-sellers',
    SEARCH: '/products/search',
  },
  CATEGORIES: {
    LIST: '/categories',
    DETAIL: (slug: string) => `/categories/${slug}`,
  },
  CART: {
    GET: '/cart',
    ADD: '/cart/add',
    UPDATE: '/cart/update',
    REMOVE: '/cart/remove',
    CLEAR: '/cart/clear',
  },
  ORDERS: {
    LIST: '/orders',
    CREATE: '/orders',
    DETAIL: (id: string) => `/orders/${id}`,
    CANCEL: (id: string) => `/orders/${id}/cancel`,
    INVOICE: (id: string) => `/orders/${id}/invoice`,
  },
  USERS: {
    PROFILE: '/users/profile',
    ADDRESSES: '/users/addresses',
    WISHLIST: '/users/wishlist',
  },
  REVIEWS: {
    LIST: (productId: string) => `/reviews/${productId}`,
    CREATE: '/reviews',
  },
  COUPONS: {
    VALIDATE: '/coupons/validate',
  },
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    PRODUCTS: '/admin/products',
    ORDERS: '/admin/orders',
    CUSTOMERS: '/admin/customers',
    ANALYTICS: '/admin/analytics',
    BANNERS: '/admin/banners',
    COUPONS: '/admin/coupons',
  },
} as const
