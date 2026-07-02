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
      <Navbar />
      <CartDrawer />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
