import React, { lazy, Suspense } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ROUTES } from '@/constants/routes'
import RootLayout from '@/components/layout/RootLayout'
import { RequireRole } from '@/components/shared/RequireRole'

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
const ForgotPasswordPage = lazy(() => import('@/pages/Auth/ForgotPassword'))
const ResetPasswordPage  = lazy(() => import('@/pages/Auth/ResetPassword'))
const AdminDashboardPage  = lazy(() => import('@/pages/Admin/Dashboard'))
const AdminProductsPage   = lazy(() => import('@/pages/Admin/Products'))
const AdminAnalyticsPage  = lazy(() => import('@/pages/Admin/Analytics'))
const AdminCouponsPage    = lazy(() => import('@/pages/Admin/Coupons'))
const WishlistPage        = lazy(() => import('@/pages/Wishlist'))
const ReferralPage        = lazy(() => import('@/pages/Referral'))
const BundlesPage         = lazy(() => import('@/pages/Bundles'))
const RecipesPage         = lazy(() => import('@/pages/Recipes'))
const JapaneseGroceryPage = lazy(() => import('@/pages/JapaneseGrocery'))
const AboutPage             = lazy(() => import('@/pages/About'))
const AdminSettingsPage     = lazy(() => import('@/pages/Admin/Settings'))
const NotFoundPage        = lazy(() => import('@/pages/NotFound'))
const AdminOrdersPage     = lazy(() => import('@/pages/Admin/Orders'))
const AdminBundlesPage    = lazy(() => import('@/pages/Admin/Bundles'))
const AdminInventoryPage  = lazy(() => import('@/pages/Admin/Inventory'))
const LoyaltyPage         = lazy(() => import('@/pages/Loyalty'))
const FlashSalesPage      = lazy(() => import('@/pages/FlashSales'))
const SubscriptionsPage   = lazy(() => import('@/pages/Subscriptions'))
const TrackOrderPage      = lazy(() => import('@/pages/TrackOrder'))
const BusinessSolutionsPage = lazy(() => import('@/pages/BusinessSolutions'))
const BulkOrderPage       = lazy(() => import('@/pages/BulkOrder'))
const AdminBulkOrdersPage = lazy(() => import('@/pages/Admin/BulkOrders'))
const AdminGiftCardsPage  = lazy(() => import('@/pages/Admin/GiftCards'))
const AdminDriversPage    = lazy(() => import('@/pages/Admin/Drivers'))
const AdminUsersPage      = lazy(() => import('@/pages/Admin/Users'))
const DriverDashboardPage = lazy(() => import('@/pages/Driver'))

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
      { path: ROUTES.REFERRAL, element: wrap(<ReferralPage />) },
      { path: ROUTES.BUNDLES, element: wrap(<BundlesPage />) },
      { path: ROUTES.LOYALTY, element: wrap(<LoyaltyPage />) },
      { path: ROUTES.FLASH_SALES, element: wrap(<FlashSalesPage />) },
      { path: ROUTES.SUBSCRIPTIONS, element: wrap(<SubscriptionsPage />) },
      { path: ROUTES.RECIPES, element: wrap(<RecipesPage />) },
      { path: ROUTES.JAPANESE_GROCERY, element: wrap(<JapaneseGroceryPage />) },
      { path: ROUTES.ABOUT, element: wrap(<AboutPage />) },
      { path: ROUTES.TRACK_ORDER, element: wrap(<TrackOrderPage />) },
      { path: ROUTES.BUSINESS_SOLUTIONS, element: wrap(<BusinessSolutionsPage />) },
      { path: ROUTES.BULK_ORDER, element: wrap(<BulkOrderPage />) },
    ],
  },
  { path: ROUTES.AUTH.LOGIN, element: wrap(<LoginPage />) },
  { path: ROUTES.AUTH.REGISTER, element: wrap(<RegisterPage />) },
  { path: ROUTES.AUTH.FORGOT_PASSWORD, element: wrap(<ForgotPasswordPage />) },
  { path: ROUTES.AUTH.RESET_PASSWORD, element: wrap(<ResetPasswordPage />) },
  { path: ROUTES.ADMIN.DASHBOARD,  element: wrap(<AdminDashboardPage />) },
  { path: ROUTES.ADMIN.PRODUCTS,   element: wrap(<AdminProductsPage />) },
  { path: ROUTES.ADMIN.ANALYTICS,  element: wrap(<AdminAnalyticsPage />) },
  { path: ROUTES.ADMIN.COUPONS,    element: wrap(<AdminCouponsPage />) },
  { path: ROUTES.ADMIN.ORDERS,    element: wrap(<AdminOrdersPage />) },
  { path: ROUTES.ADMIN.BUNDLES,   element: wrap(<AdminBundlesPage />) },
  { path: ROUTES.ADMIN.SETTINGS,  element: wrap(<AdminSettingsPage />) },
  { path: ROUTES.ADMIN.INVENTORY, element: wrap(<AdminInventoryPage />) },
  { path: ROUTES.ADMIN.BULK_ORDERS, element: wrap(<AdminBulkOrdersPage />) },
  { path: ROUTES.ADMIN.GIFT_CARDS, element: wrap(<AdminGiftCardsPage />) },
  { path: ROUTES.ADMIN.DRIVERS, element: wrap(<AdminDriversPage />) },
  { path: ROUTES.ADMIN.USERS, element: wrap(<AdminUsersPage />) },
  {
    path: ROUTES.DRIVER,
    element: wrap(<RequireRole roles={['driver', 'admin']}><DriverDashboardPage /></RequireRole>),
  },
  { path: '*', element: wrap(<NotFoundPage />) },
])

export function AppRouter() {
  return <RouterProvider router={router} />
}
