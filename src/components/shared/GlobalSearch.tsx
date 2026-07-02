/**
 * GlobalSearch — Spotlight-style search overlay.
 *
 * Opens on:
 *   - Click of the search icon button in the Navbar
 *   - Keyboard shortcut Ctrl+K / ⌘K (from anywhere)
 *
 * Features:
 *   - Instant suggestions via GET /products/suggestions (250ms debounce)
 *   - Recent searches (localStorage, last 6)
 *   - Popular searches (hardcoded chips)
 *   - Keyboard navigation: ↑↓ to move, Enter to navigate, Esc to close
 *   - Click outside / Esc dismisses
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, Clock, TrendingUp, Package } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { productApi, type ProductSuggestion } from '@/services/api/productApi'
import { formatCurrency } from '@/utils/formatCurrency'
import { ROUTES } from '@/constants/routes'

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'divya_recent_searches'
const MAX_RECENT = 6

const POPULAR = [
  'Salmon', 'Prawns', 'Tuna', 'Calamari', 'Miso', 'Nori',
  'Crab', 'Lobster', 'Wasabi', 'Kewpie',
]

// ── Local-storage helpers ──────────────────────────────────────────────────────

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function addRecent(term: string) {
  const prev = getRecent().filter(t => t.toLowerCase() !== term.toLowerCase())
  localStorage.setItem(STORAGE_KEY, JSON.stringify([term, ...prev].slice(0, MAX_RECENT)))
}

function removeRecent(term: string) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(getRecent().filter(t => t !== term)),
  )
}

// ── Hook: expose open/close to parent (Navbar) ────────────────────────────────

export function useGlobalSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const open  = useCallback(() => setIsOpen(true),  [])
  const close = useCallback(() => setIsOpen(false), [])
  return { isOpen, open, close }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  isOpen: boolean
  onClose: () => void
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const inputId = useId()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLUListElement>(null)

  const [query, setQuery]           = useState('')
  const [activeIdx, setActiveIdx]   = useState(-1)
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([])
  const [loading, setLoading]       = useState(false)
  const [recent, setRecent]         = useState<string[]>([])

  const debouncedQuery = useDebounce(query, 250)

  // ── Fetch suggestions ──────────────────────────────────────────────────────

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    productApi.getSuggestions(debouncedQuery, 7).then(data => {
      if (!cancelled) {
        setSuggestions(data)
        setLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // ── Reset on open ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setActiveIdx(-1)
      setSuggestions([])
      setRecent(getRecent())
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // ── Ctrl/Cmd+K global shortcut ────────────────────────────────────────────

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        if (!isOpen) {
          // The parent controls open state — dispatch a custom event
          window.dispatchEvent(new CustomEvent('divya:search:open'))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen])

  // ── Navigate to product or search results ──────────────────────────────────

  const commit = useCallback((term: string, slug?: string) => {
    if (!term.trim()) return
    addRecent(term.trim())
    onClose()
    if (slug) {
      navigate(`/products/${slug}`)
    } else {
      navigate(`${ROUTES.PRODUCTS}?q=${encodeURIComponent(term.trim())}`)
    }
  }, [navigate, onClose])

  // ── Keyboard navigation ────────────────────────────────────────────────────

  const totalItems = suggestions.length  // only suggestions are arrow-navigable

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, totalItems - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, -1))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIdx >= 0 && suggestions[activeIdx]) {
          const s = suggestions[activeIdx]
          commit(s.name, s.slug)
        } else if (query.trim()) {
          commit(query.trim())
        }
        break
      case 'Escape':
        onClose()
        break
    }
  }

  // ── Scroll active item into view ───────────────────────────────────────────

  useEffect(() => {
    if (activeIdx < 0) return
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  if (!isOpen) return null

  const showSuggestions = query.length >= 2
  const showEmpty = showSuggestions && !loading && suggestions.length === 0

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center pt-16 sm:pt-24 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Search products"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-ocean-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-ocean-100 dark:border-ocean-800">
          {loading
            ? <div className="w-4 h-4 border-2 border-ocean-400 border-t-transparent rounded-full animate-spin shrink-0" />
            : <Search size={18} className="text-ocean-400 shrink-0" />
          }
          <input
            id={inputId}
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(-1) }}
            onKeyDown={handleKeyDown}
            placeholder="Search products, ingredients, categories…"
            className="flex-1 bg-transparent text-sm text-ocean-900 dark:text-white placeholder:text-ocean-400 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setSuggestions([]); inputRef.current?.focus() }}
              className="p-1 rounded-md text-ocean-400 hover:text-ocean-700 dark:hover:text-ocean-200"
              aria-label="Clear"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] border border-ocean-200 dark:border-ocean-700 text-ocean-400 rounded px-1.5 py-0.5 font-mono shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results / suggestions */}
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain">

          {/* ── Instant suggestions ──────────────────────────────── */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="py-2">
              <p className="px-4 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-ocean-400">
                Products
              </p>
              <ul ref={listRef} role="listbox">
                {suggestions.map((s, i) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={activeIdx === i}
                  >
                    <button
                      type="button"
                      onClick={() => commit(s.name, s.slug)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={[
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        activeIdx === i
                          ? 'bg-ocean-50 dark:bg-ocean-800'
                          : 'hover:bg-ocean-50 dark:hover:bg-ocean-800',
                      ].join(' ')}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-ocean-100 dark:bg-ocean-800 shrink-0">
                        {s.image
                          ? <img src={s.image} alt={s.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <Package size={16} className="text-ocean-300" />
                            </div>
                        }
                      </div>

                      {/* Name + brand */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ocean-900 dark:text-white leading-tight truncate">
                          {s.name}
                        </p>
                        {s.brand && (
                          <p className="text-xs text-ocean-400 mt-0.5">{s.brand}</p>
                        )}
                      </div>

                      {/* Price */}
                      <span className="text-sm font-semibold text-ocean-800 dark:text-ocean-200 shrink-0">
                        {formatCurrency(s.price)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* View all */}
              <button
                type="button"
                onClick={() => commit(query)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-ocean-600 dark:text-ocean-300 hover:bg-ocean-50 dark:hover:bg-ocean-800 transition-colors border-t border-ocean-50 dark:border-ocean-800 mt-1"
              >
                <span>View all results for <strong className="text-ocean-900 dark:text-white">"{query}"</strong></span>
                <Search size={14} />
              </button>
            </div>
          )}

          {/* ── No results ───────────────────────────────────────── */}
          {showEmpty && (
            <div className="py-10 text-center">
              <p className="text-3xl mb-2">🐟</p>
              <p className="text-sm font-medium text-ocean-600 dark:text-ocean-300">
                No results for <strong>"{query}"</strong>
              </p>
              <p className="text-xs text-ocean-400 mt-1">Try a different word or browse categories below.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {POPULAR.slice(0, 5).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setQuery(p); setActiveIdx(-1) }}
                    className="px-3 py-1 bg-ocean-50 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 rounded-full text-xs font-medium hover:bg-ocean-100 dark:hover:bg-ocean-700 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Default state (no query) ─────────────────────────── */}
          {!showSuggestions && (
            <div className="py-4 px-4 space-y-5">

              {/* Recent searches */}
              {recent.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-ocean-400 flex items-center gap-1.5">
                      <Clock size={11} /> Recent
                    </p>
                    <button
                      type="button"
                      onClick={() => { localStorage.removeItem(STORAGE_KEY); setRecent([]) }}
                      className="text-[10px] text-ocean-400 hover:text-ocean-600"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {recent.map(term => (
                      <div key={term} className="flex items-center justify-between group rounded-lg hover:bg-ocean-50 dark:hover:bg-ocean-800 pr-1 transition-colors">
                        <button
                          type="button"
                          onClick={() => commit(term)}
                          className="flex-1 text-left text-sm text-ocean-700 dark:text-ocean-200 px-3 py-1.5"
                        >
                          {term}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            removeRecent(term)
                            setRecent(getRecent())
                          }}
                          className="p-1 opacity-0 group-hover:opacity-100 text-ocean-400 hover:text-red-500 transition-all"
                          aria-label={`Remove "${term}" from recent searches`}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Popular searches */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-ocean-400 flex items-center gap-1.5 mb-2">
                  <TrendingUp size={11} /> Popular
                </p>
                <div className="flex flex-wrap gap-2">
                  {POPULAR.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => commit(p)}
                      className="px-3 py-1.5 bg-ocean-50 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-200 rounded-full text-xs font-medium hover:bg-ocean-700 hover:text-white dark:hover:bg-ocean-700 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-ocean-50 dark:border-ocean-800 bg-ocean-50/50 dark:bg-ocean-950/30">
          <span className="text-[10px] text-ocean-400 flex items-center gap-1">
            <kbd className="border border-ocean-200 dark:border-ocean-700 rounded px-1 font-mono">↑↓</kbd> navigate
          </span>
          <span className="text-[10px] text-ocean-400 flex items-center gap-1">
            <kbd className="border border-ocean-200 dark:border-ocean-700 rounded px-1 font-mono">↵</kbd> select
          </span>
          <span className="text-[10px] text-ocean-400 flex items-center gap-1">
            <kbd className="border border-ocean-200 dark:border-ocean-700 rounded px-1 font-mono">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
