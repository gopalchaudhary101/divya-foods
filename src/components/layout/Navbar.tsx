import React, { useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingCart, Heart, Sun, Moon, Menu, X,
  User, LogOut, Package, LayoutDashboard, ChevronDown, Search,
} from 'lucide-react'
import { useAppSelector } from '@/hooks/useAppSelector'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { toggleDarkMode, toggleMobileMenu, setCartOpen } from '@/store/slices/uiSlice'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { NotificationBell } from '@/components/shared/NotificationBell'
import { GlobalSearch, useGlobalSearch } from '@/components/shared/GlobalSearch'
import { CONFIG } from '@/constants/config'
import { ROUTES } from '@/constants/routes'

export default function Navbar() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const { isAuthenticated, user, isAdmin, logout } = useAuth()

  const isDarkMode = useAppSelector((s) => s.ui.isDarkMode)
  const isMobileMenuOpen = useAppSelector((s) => s.ui.isMobileMenuOpen)
  const cartCount = useAppSelector((s) => s.cart.totalItems)
  const wishlistCount = useAppSelector((s) => s.wishlist.productIds.length)

  const [isUserMenuOpen, setUserMenuOpen] = React.useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const { isOpen: searchOpen, open: openSearch, close: closeSearch } = useGlobalSearch()

  // Listen for the Ctrl/Cmd+K event dispatched by GlobalSearch
  useEffect(() => {
    const handler = () => openSearch()
    window.addEventListener('divya:search:open', handler)
    return () => window.removeEventListener('divya:search:open', handler)
  }, [openSearch])

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobileMenuOpen) dispatch(toggleMobileMenu())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'text-sm font-medium transition-colors',
      isActive
        ? 'text-gold-400'
        : 'text-ocean-100 hover:text-white',
    ].join(' ')

  const handleLogout = async () => {
    setUserMenuOpen(false)
    await logout()
  }

  return (
    <header className="sticky top-0 z-40 bg-ocean-900 shadow-lg">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

        {/* ── Logo ─────────────────────────────────────────────── */}
        <Link
          to={ROUTES.HOME}
          className="shrink-0 font-display text-xl font-semibold text-white hover:text-gold-400 transition-colors"
        >
          {CONFIG.APP_NAME}
        </Link>

        {/* ── Desktop nav links ────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-6">
          <NavLink to={ROUTES.PRODUCTS} className={navLinkClass}>
            Products
          </NavLink>
          <NavLink to={ROUTES.JAPANESE_GROCERY} className={navLinkClass}>
            🍱 Japanese
          </NavLink>
          <NavLink to={ROUTES.RECIPES} className={navLinkClass}>
            Recipes
          </NavLink>
          {isAuthenticated && (
            <NavLink to={ROUTES.ORDERS} className={navLinkClass}>
              My Orders
            </NavLink>
          )}
        </div>

        {/* ── Right actions ────────────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2">

          {/* Search */}
          <button
            onClick={openSearch}
            aria-label="Search products (Ctrl+K)"
            title="Search (Ctrl+K)"
            className="flex items-center gap-2 p-2.5 rounded-lg text-ocean-200 hover:text-white hover:bg-ocean-700 transition-colors"
          >
            <Search size={18} />
            <span className="hidden lg:inline-flex items-center gap-1 text-xs text-ocean-400 border border-ocean-700 rounded px-1.5 py-0.5">
              <span>⌘K</span>
            </span>
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={() => dispatch(toggleDarkMode())}
            aria-label="Toggle dark mode"
            className="p-2.5 rounded-lg text-ocean-200 hover:text-white hover:bg-ocean-700 transition-colors"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Wishlist */}
          <Link
            to={ROUTES.WISHLIST}
            aria-label={`Wishlist (${wishlistCount} items)`}
            className="relative p-2.5 rounded-lg text-ocean-200 hover:text-white hover:bg-ocean-700 transition-colors"
          >
            <Heart size={18} />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {wishlistCount > 9 ? '9+' : wishlistCount}
              </span>
            )}
          </Link>

          {/* Notification bell — authenticated users only */}
          <NotificationBell />

          {/* Cart */}
          <button
            onClick={() => dispatch(setCartOpen(true))}
            aria-label={`Cart (${cartCount} items)`}
            className="relative p-2.5 rounded-lg text-ocean-200 hover:text-white hover:bg-ocean-700 transition-colors"
          >
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>

          {/* Auth — desktop */}
          <div className="hidden md:block">
            {isAuthenticated ? (
              <div ref={userMenuRef} className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  aria-expanded={isUserMenuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-ocean-100 hover:text-white hover:bg-ocean-700 transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-400"
                >
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-ocean-700 flex items-center justify-center text-xs text-white font-bold" aria-hidden="true">
                      {user?.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                  )}
                  <span className="hidden lg:block max-w-[80px] truncate" aria-hidden="true">{user?.name}</span>
                  <ChevronDown size={14} className={`transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>

                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-ocean-800 rounded-xl shadow-premium border border-ocean-100 dark:border-ocean-700 overflow-hidden py-1"
                    >
                      <DropdownLink to={ROUTES.PROFILE} icon={<User size={14} />} onClick={() => setUserMenuOpen(false)}>
                        My Profile
                      </DropdownLink>
                      <DropdownLink to={ROUTES.ORDERS} icon={<Package size={14} />} onClick={() => setUserMenuOpen(false)}>
                        My Orders
                      </DropdownLink>
                      {isAdmin && (
                        <DropdownLink to={ROUTES.ADMIN.DASHBOARD} icon={<LayoutDashboard size={14} />} onClick={() => setUserMenuOpen(false)}>
                          Admin Panel
                        </DropdownLink>
                      )}
                      <hr className="my-1 border-ocean-100 dark:border-ocean-700" aria-hidden="true" />
                      <button
                        role="menuitem"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors focus-visible:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-900/20"
                      >
                        <LogOut size={14} aria-hidden="true" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to={ROUTES.AUTH.LOGIN}
                  className="text-sm text-ocean-200 hover:text-white transition-colors font-medium px-3 py-1.5"
                >
                  Sign In
                </Link>
                <Link
                  to={ROUTES.AUTH.REGISTER}
                  className="text-sm bg-gold-500 hover:bg-gold-600 text-white font-medium px-4 py-1.5 rounded-lg transition-colors"
                >
                  Join Free
                </Link>
              </div>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            onClick={() => dispatch(toggleMobileMenu())}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            className="md:hidden p-2.5 rounded-lg text-ocean-200 hover:text-white hover:bg-ocean-700 transition-colors"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="md:hidden overflow-hidden bg-ocean-900 border-t border-ocean-800"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              <MobileLink to={ROUTES.PRODUCTS} onClick={() => dispatch(toggleMobileMenu())}>
                Products
              </MobileLink>
              <MobileLink to={ROUTES.JAPANESE_GROCERY} onClick={() => dispatch(toggleMobileMenu())}>
                🍱 Japanese Grocery
              </MobileLink>
              <MobileLink to={ROUTES.RECIPES} onClick={() => dispatch(toggleMobileMenu())}>
                Recipes
              </MobileLink>
              <MobileLink to={ROUTES.WISHLIST} onClick={() => dispatch(toggleMobileMenu())}>
                Wishlist {wishlistCount > 0 && `(${wishlistCount})`}
              </MobileLink>
              {isAuthenticated ? (
                <>
                  <MobileLink to={ROUTES.ORDERS} onClick={() => dispatch(toggleMobileMenu())}>
                    My Orders
                  </MobileLink>
                  <MobileLink to={ROUTES.PROFILE} onClick={() => dispatch(toggleMobileMenu())}>
                    My Profile
                  </MobileLink>
                  {isAdmin && (
                    <MobileLink to={ROUTES.ADMIN.DASHBOARD} onClick={() => dispatch(toggleMobileMenu())}>
                      Admin Panel
                    </MobileLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-ocean-800 transition-colors mt-1"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <div className="flex gap-2 mt-2">
                  <Link
                    to={ROUTES.AUTH.LOGIN}
                    onClick={() => dispatch(toggleMobileMenu())}
                    className="flex-1 text-center py-2.5 text-sm text-ocean-100 border border-ocean-700 rounded-lg hover:bg-ocean-800 transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to={ROUTES.AUTH.REGISTER}
                    onClick={() => dispatch(toggleMobileMenu())}
                    className="flex-1 text-center py-2.5 text-sm bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
                  >
                    Join Free
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <GlobalSearch isOpen={searchOpen} onClose={closeSearch} />
    </header>
  )
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function DropdownLink({
  to,
  icon,
  children,
  onClick,
}: {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-2 text-sm text-ocean-800 dark:text-ocean-100 hover:bg-ocean-50 dark:hover:bg-ocean-700 transition-colors focus-visible:outline-none focus-visible:bg-ocean-50 dark:focus-visible:bg-ocean-700"
    >
      <span aria-hidden="true">{icon}</span>
      {children}
    </Link>
  )
}

function MobileLink({
  to,
  children,
  onClick,
}: {
  to: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        [
          'px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive
            ? 'bg-ocean-800 text-gold-400'
            : 'text-ocean-100 hover:bg-ocean-800 hover:text-white',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  )
}
