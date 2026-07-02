/**
 * FreeChatbot — zero-cost customer support widget.
 *
 * All responses come from the static knowledge base below.
 * Product search calls the site's own /products endpoint (no paid service).
 * Works offline for all FAQ/knowledge answers; product search gracefully
 * degrades to a message when the network is unavailable.
 *
 * No OpenAI · No Anthropic · No Gemini · No paid API · No API key.
 */

import { useState, useRef, useEffect, KeyboardEvent, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, X, Send, Headphones, Search,
  ChevronRight, ExternalLink, Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import axiosInstance from '@/services/api/axiosInstance'
import { formatCurrency } from '@/utils/formatCurrency'

// ─── Knowledge base ───────────────────────────────────────────────────────────

const KB = {
  delivery: {
    areas:
      '🚚 **We deliver to:**\n• **Delhi** — same-day delivery if ordered before 2 PM\n• **Gurgaon / Gurugram** — within 24 hours\n• **Noida** — within 24 hours\n• **Greater Noida** — within 24 hours\n• **Faridabad** — within 24 hours\n\nNot sure if we deliver to your area? Enter your pincode on any product page to check instantly.',
    timing:
      '⏱️ **Delivery Timings:**\n• **Delhi:** Same-day delivery when ordered before 2 PM\n• **Gurgaon, Noida, Greater Noida, Faridabad:** Within 24 hours\n\nAll deliveries are in insulated packaging to maintain the cold chain.',
    charge:
      '💰 **Delivery Charges:**\n• **Free delivery** on orders above ₹999\n• **₹50 delivery fee** on orders below ₹999\n\nAll products are shipped in insulated packaging to keep them perfectly frozen.',
    packaging:
      '📦 **Packaging:** All our products travel in insulated boxes with dry ice / gel packs to maintain temperature throughout the journey.',
  },

  storage: {
    frozen:
      '❄️ **How to Store Frozen Seafood:**\n• Keep in your **freezer at -18°C or below**\n• Best consumed within **3–6 months** of purchase\n• Keep in original vacuum-sealed packaging until ready to use\n• Place at the back of the freezer away from the door (more stable temperature)',
    thawing:
      '🌊 **How to Thaw Safely:**\n• **Best method:** Move to the refrigerator the night before (8–12 hours). Safe & keeps texture.\n• **Faster method:** Seal in a zip-lock bag and submerge in cold running water for 30–60 mins.\n• ⚠️ **Never thaw at room temperature** — bacteria multiply rapidly between 5°C and 60°C.',
    after_thaw:
      '⚠️ **Once Thawed:**\n• **Do NOT refreeze** thawed seafood\n• Use within **24–48 hours** of thawing\n• Store in the refrigerator if not cooking immediately\n• Thawed seafood kept in the fridge should be used within **1–2 days**',
  },

  cooking: {
    salmon:
      '🐟 **How to Cook Salmon:**\n• **Pan-fry:** Medium-high heat, 3–4 minutes per side. Pat dry first for a better sear.\n• **Oven-bake:** 200°C for 12–15 minutes. Salmon is done when flesh flakes easily.\n• **Season simply:** Salt, pepper, lemon juice, dill or parsley.\n• **Don\'t overcook** — slightly translucent in the center is perfect.',
    prawns:
      '🍤 **How to Cook Prawns:**\n• They cook in just **2–3 minutes per side** on high heat\n• Done when they **turn pink and curl** into a C-shape (over-cooked = O-shape = rubbery)\n• Devein before cooking for best taste\n• Great in stir-fries, butter garlic, biryani, curry, or grilled on skewers',
    squid:
      '🦑 **How to Cook Squid / Calamari:**\n• The golden rule: **cook very fast (under 2 mins) OR very slow (45+ mins)**\n• Anything in between makes it tough and rubbery\n• **Calamari rings:** Coat in seasoned flour, deep-fry at 180°C for 90 seconds\n• **Stir-fry:** High heat, toss for 1–2 minutes with garlic and chilli',
    tuna:
      '🐠 **How to Cook Tuna:**\n• Best served **slightly rare** — sear the outside, keep the center pink\n• **Sear:** Very high heat, 1–2 minutes per side (for steaks)\n• Marinate in soy sauce, sesame oil, ginger and garlic for a Japanese-style dish\n• Canned tuna: ready to eat; great in salads, sandwiches, pasta',
    crab:
      '🦀 **How to Cook Crab:**\n• **Steam:** 12–15 minutes until bright orange-red all over\n• **Boil:** Salted water, 10–12 minutes\n• Serve with melted butter and lemon, or make butter garlic crab\n• Clean crabs before cooking for better flavor absorption',
    octopus:
      '🐙 **How to Cook Octopus:**\n• Boil / pressure cook first to tenderize (45–60 mins)\n• Then grill or pan-fry briefly for char and caramelization\n• Marinate after boiling in olive oil, lemon, garlic and herbs\n• Slice into pieces before grilling',
    lobster:
      '🦞 **How to Cook Lobster:**\n• **Boil:** Drop live/thawed lobster into salted boiling water, 8–12 mins (based on size)\n• **Grill:** Split in half, brush with butter and garlic, grill flesh-side down for 5–6 mins\n• Red shell = perfectly cooked\n• Serve with clarified butter and lemon',
    general:
      '🔥 **General Seafood Cooking Tips:**\n• **Pat dry before cooking** — removes moisture and gives a better sear\n• **High heat** for most seafood (except delicate fish like sole)\n• **Season just before cooking,** not hours ahead\n• **Don\'t crowd the pan** — cook in batches if needed\n• Most seafood cooks quickly — watch it closely\n• Simple seasoning often works best — let the natural flavor shine',
  },

  refund:
    '↩️ **Return & Refund Policy:**\n\n✅ **We accept replacements / refunds if:**\n• Product arrived damaged or spoiled\n• Wrong item was delivered\n• Quality issue confirmed on arrival\n\n📲 **How to claim:**\n1. WhatsApp a photo to **+91 9999123242** within **24 hours** of delivery\n2. We arrange replacement or refund within **2–3 business days**\n\n❌ **We cannot accept returns for:**\n• Thawed or opened products (food safety regulations)\n• Products not reported within 24 hours of delivery',

  contact:
    '📞 **Contact Divya Foods:**\n\n• 📱 WhatsApp / Phone: **+91 9999123242**\n• 📞 Alternate: **+91 7303436108**\n• 📧 Email: **salesdivyafoods@gmail.com**\n• 🌐 Website: www.divyafoods.com\n• 📍 Address: O-52, Saurabh Vihar, Jaitpur, Badarpur Extension, New Delhi – 110044',

  hours:
    '🕐 **Business Hours:**\n• Monday – Saturday: **9 AM – 7 PM**\n• Sunday: **10 AM – 5 PM**\n\nFor urgent queries outside hours, WhatsApp us at **+91 9999123242** and we\'ll get back to you as soon as possible.',

  payment:
    '💳 **Payment Methods:**\n• Online via **Razorpay** — accepts:\n  - UPI (GPay, PhonePe, Paytm, BHIM)\n  - Debit & Credit Cards (Visa, Mastercard, Rupay)\n  - Net Banking (all major banks)\n  - Wallets (Paytm, Amazon Pay, etc.)\n\n🔒 All transactions are **100% secure and encrypted**.',

  products:
    '🛍️ **Our Products:**\nWe specialize in **premium imported frozen seafood** and **Japanese grocery items**:\n\n🐟 **Seafood:**\n• Norwegian Salmon (fillets, steaks)\n• Tuna (steaks, fillets)\n• Tiger & Vannamei Prawns\n• Squid & Calamari Rings\n• Octopus\n• Crab (whole & legs)\n• Lobster\n\n🍱 **Japanese Grocery:**\n• Miso paste, Mirin, Soy sauce\n• Dashi stock, Nori sheets\n• Japanese rice & condiments\n\nAll seafood is **freshly frozen** at source to preserve maximum freshness.',

  minimum_order:
    '🛒 **Minimum Order:** There is no minimum order value. However, orders above **₹999 qualify for free delivery**.',

  recipes: [
    {
      id: 'garlic-butter-salmon',
      name: 'Garlic Butter Salmon',
      emoji: '🧄',
      time: '15 mins',
      difficulty: 'Easy',
      serves: '2',
      ingredients: [
        '2 salmon fillets (200g each)',
        '3 tbsp butter',
        '4 cloves garlic (minced)',
        '1 lemon (juice + zest)',
        'Fresh dill or parsley',
        'Salt & black pepper',
      ],
      steps: [
        'Thaw salmon in refrigerator overnight. Pat completely dry with paper towel.',
        'Season generously with salt and pepper on both sides.',
        'Heat 1 tbsp butter in a non-stick pan over medium-high heat until foaming.',
        'Place salmon skin-side up. Cook without touching for 4 minutes until golden.',
        'Flip. Add remaining butter, garlic, lemon juice. Baste for 3–4 more minutes.',
        'Remove when center is just opaque. Rest 1 minute before serving.',
        'Garnish with fresh herbs and lemon zest.',
      ],
    },
    {
      id: 'chilli-garlic-prawns',
      name: 'Chilli Garlic Prawns',
      emoji: '🌶️',
      time: '10 mins',
      difficulty: 'Easy',
      serves: '2–3',
      ingredients: [
        '500g prawns (deveined)',
        '6 cloves garlic (sliced)',
        '2 red chillies (sliced)',
        '2 tbsp soy sauce',
        '1 tbsp oyster sauce',
        '1 tsp sesame oil',
        'Spring onion & sesame seeds to garnish',
        '2 tbsp cooking oil',
      ],
      steps: [
        'Thaw prawns, devein if needed, pat dry.',
        'Heat oil in wok or frying pan on HIGH heat until smoking.',
        'Add garlic and chilli — stir-fry 30 seconds until fragrant.',
        'Add prawns in a single layer. Cook 90 seconds without moving.',
        'Flip prawns. Add soy sauce and oyster sauce. Toss for 60 seconds.',
        'Drizzle sesame oil. Remove from heat immediately.',
        'Serve over steamed rice. Garnish with spring onion and sesame seeds.',
      ],
    },
    {
      id: 'crispy-calamari',
      name: 'Crispy Calamari',
      emoji: '🍤',
      time: '20 mins',
      difficulty: 'Easy',
      serves: '2–4',
      ingredients: [
        '400g squid rings',
        '1 cup all-purpose flour',
        '1 tsp salt',
        '1 tsp black pepper',
        '1 tsp paprika / chilli powder',
        'Oil for deep frying',
        'Lemon wedges to serve',
        'Mayonnaise or aioli for dipping',
      ],
      steps: [
        'Thaw squid rings, pat completely dry — moisture = less crispy.',
        'Mix flour, salt, pepper, paprika in a shallow bowl.',
        'Heat oil in deep pan to 180°C (test with a small piece of bread — should sizzle).',
        'Coat squid rings in flour mix, shaking off excess.',
        'Fry in small batches for 60–90 seconds only. Do not overcrowd.',
        'Drain on paper towel immediately.',
        'Serve at once with lemon wedges and dipping sauce.',
      ],
    },
    {
      id: 'miso-salmon',
      name: 'Miso Glazed Salmon',
      emoji: '🍱',
      time: '45 mins',
      difficulty: 'Medium',
      serves: '2',
      ingredients: [
        '2 salmon fillets',
        '2 tbsp white miso paste',
        '1 tbsp mirin',
        '1 tbsp soy sauce',
        '1 tsp sugar',
        'Sesame seeds & spring onion to garnish',
      ],
      steps: [
        'Mix miso paste, mirin, soy sauce, and sugar into a smooth glaze.',
        'Coat salmon fillets with glaze on all sides.',
        'Marinate in refrigerator for 30 minutes (or up to 2 hours for deeper flavor).',
        'Preheat oven to 200°C or prepare grill.',
        'Bake for 12–14 mins OR grill flesh-side down for 4 mins, then flip for 3 mins.',
        'The glaze should be slightly caramelized and sticky.',
        'Serve with steamed Japanese rice and garnish with sesame seeds.',
      ],
    },
    {
      id: 'butter-garlic-crab',
      name: 'Butter Garlic Crab',
      emoji: '🦀',
      time: '30 mins',
      difficulty: 'Medium',
      serves: '2',
      ingredients: [
        '1 whole crab (500–700g), cleaned & halved',
        '4 tbsp butter',
        '8 cloves garlic (minced)',
        '2 tbsp soy sauce',
        '1 tbsp oyster sauce',
        '1 tsp sugar',
        'Fresh coriander & chilli to garnish',
      ],
      steps: [
        'Steam or boil the crab for 12–15 minutes until bright orange. Set aside.',
        'Melt butter in large wok or pan over medium heat.',
        'Add garlic — cook 2 mins until golden and fragrant.',
        'Add soy sauce, oyster sauce, and sugar. Stir to combine.',
        'Add the cooked crab pieces. Toss to coat well in the sauce for 3–4 mins.',
        'Serve immediately garnished with coriander and red chilli.',
      ],
    },
  ],
} as const

// ─── Types ────────────────────────────────────────────────────────────────────

type Recipe = (typeof KB.recipes)[number]

interface SearchProduct {
  id: string
  name: string
  slug: string
  price: number
  images: string[]
  inStock: boolean
  rating?: number
}

type MsgRole = 'user' | 'bot'

interface Msg {
  id: number
  role: MsgRole
  text: string
  chips?: string[]
  products?: SearchProduct[]
  recipe?: Recipe
  searching?: boolean
}

// ─── Intent detection ─────────────────────────────────────────────────────────

type Intent =
  | 'greeting'
  | 'delivery_areas' | 'delivery_time' | 'delivery_cost'
  | 'storage' | 'thawing' | 'after_thaw'
  | 'cook_salmon' | 'cook_prawns' | 'cook_squid' | 'cook_tuna'
  | 'cook_crab' | 'cook_octopus' | 'cook_lobster' | 'cook_general'
  | 'recipe_list' | 'recipe_detail'
  | 'refund' | 'contact' | 'hours' | 'payment'
  | 'products' | 'minimum_order'
  | 'product_search' | 'unknown'

const INTENT_RULES: Array<{ intent: Intent; patterns: RegExp[]; score: number }> = [
  { intent: 'greeting',       score: 10, patterns: [/^(hi+|hello|hey|namaste|namaskar|hii+|howdy|good\s*(morning|evening|afternoon|day)|wassup|what.?s up)/i] },
  { intent: 'delivery_areas', score: 9,  patterns: [/(deliver.*to|ship.*to|available\s*in|do\s*you\s*deliver|serviceable|which\s*(area|city|location)|pincode|gurgaon|noida|delhi|faridabad|gurugram|greater\s*noida)/i] },
  { intent: 'delivery_time',  score: 8,  patterns: [/(how\s*(long|fast|soon|quick)|when.*deliver|same\s*day|express|delivery\s*time|how\s*many\s*(hour|day))/i] },
  { intent: 'delivery_cost',  score: 8,  patterns: [/(delivery\s*(charge|fee|cost)|shipping\s*(charge|fee|cost)|free\s*delivery|free\s*ship)/i] },
  { intent: 'after_thaw',     score: 10, patterns: [/(after\s*(thaw|defrost)|once\s*thaw|refreeze|use\s*after\s*thaw|thawed.*how\s*long)/i] },
  { intent: 'thawing',        score: 9,  patterns: [/(thaw|defrost|unfreeze|how.*thaw|how.*defrost)/i] },
  { intent: 'storage',        score: 8,  patterns: [/(store|storage|keep|preserv|shelf\s*life|expir|how\s*long.*keep|freezer|temperature|freeze)/i] },
  { intent: 'cook_salmon',    score: 10, patterns: [/(cook.*salmon|salmon.*cook|fry.*salmon|bake.*salmon|how.*make.*salmon|salmon.*recip)/i] },
  { intent: 'cook_prawns',    score: 10, patterns: [/(cook.*prawn|prawn.*cook|cook.*shrimp|shrimp.*cook|prawn.*recip|shrimp.*recip)/i] },
  { intent: 'cook_squid',     score: 10, patterns: [/(cook.*squid|squid.*cook|calamari|cook.*calamari|squid.*recip)/i] },
  { intent: 'cook_tuna',      score: 10, patterns: [/(cook.*tuna|tuna.*cook|sear.*tuna|tuna.*recip)/i] },
  { intent: 'cook_crab',      score: 10, patterns: [/(cook.*crab|crab.*cook|steam.*crab|crab.*recip)/i] },
  { intent: 'cook_octopus',   score: 10, patterns: [/(cook.*octopus|octopus.*cook|octopus.*recip)/i] },
  { intent: 'cook_lobster',   score: 10, patterns: [/(cook.*lobster|lobster.*cook|lobster.*recip)/i] },
  { intent: 'cook_general',   score: 5,  patterns: [/(cooking\s*tip|how\s*(do\s*i|to)\s*cook|tips\s*for\s*cook|best\s*way\s*to\s*cook)/i] },
  { intent: 'recipe_list',    score: 9,  patterns: [/(recipe|any\s*recip|suggest.*recip|give.*recip|what.*recip|recip\s*for|recip\s*with|how\s*to\s*make|cook\s*something)/i] },
  { intent: 'refund',         score: 9,  patterns: [/(refund|return|replace|exchange|damage|broken|wrong.*item|spoil|issue|complain|defect|bad.*quality)/i] },
  { intent: 'contact',        score: 8,  patterns: [/(contact|phone|number|call|whatsapp|wa|email|address|reach|location|where.*are\s*you|speak\s*(to|with)|talk\s*to)/i] },
  { intent: 'hours',          score: 8,  patterns: [/(hour|timing|open|close|when.*open|business\s*hour|work\s*time|available.*when|what\s*time)/i] },
  { intent: 'payment',        score: 8,  patterns: [/(pay|payment|upi|card|credit|debit|gpay|google\s*pay|phonepe|paytm|razorpay|net\s*banking|wallet|how\s*to\s*pay|cod|cash)/i] },
  { intent: 'minimum_order',  score: 8,  patterns: [/(minimum.*order|min.*order|order.*minimum|least.*order)/i] },
  { intent: 'products',       score: 7,  patterns: [/(what.*have|what.*sell|your\s*product|catalog|range|available|seafood.*type|type.*seafood|japanese\s*grocer)/i] },
]

function detectIntent(text: string): { intent: Intent; searchQuery: string } {
  // Direct recipe name match
  for (const r of KB.recipes) {
    if (text.toLowerCase().includes(r.name.toLowerCase())) {
      return { intent: 'recipe_detail', searchQuery: r.id }
    }
  }

  // "do you have X" → product search
  const buyMatch = text.match(
    /(?:do\s*you\s*have|is\s*there|find|search(?:\s*for)?|looking\s*for|want(?:\s*to\s*buy)?|buy|get|show)\s+(?:me\s+)?(.+)/i
  )
  if (buyMatch) return { intent: 'product_search', searchQuery: buyMatch[1].trim() }

  // Score each intent
  let best = { intent: 'unknown' as Intent, score: 0 }
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some(p => p.test(text))) {
      if (rule.score > best.score) best = { intent: rule.intent, score: rule.score }
    }
  }

  // Fallback: product keyword → search
  if (
    best.intent === 'unknown' &&
    /(salmon|prawn|shrimp|tuna|squid|calamari|crab|lobster|octopus|miso|mirin|dashi|soy\s*sauce|nori|japanese)/i.test(text)
  ) {
    return { intent: 'product_search', searchQuery: text }
  }

  return { intent: best.intent, searchQuery: text }
}

