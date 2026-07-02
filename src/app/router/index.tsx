import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import RootLayout from '@/components/layout/RootLayout'

// Lazy loading — each page is a separate JS chunk loaded on demand
const HomePage = lazy(() => import('@/pages/Home'))
const ProductsPage = lazy(() => import('@/pages/Products'))
const ProductDetailPage = lazy(() => import('@/pages/ProductDetail'))
const CartPage = lazy(() => import('@/pages/Cart'))
const CheckoutPage = lazy(() => import('@/pages/Checkout'))
const OrdersPage = lazy(() => import('@/pages/Orders'))
const ProfilePage = lazy(() => import('@/pages/Profile'))
const LoginPage = lazy(() => import('@/pages/Auth/Login'))
const RegisterPage = lazy(() => import('@/pages/Auth/Register'))
const AdminDashboardPage  = lazy(() => import('@/pages/Admin/Dashboard'))
const AdminProductsPage   = lazy(() => import('@/pages/Admin/Products'))
const AdminAnalyticsPage  = lazy(() => import('@/pages/Admin/Analytics'))
const WishlistPage = lazy(() => import('@/pages/Wishlist'))
const RecipesPage  = lazy(() => import('@/pages/Recipes'))
const NotFoundPage = lazy(() => import('@/pages/NotFound'))

const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-ocean-50">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-ocean-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-ocean-700 font-medium text-sm">Loading...</p>
    </div>
  </div>
)

const wrap = (element: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{element}</Suspense>
)

const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: <RootLayout />,
    children: [
      { index: true, element: wrap(<HomePage />) },
      { path: ROUTES.PRODUCTS, element: wrap(<ProductsPage />) },
      { path: ROUTES.PRODUCT_DETAIL, element: wrap(<ProductDetailPage />) },
      { path: ROUTES.CART, element: wrap(<CartPage />) },
      { path: ROUTES.WISHLIST, element: wrap(<WishlistPage />) },
      { path: ROUTES.CHECKOUT, element: wrap(<CheckoutPage />) },
      { path: ROUTES.ORDERS, element: wrap(<OrdersPage />) },
      { path: ROUTES.ORDER_DETAIL, element: wrap(<OrdersPage />) },
      { path: ROUTES.PROFILE, element: wrap(<ProfilePage />) },
      { path: ROUTES.RECIPES, element: wrap(<RecipesPage />) },
    ],
  },
  { path: ROUTES.AUTH.LOGIN, element: wrap(<LoginPage />) },
  { path: ROUTES.AUTH.REGISTER, element: wrap(<RegisterPage />) },
  { path: ROUTES.ADMIN.DASHBOARD,  element: wrap(<AdminDashboardPage />) },
  { path: ROUTES.ADMIN.PRODUCTS,   element: wrap(<AdminProductsPage />) },
  { path: ROUTES.ADMIN.ANALYTICS,  element: wrap(<AdminAnalyticsPage />) },
  { path: '*', element: wrap(<NotFoundPage />) },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
