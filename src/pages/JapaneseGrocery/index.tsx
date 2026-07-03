import React from 'react'
import { Link } from 'react-router-dom'
import { PageSEO } from '@/components/shared/PageSEO'
import { motion } from 'framer-motion'
import { ChevronRight, MessageCircle, BookOpen, Sparkles } from 'lucide-react'
import { useProducts } from '@/hooks/useProducts'
import { ProductCard } from '@/components/shared/ProductCard'
import { useAppDispatch } from '@/hooks/useAppDispatch'
import { addToCart } from '@/features/cart/cartSlice'
import { ROUTES } from '@/constants/routes'
import { CONFIG } from '@/constants/config'
import { RECIPES } from '@/data/recipes'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

// ─── Animation ────────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

// ─── Ingredient Guide ─────────────────────────────────────────────────────────

const INGREDIENTS = [
  {
    kanji: '味噌',
    romaji: 'Miso',
    color: 'from-amber-900/80 to-amber-700/60',
    accent: 'border-amber-500',
    description: 'Fermented soybean paste. The soul of Japanese cooking — adds deep umami to soups, marinades and glazes.',
    uses: ['Miso soup', 'Salmon glaze', 'Ramen broth', 'Salad dressing'],
    searchTag: 'miso',
  },
  {
    kanji: 'みりん',
    romaji: 'Mirin',
    color: 'from-yellow-900/80 to-yellow-700/60',
    accent: 'border-yellow-500',
    description: 'Sweet rice wine with 14% alcohol. Adds sweetness, shine and depth to teriyaki, yakitori and simmered dishes.',
    uses: ['Teriyaki sauce', 'Yakitori glaze', 'Nimono (simmered)', 'Tempura dip'],
    searchTag: 'mirin',
  },
  {
    kanji: '醤油',
    romaji: 'Shoyu',
    color: 'from-stone-900/80 to-stone-700/60',
    accent: 'border-stone-400',
    description: 'Japanese soy sauce — lighter and sweeter than Chinese varieties. Brewed with wheat for a more complex flavour.',
    uses: ['Dipping sauce', 'Stir-fry', 'Sushi & sashimi', 'Ramen seasoning'],
    searchTag: 'soy sauce',
  },
  {
    kanji: '海苔',
    romaji: 'Nori',
    color: 'from-green-900/80 to-green-800/60',
    accent: 'border-green-500',
    description: 'Roasted dried seaweed sheets. Essential for sushi rolls, onigiri rice balls, and as a crispy garnish.',
    uses: ['Sushi rolls', 'Onigiri', 'Ramen topping', 'Snacking'],
    searchTag: 'nori',
  },
  {
    kanji: 'だし',
    romaji: 'Dashi',
    color: 'from-sky-900/80 to-sky-800/60',
    accent: 'border-sky-400',
    description: 'Japan\'s foundational stock made from kombu seaweed and bonito tuna flakes. Pure umami in minutes.',
    uses: ['Miso soup base', 'Ramen broth', 'Udon broth', 'Chawanmushi'],
    searchTag: 'dashi',
  },
  {
    kanji: '酢',
    romaji: 'Su (Rice Vinegar)',
    color: 'from-rose-900/80 to-rose-800/60',
    accent: 'border-rose-400',
    description: 'Mild Japanese rice vinegar. Gentler than white vinegar — used for sushi rice seasoning and pickling.',
    uses: ['Sushi rice', 'Sunomono salad', 'Pickles', 'Ponzu sauce'],
    searchTag: 'vinegar',
  },
]