// ─── Response builder ─────────────────────────────────────────────────────────

const MAIN_CHIPS = ['🚚 Delivery', '🍳 Recipes', '❄️ Storage', '📞 Contact', '💳 Payment', '🛍️ Products']

interface BotReply {
  text: string
  chips?: string[]
  recipe?: Recipe
  fetchProducts?: string
}

function buildReply(intent: Intent, query: string): BotReply {
  switch (intent) {
    case 'greeting':
      return {
        text: "Hi! 👋 Welcome to **Divya Foods**! I'm your support assistant. I can help with products, delivery, recipes, storage tips, and more. What can I help you with today?",
        chips: MAIN_CHIPS,
      }
    case 'delivery_areas':
      return { text: KB.delivery.areas, chips: ['Delivery timing', 'Delivery charge', 'Back to menu'] }
    case 'delivery_time':
      return { text: KB.delivery.timing, chips: ['Delivery areas', 'Delivery charge', 'Back to menu'] }
    case 'delivery_cost':
      return { text: KB.delivery.charge, chips: ['Delivery areas', 'Delivery timing', 'Back to menu'] }
    case 'storage':
      return { text: KB.storage.frozen, chips: ['How to thaw?', 'Once thawed?', 'Cooking tips', 'Back to menu'] }
    case 'thawing':
      return { text: KB.storage.thawing, chips: ['Once thawed?', 'Storage tips', 'Cooking tips'] }
    case 'after_thaw':
      return { text: KB.storage.after_thaw, chips: ['Storage tips', 'How to thaw?', 'Cooking tips'] }
    case 'cook_salmon':
      return { text: KB.cooking.salmon, chips: ['🍱 Miso Salmon recipe', 'Prawn tips', 'All recipes'] }
    case 'cook_prawns':
      return { text: KB.cooking.prawns, chips: ['🌶️ Chilli Prawn recipe', 'Squid tips', 'All recipes'] }
    case 'cook_squid':
      return { text: KB.cooking.squid, chips: ['🍤 Calamari recipe', 'General tips', 'All recipes'] }
    case 'cook_tuna':
      return { text: KB.cooking.tuna, chips: ['All recipes', 'Salmon tips', 'Back to menu'] }
    case 'cook_crab':
      return { text: KB.cooking.crab, chips: ['🦀 Butter Garlic Crab recipe', 'All recipes', 'Back to menu'] }
    case 'cook_octopus':
      return { text: KB.cooking.octopus, chips: ['General tips', 'All recipes', 'Back to menu'] }
    case 'cook_lobster':
      return { text: KB.cooking.lobster, chips: ['General tips', 'All recipes', 'Back to menu'] }
    case 'cook_general':
      return { text: KB.cooking.general, chips: ['Salmon tips', 'Prawn tips', 'Squid tips', 'All recipes'] }
    case 'recipe_list': {
      const list = KB.recipes.map(r => `${r.emoji} **${r.name}** — ${r.time}`).join('\n')
      return {
        text: `Here are some recipes you can try:\n\n${list}\n\nTap a recipe name to see the full step-by-step instructions!`,
        chips: KB.recipes.map(r => `${r.emoji} ${r.name}`),
      }
    }
    case 'recipe_detail': {
      const r = KB.recipes.find(rec => rec.id === query) ?? KB.recipes[0]
      return { text: '', recipe: r, chips: ['All recipes', '🚚 Delivery', '📞 Contact'] }
    }
    case 'refund':
      return { text: KB.refund, chips: ['📞 Contact us', 'Delivery info', 'Back to menu'] }
    case 'contact':
      return { text: KB.contact, chips: ['Business hours', 'Delivery info', 'Back to menu'] }
    case 'hours':
      return { text: KB.hours, chips: ['📞 Contact us', 'Delivery info', 'Back to menu'] }
    case 'payment':
      return { text: KB.payment, chips: ['Delivery charge', '🛍️ Products', 'Back to menu'] }
    case 'minimum_order':
      return { text: KB.minimum_order, chips: ['Delivery charge', '🛍️ Products', 'Back to menu'] }
    case 'products':
      return {
        text: KB.products,
        chips: ['Search salmon', 'Search prawns', 'Search tuna', '🍱 Recipes'],
        fetchProducts: undefined,
      }
    case 'product_search':
      return { text: `Searching for **"${query}"**…`, chips: [], fetchProducts: query }
    default:
      return {
        text: "Sorry, I couldn't find that information. Please contact our customer support:\n\n📞 **+91 9999123242**\n✉️ **salesdivyafoods@gmail.com**\n\nWe're happy to help!",
        chips: ['📞 Contact us', '🚚 Delivery', '🍳 Recipes', 'Back to menu'],
      }
  }
}

