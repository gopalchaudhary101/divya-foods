import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingBag, Users, Tag, Boxes,
  Truck, Gift, ClipboardList, Settings, BarChart3, LogOut, Menu, X, RotateCcw, ChefHat, MessageCircle,
  Image as ImageIcon,
} from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { ROUTES } from '@/constants/routes'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.ADMIN.DASHBOARD,   label: 'Dashboard',   icon: <LayoutDashboard size={18} /> },
  { to: ROUTES.ADMIN.PRODUCTS,    label: 'Products',    icon: <Package size={18} /> },
  { to: ROUTES.ADMIN.ORDERS,      label: 'Orders',      icon: <ShoppingBag size={18} /> },
  { to: ROUTES.ADMIN.RETURNS,     label: 'Returns',     icon: <RotateCcw size={18} /> },
  { to: ROUTES.ADMIN.INVENTORY,   label: 'Inventory',    icon: <Boxes size={18} /> },
  { to: ROUTES.ADMIN.BULK_ORDERS, label: 'Bulk Orders', icon: <ClipboardList size={18} /> },
  { to: ROUTES.ADMIN.COUPONS,     label: 'Coupons',     icon: <Tag size={18} /> },
  { to: ROUTES.ADMIN.BANNERS,     label: 'Banners',     icon: <ImageIcon size={18} /> },
  { to: ROUTES.ADMIN.BUNDLES,     label: 'Bundles',     icon: <Package size={18} /> },
  { to: ROUTES.ADMIN.RECIPES,     label: 'Recipes',     icon: <ChefHat size={18} /> },
  { to: ROUTES.ADMIN.WHATSAPP,    label: 'WhatsApp',    icon: <MessageCircle size={18} /> },
  { to: ROUTES.ADMIN.GIFT_CARDS,  label: 'Gift Cards',  icon: <Gift size={18} /> },
  { to: ROUTES.ADMIN.DRIVERS,     label: 'Drivers',     icon: <Truck size={18} /> },
  { to: ROUTES.ADMIN.USERS,       label: 'Users & Roles', icon: <Users size={18} /> },
  { to: ROUTES.ADMIN.ANALYTICS,   label: 'Analytics',   icon: <BarChart3 size={18} /> },
  { to: ROUTES.ADMIN.SETTINGS,    label: 'Settings',    icon: <Settings size={18} /> },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  developer: 'Developer',
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === ROUTES.ADMIN.DASHBOARD}
          onClick={onNavigate}
          className={({ isActive }) =>
            [
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
              isActive
                ? 'bg-premium-gold/15 text-premium-gold'
                : 'text-white/70 hover:bg-white/5 hover:text-white',
            ].join(' ')
          }
        >
          {item.icon}
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-ocean-50 dark:bg-[#03182E]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 bg-premium-navy text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="font-display text-lg font-semibold text-premium-gold">Divya Foods</p>
          <p className="text-xs text-white/50">Admin Panel</p>
        </div>
        <SidebarContent />
        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-900/20 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative flex flex-col w-64 h-full bg-premium-navy text-white">
            <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-premium-gold">Divya Foods</p>
                <p className="text-xs text-white/50">Admin Panel</p>
              </div>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={20} className="text-white/70" />
              </button>
            </div>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
            <div className="px-3 py-4 border-t border-white/10">
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-300 hover:bg-red-900/20 transition-colors"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white dark:bg-ocean-950 border-b border-ocean-100 dark:border-ocean-800">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 text-ocean-500"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-ocean-900 dark:text-white leading-tight">{user?.name}</p>
              <span className="text-[11px] font-medium text-premium-gold uppercase tracking-wide">
                {user ? ROLE_LABELS[user.role] ?? user.role : ''}
              </span>
            </div>
            <button
              onClick={logout}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-ocean-500 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