function IngredientGuide() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-ocean-950"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-gold-400 text-xs font-bold uppercase tracking-widest mb-2">The Japanese Kitchen</p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-3">
            6 Ingredients Every Home Cook Needs
          </h2>
          <p className="text-ocean-300 text-sm max-w-xl mx-auto">
            Understanding these six pantry staples unlocks almost every Japanese dish.
            Each one is available here — imported directly from Japan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {INGREDIENTS.map(ing => (
            <div
              key={ing.romaji}
              className={`relative overflow-hidden rounded-2xl border ${ing.accent} border-opacity-40 bg-gradient-to-br ${ing.color} p-5`}
            >
              {/* Kanji watermark */}
              <div className="absolute -top-2 -right-2 text-7xl font-bold text-white/5 select-none leading-none pointer-events-none">
                {ing.kanji}
              </div>

              {/* Content */}
              <div className="relative z-10">
                <div className="text-3xl font-bold text-white mb-0.5">{ing.kanji}</div>
                <div className="text-sm font-semibold text-gold-400 mb-2">{ing.romaji}</div>
                <p className="text-ocean-200 text-sm leading-relaxed mb-3">{ing.description}</p>

                {/* Use-cases */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {ing.uses.map(u => (
                    <span key={u} className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-white/80">
                      {u}
                    </span>
                  ))}
                </div>

                <Link
                  to={`${ROUTES.PRODUCTS}?category=japanese-grocery&search=${ing.searchTag}`}
                  className="text-xs font-semibold text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors"
                >
                  Shop {ing.romaji} <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Product skeleton ─────────────────────────────────────────────────────────

function ProductSkeleton() {
  return (
    <div className="rounded-2xl bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-800 overflow-hidden animate-pulse">
      <div className="aspect-square bg-ocean-100 dark:bg-ocean-800" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-3/4" />
        <div className="h-3 bg-ocean-100 dark:bg-ocean-800 rounded w-1/2" />
        <div className="h-8 bg-ocean-100 dark:bg-ocean-800 rounded-lg mt-3" />
      </div>
    </div>
  )
}

// ─── Why authentic? ───────────────────────────────────────────────────────────

const WHY = [
  {
    emoji: '🇯🇵',
    title: 'Directly from Japan',
    text: 'We import from established Japanese manufacturers — Marukome, Kikkoman, Kewpie, Takaraboshi. No grey-market substitutes.',
  },
  {
    emoji: '🚫',
    title: 'No Artificial Shortcuts',
    text: '"Mirin-style condiments" and "soy-flavoured sauces" are not the same. We stock only traditional, properly fermented products.',
  },
  {
    emoji: '❄️',
    title: 'Proper Cold-Chain Storage',
    text: 'Many Japanese condiments degrade in heat. Our climate-controlled warehouse and insulated delivery preserve every flavour compound.',
  },
]

function WhyAuthentic() {
  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-white dark:bg-ocean-950"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-gold-500 text-xs font-bold uppercase tracking-widest mb-2">Why It Matters</p>
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-ocean-900 dark:text-white">
            Authentic vs. Substitute — There's a Real Difference
          </h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {WHY.map(w => (
            <div key={w.title} className="text-center">
              <div className="text-4xl mb-3">{w.emoji}</div>
              <h3 className="font-semibold text-ocean-900 dark:text-white mb-2">{w.title}</h3>
              <p className="text-ocean-500 dark:text-ocean-400 text-sm leading-relaxed">{w.text}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Recipe teaser ────────────────────────────────────────────────────────────

const JAPANESE_RECIPES = RECIPES.filter(r =>
  r.tags.includes('japanese') || r.protein === 'salmon' || r.protein === 'tuna'
).slice(0, 3)

function RecipeTeaser() {
  if (JAPANESE_RECIPES.length === 0) return null

  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-ocean-50 dark:bg-ocean-900/50"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-6">
          <div>
            <p className="text-gold-500 text-xs font-bold uppercase tracking-widest mb-1">Cook With It</p>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-ocean-900 dark:text-white">
              Japanese-Inspired Recipes
            </h2>
          </div>
          <Link to={ROUTES.RECIPES} className="text-xs text-ocean-500 hover:text-ocean-700 dark:hover:text-ocean-300 flex items-center gap-1">
            All recipes <ChevronRight size={14} />
          </Link>
        </div>

        <div className="grid sm:grid-cols-3 gap-4">
          {JAPANESE_RECIPES.map(r => (
            <Link
              key={r.id}
              to={ROUTES.RECIPES}
              className="group bg-white dark:bg-ocean-900 rounded-2xl p-5 border border-ocean-100 dark:border-ocean-800 hover:border-ocean-300 dark:hover:border-ocean-600 transition-all hover:shadow-md"
            >
              <div className="text-4xl mb-3">{r.emoji}</div>
              <h3 className="font-semibold text-ocean-900 dark:text-white text-sm mb-1">{r.name}</h3>
              <p className="text-xs text-ocean-500 dark:text-ocean-400 line-clamp-2 mb-3">{r.description}</p>
              <div className="flex items-center gap-3 text-xs text-ocean-400">
                <span>{r.time}</span>
                <span>·</span>
                <span className="capitalize">{r.difficulty}</span>
              </div>
              <div className="mt-3 text-xs font-medium text-ocean-600 dark:text-ocean-400 group-hover:text-ocean-900 dark:group-hover:text-white transition-colors flex items-center gap-1">
                See recipe <ChevronRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Cooking FAQ ──────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'How long do Japanese condiments keep once opened?',
    a: 'Miso and mirin keep for 3–6 months in the fridge after opening. Soy sauce keeps for 1–2 years at room temperature. Always check the label and use an airtight container.',
  },
  {
    q: 'Can I substitute regular vinegar for rice vinegar?',
    a: 'Only in a pinch — use 75% of the amount and add a small pinch of sugar. Rice vinegar is milder and slightly sweet; white wine vinegar is the closest substitute.',
  },
  {
    q: 'What\'s the difference between white miso and red miso?',
    a: 'White miso (shiro) is fermented for a shorter time — it\'s mild, sweet and creamy. Red miso (aka) is fermented longer and is much stronger and saltier. We carry white miso, which is the most versatile for beginners.',
  },
  {
    q: 'Is dashi vegetarian or vegan?',
    a: 'Traditional dashi is made from bonito tuna flakes and kombu seaweed, so it\'s not vegetarian. Kombu dashi (made only from seaweed) is vegan. Instant dashi granules are usually fish-based — check the label.',
  },
]

function CookingFAQ() {
  const [open, setOpen] = React.useState<number | null>(null)

  return (
    <motion.section
      variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
      className="py-14 px-4 bg-white dark:bg-ocean-950"
    >
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2 justify-center">
          <BookOpen size={16} className="text-gold-500" />
          <p className="text-gold-500 text-xs font-bold uppercase tracking-widest">Cooking Guide</p>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-ocean-900 dark:text-white text-center mb-8">
          Common Questions
        </h2>

        <div className="space-y-3">
          {FAQ.map((item, i) => (
            <div
              key={i}
              className="border border-ocean-100 dark:border-ocean-800 rounded-xl overflow-hidden"
            >
              <button
                className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-ocean-50 dark:hover:bg-ocean-900 transition-colors"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <span className="text-sm font-medium text-ocean-900 dark:text-white">{item.q}</span>
                <span className="shrink-0 text-ocean-400 text-lg leading-none mt-0.5">
                  {open === i ? '−' : '+'}
                </span>
              </button>
              {open === i && (
                <div className="px-5 pb-4 text-sm text-ocean-600 dark:text-ocean-300 leading-relaxed border-t border-ocean-50 dark:border-ocean-800 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function JapaneseGroceryPage() {
  const dispatch = useAppDispatch()

  const { data, isLoading } = useProducts({
    category: 'japanese-grocery',
    limit: 20,
    sortBy: 'newest',
  })

  const products = data?.data ?? []

  function handleAddToCart(product: Product) {
    dispatch(
      addToCart({
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image: product.images[0] ?? '',
        maxQuantity: product.stockQuantity ?? 10,
      })
    )
    toast.success(`${product.name} added to cart!`)
  }

  return (
    <>
      <PageSEO
        title="Japanese Grocery — Authentic Pantry Essentials — Divya Foods"
        description="Shop authentic Japanese pantry ingredients in Delhi — miso paste, mirin, nori, soy sauce, dashi and more. Imported directly from Japan, delivered across NCR."
      />

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="bg-ocean-950 text-white px-4 pt-14 pb-20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-5 pointer-events-none select-none overflow-hidden">
          <div className="absolute top-6 left-6 text-[8rem] font-bold leading-none">和食</div>
          <div className="absolute bottom-4 right-6 text-[8rem] font-bold leading-none">味</div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12rem] font-bold leading-none">日</div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-widest">
            <Sparkles size={11} /> Authentic Imports
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold mb-4 leading-tight">
            Japanese Kitchen<br />
            <span className="text-gold-400">Essentials</span>
          </h1>
          <p className="text-ocean-200 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Authentic miso, mirin, nori, shoyu and more — imported directly from Japan.
            Everything your kitchen needs to cook real Japanese food at home.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#products"
              className="px-7 py-3 bg-gold-500 hover:bg-gold-400 text-ocean-900 font-semibold rounded-full text-sm transition-colors"
            >
              Shop All Products
            </a>
            <a
              href={`https://wa.me/${CONFIG.CONTACT.WHATSAPP}?text=Hi! I'd like to know more about your Japanese grocery range.`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full text-sm transition-colors flex items-center gap-2"
            >
              <MessageCircle size={15} /> WhatsApp Us
            </a>
          </div>
        </div>
      </div>

      {/* ── Ingredient Guide ──────────────────────────────────── */}
      <IngredientGuide />

      {/* ── Products ──────────────────────────────────────────── */}
      <section id="products" className="py-12 px-4 bg-white dark:bg-ocean-950">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <p className="text-gold-500 text-xs font-bold uppercase tracking-widest mb-1">Shop</p>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-ocean-900 dark:text-white">
                Japanese Grocery
                {!isLoading && products.length > 0 && (
                  <span className="ml-2 text-base font-normal text-ocean-400">
                    ({products.length} products)
                  </span>
                )}
              </h2>
            </div>
            <Link
              to={`${ROUTES.PRODUCTS}?category=japanese-grocery`}
              className="text-xs text-ocean-500 hover:text-ocean-700 dark:hover:text-ocean-300 flex items-center gap-1"
            >
              View in store <ChevronRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">🍱</div>
              <p className="text-ocean-500 mb-2">Japanese grocery products coming soon.</p>
              <p className="text-ocean-400 text-sm">
                Contact us on WhatsApp to request specific items.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(p => (
                <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Why Authentic ─────────────────────────────────────── */}
      <WhyAuthentic />

      {/* ── Recipes ───────────────────────────────────────────── */}
      <RecipeTeaser />

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <CookingFAQ />

      {/* ── Footer CTA ────────────────────────────────────────── */}
      <motion.section
        variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
        className="py-14 px-4 bg-gradient-to-br from-ocean-900 to-ocean-700 text-white text-center"
      >
        <div className="max-w-xl mx-auto">
          <div className="text-4xl mb-4">🍱</div>
          <h2 className="text-xl sm:text-2xl font-display font-bold mb-3">
            Can't find what you need?
          </h2>
          <p className="text-ocean-200 text-sm mb-6">
            We take custom Japanese pantry orders. If you need a specific brand, sauce, or ingredient
            not listed here — just WhatsApp us and we'll source it.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href={`https://wa.me/${CONFIG.CONTACT.WHATSAPP}?text=Hi Divya Foods! I'm looking for a specific Japanese ingredient.`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-7 py-3 bg-gold-500 hover:bg-gold-400 text-ocean-900 font-semibold rounded-full text-sm transition-colors flex items-center gap-2"
            >
              <MessageCircle size={15} /> Request Custom Order
            </a>
            <Link
              to={ROUTES.PRODUCTS}
              className="px-7 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full text-sm transition-colors"
            >
              Browse All Products
            </Link>
          </div>
        </div>
      </motion.section>
    </>
  )
}
