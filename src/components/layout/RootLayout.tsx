import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'
import { CartDrawer } from '@/components/shared/CartDrawer'
import { useAppSelector } from '@/hooks/useAppSelector'

export default function RootLayout() {
  const isDarkMode = useAppSelector((s) => s.ui.isDarkMode)

  // Sync dark mode class with HTML element on every render
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode)
  }, [isDarkMode])

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#03182E] text-ocean-900 dark:text-ocean-50 transition-colors duration-300">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ocean-900 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>
      <Navbar />
      <CartDrawer />
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