// ─── Text renderer (handles **bold** and \n newlines) ────────────────────────

function RichText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <span className="whitespace-pre-line">
      {lines.map((line, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((chunk, ci) =>
            chunk.startsWith('**') && chunk.endsWith('**')
              ? <strong key={ci}>{chunk.slice(2, -2)}</strong>
              : <span key={ci}>{chunk}</span>
          )}
        </Fragment>
      ))}
    </span>
  )
}

// ─── Product card (mini) ──────────────────────────────────────────────────────

function ProductCard({ p }: { p: SearchProduct }) {
  return (
    <Link
      to={`/products/${p.slug}`}
      className="flex items-center gap-2.5 bg-ocean-50 dark:bg-ocean-800 rounded-xl p-2.5 hover:bg-ocean-100 dark:hover:bg-ocean-700 transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg overflow-hidden bg-ocean-100 dark:bg-ocean-700 shrink-0">
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🐟</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-ocean-800 dark:text-ocean-200 truncate">{p.name}</p>
        <p className="text-xs text-ocean-500">{formatCurrency(p.price)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!p.inStock && (
          <span className="text-xs text-red-400">Out</span>
        )}
        <ChevronRight size={13} className="text-ocean-400 group-hover:text-ocean-600 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Recipe card (in-chat) ────────────────────────────────────────────────────

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="bg-ocean-50 dark:bg-ocean-800 rounded-xl overflow-hidden">
      <div className="px-3 pt-3 pb-2 border-b border-ocean-100 dark:border-ocean-700">
        <p className="font-semibold text-sm text-ocean-900 dark:text-white">
          {recipe.emoji} {recipe.name}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-ocean-500">
          <span className="flex items-center gap-1"><Clock size={11} /> {recipe.time}</span>
          <span>Serves {recipe.serves}</span>
          <span>{recipe.difficulty}</span>
        </div>
      </div>
      <div className="p-3 space-y-2.5">
        <div>
          <p className="text-xs font-semibold text-ocean-600 dark:text-ocean-400 mb-1">Ingredients</p>
          <ul className="space-y-0.5">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="text-xs text-ocean-700 dark:text-ocean-300 flex items-start gap-1.5">
                <span className="text-ocean-400 mt-0.5 shrink-0">•</span>{ing}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold text-ocean-600 dark:text-ocean-400 mb-1">Steps</p>
          <ol className="space-y-1.5">
            {recipe.steps.map((step, i) => (
              <li key={i} className="text-xs text-ocean-700 dark:text-ocean-300 flex items-start gap-2">
                <span className="shrink-0 w-4 h-4 rounded-full bg-ocean-200 dark:bg-ocean-700 flex items-center justify-center text-ocean-700 dark:text-ocean-300 font-semibold text-[10px]">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg, onChip }: { msg: Msg; onChip: (chip: string) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-ocean-700 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm leading-relaxed">
          {msg.text}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Bot bubble */}
      {msg.searching ? (
        <div className="flex items-end gap-2">
          <div className="w-6 h-6 rounded-full bg-ocean-100 dark:bg-ocean-700 flex items-center justify-center shrink-0">
            <Search size={12} className="text-ocean-500 animate-pulse" />
          </div>
          <div className="bg-ocean-50 dark:bg-ocean-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center h-10">
            {[0, 150, 300].map(d => (
              <span key={d} className="w-1.5 h-1.5 bg-ocean-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <div className="w-6 h-6 rounded-full bg-ocean-100 dark:bg-ocean-700 flex items-center justify-center shrink-0 mb-0.5">
            <Headphones size={12} className="text-ocean-500" />
          </div>
          <div className="max-w-[85%] flex flex-col gap-2">
            {msg.text && (
              <div className="bg-ocean-50 dark:bg-ocean-800 text-ocean-900 dark:text-ocean-100 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm leading-relaxed">
                <RichText text={msg.text} />
              </div>
            )}
            {msg.recipe && <RecipeCard recipe={msg.recipe} />}
            {msg.products && msg.products.length > 0 && (
              <div className="space-y-1.5">
                {msg.products.map(p => <ProductCard key={p.id} p={p} />)}
              </div>
            )}
            {msg.products && msg.products.length === 0 && msg.text === '' && (
              <div className="bg-ocean-50 dark:bg-ocean-800 text-ocean-700 dark:text-ocean-300 rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm">
                No products found for that search. Try browsing our{' '}
                <Link to="/products" className="text-ocean-600 dark:text-ocean-400 underline">full catalog</Link>.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick-reply chips */}
      {msg.chips && msg.chips.length > 0 && (
        <div className="ml-8 flex flex-wrap gap-1.5">
          {msg.chips.map(chip => (
            <button
              key={chip}
              onClick={() => onChip(chip)}
              className="px-2.5 py-1 text-xs bg-white dark:bg-ocean-800 border border-ocean-200 dark:border-ocean-600 text-ocean-700 dark:text-ocean-300 rounded-full hover:bg-ocean-50 dark:hover:bg-ocean-700 hover:border-ocean-400 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const WELCOME: Msg = {
  id: 0,
  role: 'bot',
  text: "Hi! 👋 Welcome to **Divya Foods**! I'm your support assistant — here to help with products, delivery, recipes, storage tips, and more.\n\nWhat can I help you with today?",
  chips: MAIN_CHIPS,
}

let msgId = 1
const nextId = () => msgId++

export function FreeChatbot() {
  const [open, setOpen]         = useState(false)
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const [input, setInput]       = useState('')
  const [busy, setBusy]         = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300)
  }, [open])

  async function handleSend(rawText: string) {
    const text = rawText.trim()
    if (!text || busy) return

    setInput('')
    setBusy(true)

    // Add user message
    const userMsg: Msg = { id: nextId(), role: 'user', text }
    setMessages(prev => [...prev, userMsg])

    // Normalise chip labels → query text (strip emoji prefix)
    const queryText = text
      .replace(/^[🚚🍳❄📞💳🛍🍤🧄🌶🍱🦀🔍]\s*/, '')
      .replace(/^Back to menu$/i, 'menu')

    // Special chips
    if (/^back to menu$/i.test(queryText) || /^menu$/i.test(queryText)) {
      setMessages(prev => [...prev, {
        id: nextId(), role: 'bot',
        text: 'Sure! Here are things I can help with:',
        chips: MAIN_CHIPS,
      }])
      setBusy(false)
      return
    }

    // Detect intent
    const { intent, searchQuery } = detectIntent(queryText)
    const reply = buildReply(intent, searchQuery)

    if (reply.fetchProducts !== undefined) {
      // Add searching indicator
      const searchingId = nextId()
      setMessages(prev => [...prev, { id: searchingId, role: 'bot', text: reply.text, searching: true }])

      try {
        const { data } = await axiosInstance.get(
          `/products?search=${encodeURIComponent(reply.fetchProducts)}&limit=5`
        )
        const products: SearchProduct[] = (data.data ?? []).map((p: Record<string, unknown>) => ({
          id:      String(p.id ?? ''),
          name:    String(p.name ?? ''),
          slug:    String(p.slug ?? ''),
          price:   Number(p.price ?? 0),
          images:  Array.isArray(p.images) ? (p.images as string[]) : [],
          inStock: Boolean(p.inStock ?? true),
          rating:  Number(p.rating ?? 0),
        }))

        setMessages(prev => prev.map(m =>
          m.id === searchingId
            ? { ...m, text: products.length > 0 ? `Found **${products.length}** result${products.length > 1 ? 's' : ''}:` : '', searching: false, products, chips: products.length > 0 ? ['Search again', '🛍️ Products', 'Back to menu'] : ['🛍️ Products', 'Back to menu'] }
            : m
        ))
      } catch {
        setMessages(prev => prev.map(m =>
          m.id === searchingId
            ? {
                ...m,
                text: 'I had trouble searching right now. Browse our full catalog or contact us:',
                searching: false,
                chips: ['🛍️ Products', '📞 Contact us', 'Back to menu'],
              }
            : m
        ))
      }
    } else {
      // Slight delay so it feels natural (not instant wall of text)
      await new Promise(r => setTimeout(r, 250))
      setMessages(prev => [...prev, {
        id: nextId(), role: 'bot',
        text:   reply.text,
        chips:  reply.chips,
        recipe: reply.recipe,
      }])
    }

    setBusy(false)
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(input) }
  }

  return (
    <>
      {/* ── Chat panel ────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="fcb-panel"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 340, damping: 30 }}
            className="fixed bottom-[88px] right-4 z-50 w-[340px] sm:w-[380px] rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-ocean-900 border border-ocean-100 dark:border-ocean-700 flex flex-col"
            style={{ maxHeight: 'min(560px, calc(100dvh - 120px))' }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-ocean-800 to-ocean-600 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Headphones size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm leading-tight">Divya Foods Support</p>
                <p className="text-ocean-200 text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-mint-400 inline-block" />
                  Online · Always here to help
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close chat"
              >
                <X size={15} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 min-h-0">
              {messages.map(msg => (
                <MessageBubble key={msg.id} msg={msg} onChip={chip => handleSend(chip)} />
              ))}
              {busy && messages[messages.length - 1]?.role !== 'bot' && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 rounded-full bg-ocean-100 dark:bg-ocean-700 flex items-center justify-center shrink-0">
                    <Headphones size={12} className="text-ocean-500" />
                  </div>
                  <div className="bg-ocean-50 dark:bg-ocean-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center h-10">
                    {[0, 150, 300].map(d => (
                      <span key={d} className="w-1.5 h-1.5 bg-ocean-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input row */}
            <div className="px-3 py-3 border-t border-ocean-100 dark:border-ocean-700 flex gap-2 shrink-0 bg-white dark:bg-ocean-900">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                disabled={busy}
                placeholder="Ask about delivery, recipes, products…"
                className="flex-1 text-sm bg-ocean-50 dark:bg-ocean-800 text-ocean-900 dark:text-ocean-100 placeholder-ocean-400 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-ocean-500 transition-all disabled:opacity-60"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={!input.trim() || busy}
                aria-label="Send"
                className="w-10 h-10 bg-ocean-700 hover:bg-ocean-600 active:bg-ocean-800 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
              >
                <Send size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating button ──────────────────────────────────────── */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label={open ? 'Close support chat' : 'Open support chat'}
        className="fixed bottom-6 right-4 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-ocean-700 to-ocean-500 text-white shadow-lg shadow-ocean-900/40 flex items-center justify-center"
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageCircle size={22} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  )
}
