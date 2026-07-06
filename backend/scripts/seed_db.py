"""
Divya Luxury Seafoods — Database Seeder
==============================
Seeds the MongoDB database with all 7 categories and 145 products.

Usage (from the project root):
  cd backend
  python scripts/seed_db.py

Options:
  --wipe      Drop existing products + categories before seeding (default: upsert)
  --products  Seed only products (categories must already exist)
  --cats      Seed only categories
"""

import sys
import os
import argparse
from datetime import datetime, timezone
from pathlib import Path

# Add the backend directory to sys.path so we can import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from pymongo import MongoClient
from bson import ObjectId

# ─── Load .env ────────────────────────────────────────────────────────────────

def load_env():
    env_path = Path(__file__).parent.parent / ".env"
    env = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

ENV = load_env()
MONGODB_URL   = ENV.get("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = ENV.get("DATABASE_NAME", "divyafoods")

def utcnow():
    return datetime.now(timezone.utc)

def slugify(text: str) -> str:
    return text.lower().replace(" ", "-").replace("_", "-")

# ─── Categories ───────────────────────────────────────────────────────────────

CATEGORIES = [
    {
        "name": "Frozen Seafood",
        "slug": "frozen-seafood",
        "description": "Premium frozen seafood — prawns, fish fillets, salmon, tuna, crab, lobster and more. Sourced from top fishing regions worldwide.",
        "image": "/assets/categories/frozen-seafood.webp",
        "icon": "🦐",
        "order": 1,
        "is_active": True,
    },
    {
        "name": "Japanese Products",
        "slug": "japanese-products",
        "description": "Authentic Japanese ingredients — sushi-grade fish, roe, noodles, seaweed, condiments and pantry staples imported directly from Japan.",
        "image": "/assets/categories/japanese-products.webp",
        "icon": "🍣",
        "order": 2,
        "is_active": True,
    },
    {
        "name": "Imported Meat",
        "slug": "imported-meat",
        "description": "Premium imported meats — duck, turkey, lamb and pork sourced from New Zealand, Thailand and Europe.",
        "image": "/assets/categories/imported-meat.webp",
        "icon": "🥩",
        "order": 3,
        "is_active": True,
    },
    {
        "name": "Groceries",
        "slug": "groceries",
        "description": "Asian specialty groceries — pastry sheets, starches, dried mushrooms, specialty flours and pantry essentials.",
        "image": "/assets/categories/groceries.webp",
        "icon": "🛒",
        "order": 4,
        "is_active": True,
    },
    {
        "name": "Sauces & Condiments",
        "slug": "sauces-condiments",
        "description": "Premium Asian sauces and condiments — Kikkoman soy sauce, Kewpie mayonnaise, mirin, sake, sriracha and more.",
        "image": "/assets/categories/sauces.webp",
        "icon": "🍶",
        "order": 5,
        "is_active": True,
    },
    {
        "name": "Gourmet Products",
        "slug": "gourmet-products",
        "description": "Luxury gourmet imports — Beluga caviar, Osectra caviar, premium roe and exclusive delicacies for the discerning palate.",
        "image": "/assets/categories/gourmet.webp",
        "icon": "🫘",
        "order": 6,
        "is_active": True,
    },
]

# ─── Products ─────────────────────────────────────────────────────────────────
# Format: (folder_path, display_name, price, original_price|None, origin, weight, brand|None, description, tags, is_featured, is_best_seller)

PRODUCTS = [
    # ═══════════════════════════════════════════════════════
    # FROZEN SEAFOOD
    # ═══════════════════════════════════════════════════════
    ("seafood/prawns-iqf", "Frozen IQF Prawns",
     649, 799, "India", "500g", None,
     "Individually Quick Frozen (IQF) prawns — peeled and deveined for convenience. Perfect for stir fry, grilling, pasta and curries. No added preservatives.",
     ["prawns", "shrimp", "seafood", "frozen", "iqf", "peeled"], True, True),

    ("seafood/prawns-fresh", "Fresh Head-On Prawns",
     799, None, "India", "500g", None,
     "Fresh head-on prawns packed with natural flavour. Ideal for traditional Indian prawn curry, biryani, or tandoor preparations.",
     ["prawns", "fresh", "head-on", "seafood", "curry"], False, False),

    ("seafood/prawns-tempura", "Tempura Prawns",
     849, 999, "Japan", "400g", None,
     "Restaurant-style tempura battered prawns — ready to fry in just 3 minutes. Light, crispy batter with a juicy prawn inside.",
     ["prawns", "tempura", "battered", "fried", "japanese", "ready to cook"], True, True),

    ("seafood/tilapia-fillet", "Tilapia Fish Fillet",
     449, 549, "India", "500g", None,
     "Skinless and boneless tilapia fillets. Mild flavour and firm texture — ideal for frying, baking or steaming. No fishy smell.",
     ["tilapia", "fish", "fillet", "boneless", "skinless"], False, False),

    ("seafood/basa-fillet-indian", "Indian Basa Fish Fillet",
     399, None, "India", "500g", None,
     "Fresh water basa fillets from Indian farms. Tender, mild-flavoured white fish perfect for fish fry, fish curry or grilled dishes.",
     ["basa", "pangasius", "fish", "fillet", "white fish", "mild"], False, False),

    ("seafood/basa-fillet-vietnamese", "Vietnamese Basa Fish Fillet",
     429, 499, "Vietnam", "500g", None,
     "Premium imported basa (pangasius) fillets from Vietnam. Superior quality with a slightly firmer texture than Indian basa.",
     ["basa", "pangasius", "vietnamese", "fish", "fillet", "imported"], False, False),

    ("seafood/seabass-bethki", "Bethki Indian Seabass Fillet",
     899, 1099, "India", "500g", None,
     "Indian seabass (Bethki / Koduva) fillets — a premium white fish with delicate flavour. Excellent for butter garlic preparations and European recipes.",
     ["seabass", "bethki", "koduva", "white fish", "premium", "fillet"], True, False),

    ("seafood/river-sole-fillet", "River Sole Fish Fillet",
     649, 799, "India", "500g", None,
     "River sole fillets with a fine, delicate flavour. Popular in Mumbai-style fish preparations and continental restaurants.",
     ["sole", "river sole", "fish", "fillet", "delicate"], False, False),

    ("seafood/surmai-seer-fish", "Surmai / Seer Fish",
     1299, 1499, "India", "500g", None,
     "King fish (Surmai / Seer Fish) steaks — the prized fish of Mumbai and coastal India. Rich, firm flesh ideal for traditional fish fry or marinated grilling.",
     ["surmai", "seer fish", "king fish", "indian", "fish steaks", "premium"], True, True),

    ("seafood/red-snapper-fillet", "Red Snapper Fish Fillet",
     999, 1199, "India", "500g", None,
     "Red snapper fillets with vibrant colour and sweet, mild flavour. Excellent for Asian-style steaming, European baking or Indian curry.",
     ["red snapper", "snapper", "fish", "fillet", "premium"], False, False),

    ("seafood/pomfret-white", "White Pomfret Fish",
     1499, 1799, "India", "500g (2 pieces)", None,
     "Premium white pomfret (Paplet) — the king of Indian seafood. Whole fish, cleaned and ready to marinate. Exceptional for Tandoor, Bangda-style preparations and steaming.",
     ["pomfret", "paplet", "white pomfret", "premium", "whole fish", "indian seafood"], True, True),

    ("seafood/octopus-whole", "Octopus Whole",
     1299, None, "Vietnam", "1kg", None,
     "Whole octopus cleaned and ready to cook. Versatile for grilling, braising, Spanish-style pulpo or Japanese takoyaki.",
     ["octopus", "seafood", "whole", "grilling", "takoyaki"], False, False),

    ("seafood/squid-tube", "Squid Tube IQF",
     699, 849, "India", "500g", None,
     "Cleaned squid tubes — ready to stuff, slice into rings, or grill. Imported quality with tender texture.",
     ["squid", "calamari", "tube", "cleaned", "seafood"], False, False),

    ("seafood/squid-ring", "Squid Rings",
     749, 899, "India", "500g", None,
     "Pre-cut squid rings — ready for frying, grilling or pasta. Saves prep time for restaurants and home cooks.",
     ["squid", "calamari", "rings", "fried", "seafood"], True, True),

    ("seafood/squid-ink", "Squid Ink",
     599, None, "Spain", "100ml", None,
     "Premium squid ink for signature black pasta, risotto nero and gourmet sauces. Imported from Spain.",
     ["squid ink", "black pasta", "risotto", "gourmet", "spanish"], False, False),

    ("seafood/soft-shell-crabs", "Soft Shell Crabs",
     1799, 2199, "Vietnam", "500g", None,
     "Premium soft shell crabs — crunchy outside, sweet inside. Perfect for tempura, Asian fry or fusion seafood dishes.",
     ["soft shell crab", "crab", "seafood", "tempura", "premium"], True, False),

    ("seafood/blue-crabs", "Blue Crabs",
     1499, None, "India", "1kg (4-6 pieces)", None,
     "Whole blue crabs with rich, sweet meat. Ideal for crab curry, chilli crab, or steaming.",
     ["blue crab", "crab", "whole", "seafood", "curry"], False, False),

    ("seafood/mud-crabs", "Mud Crabs",
     1999, 2499, "India", "1kg (2-3 pieces)", None,
     "Premium Indian mud crabs packed with sweet, flavourful claw and body meat. Popular in Singapore chilli crab and Kerala crab curry.",
     ["mud crab", "crab", "whole", "premium", "seafood"], True, True),

    ("seafood/lobster-whole", "Lobster Whole",
     3499, 3999, "Australia", "500g (1 piece)", None,
     "Premium whole lobster — the ultimate luxury seafood experience. Ideal for steaming, grilling or lobster thermidor.",
     ["lobster", "whole", "premium", "luxury", "seafood", "gourmet"], True, True),

    ("seafood/lobster-tail", "Lobster Tail",
     2999, 3499, "Australia", "200g (2 pieces)", None,
     "Split lobster tails — the finest part of the lobster. Ready for butter-basted grilling or baking.",
     ["lobster tail", "lobster", "premium", "grilling", "gourmet"], True, False),

    ("seafood/salmon-fillet-norwegian", "Norwegian Salmon Fillet (Sushi Grade)",
     1699, 1999, "Norway", "500g", None,
     "Premium Atlantic salmon fillet from Norway — sushi grade. Deep orange colour, rich in Omega-3, buttery flavour. Ideal for sushi, sashimi, gravlax or pan-searing.",
     ["salmon", "norwegian salmon", "atlantic salmon", "sushi grade", "premium", "omega 3"], True, True),

    ("seafood/salmon-smoked-fillet", "Smoked Salmon Fillet",
     1999, 2499, "Norway", "200g", None,
     "Cold-smoked Norwegian salmon with a silky texture and rich smoky flavour. Ready to eat — perfect for bagels, canapés and appetisers.",
     ["smoked salmon", "salmon", "norwegian", "ready to eat", "premium", "appetiser"], True, True),

    ("seafood/salmon-portions", "Salmon Portions",
     1299, 1599, "Norway", "500g (2 pieces)", None,
     "Skin-on salmon portions — individually portioned for easy cooking. Pan-fry, bake or grill to perfection.",
     ["salmon", "portions", "skinon", "pan fry", "bake", "premium"], False, False),

    ("seafood/salmon-smoked-portions", "Smoked Salmon Portions",
     1799, 2099, "Norway", "250g", None,
     "Cold-smoked salmon cut into thick portions — ideal for plating as a starter or hot smoking further for a deeper flavour.",
     ["smoked salmon", "portions", "premium", "starter", "gourmet"], False, False),

    ("seafood/salmon-loin", "Salmon Loin / Belly",
     1499, None, "Norway", "300g", None,
     "Salmon belly and loin — the fattiest, most flavourful cut. Popular in sushi restaurants as salmon belly nigiri.",
     ["salmon loin", "salmon belly", "fatty", "sushi", "premium"], False, False),

    ("seafood/salmon-head", "Salmon Head (Gutted)",
     599, None, "Norway", "500g (1 piece)", None,
     "Norwegian salmon head — rich in collagen and flavour. Excellent for salmon head curry, soup or miso soup.",
     ["salmon head", "salmon", "curry", "soup", "economical"], False, False),

    ("seafood/salmon-fresh-whole", "Fresh Whole Salmon (Gutted)",
     2999, 3499, "Norway", "2-3kg (whole)", None,
     "Whole gutted fresh Norwegian salmon — the centrepiece of any seafood feast. Ideal for baking whole, hot smoking or carving tableside.",
     ["whole salmon", "fresh salmon", "Norwegian salmon", "baking", "premium"], False, False),

    ("seafood/salmon-fresh-steaks", "Fresh Salmon Steaks",
     1499, 1799, "Norway", "500g (2 pieces)", None,
     "Cross-cut salmon steaks with bone — robust for grilling, barbecuing and baking.",
     ["salmon steaks", "salmon", "grilling", "barbecue", "bone-in"], False, False),

    ("seafood/tuna-yellowfin-saku", "Yellowfin Tuna Saku Block",
     2499, 2999, "Sri Lanka", "300g", None,
     "Deep red yellowfin tuna saku block — sushi grade. Cut for tuna sashimi, tataki, tuna tataki bowl or poke.",
     ["tuna", "yellowfin", "saku", "sushi grade", "sashimi", "poke", "premium"], True, True),

    ("seafood/chilean-sea-bass", "Chilean Sea Bass",
     3999, 4499, "Chile", "500g (2 fillets)", None,
     "The most prized restaurant fish — buttery, flaky Chilean sea bass (Patagonian toothfish). Melts in the mouth. Pan-sear with miso glaze.",
     ["chilean sea bass", "toothfish", "premium", "luxury", "restaurant quality"], True, False),

    ("seafood/black-cod", "Black Cod (Sablefish)",
     2999, 3499, "USA", "500g", None,
     "Black cod (sablefish) with an extraordinarily rich, velvety texture. Made famous by the legendary Nobu miso black cod recipe.",
     ["black cod", "sablefish", "miso", "nobu", "premium", "luxury"], True, False),

    ("seafood/imitation-crab-sticks", "Imitation Crab Sticks (Surimi)",
     349, None, "Japan", "500g", "Ajinomoto",
     "Premium Japanese surimi crab sticks — perfect for sushi rolls, salads and sandwiches. Low calorie, high protein.",
     ["crab sticks", "surimi", "imitation crab", "sushi", "maki roll"], False, True),

    ("seafood/tempura-prawns", "Tempura Prawns Battered",
     899, 1099, "Japan", "400g (10 pieces)", None,
     "Ready-to-fry tempura prawns in authentic Japanese light batter. Restaurant quality in 5 minutes at home.",
     ["tempura prawns", "battered", "ready cook", "japanese", "fried"], False, True),

    # ═══════════════════════════════════════════════════════
    # JAPANESE PRODUCTS
    # ═══════════════════════════════════════════════════════
    ("japanese/hamachi-fillet", "Hamachi Yellowtail Fillet (Sushi Grade)",
     2999, 3499, "Japan", "300g", None,
     "Premium yellowtail (hamachi) fillet — a sushi restaurant staple. Rich, buttery flavour ideal for sashimi, nigiri and teriyaki.",
     ["hamachi", "yellowtail", "sushi grade", "sashimi", "nigiri", "japanese", "premium"], True, True),

    ("japanese/kampachi-fillet", "Kampachi / Amberjack Fillet",
     3299, None, "Japan", "300g", None,
     "Kampachi (greater amberjack) — slightly milder than hamachi with a firmer texture. Excellent for sashimi and carpaccio.",
     ["kampachi", "amberjack", "sashimi", "sushi grade", "japanese", "premium"], False, False),

    ("japanese/unagi-kabayaki", "Unagi Kabayaki (Grilled Eel)",
     1999, 2299, "Japan", "200g (2 pieces)", None,
     "Pre-grilled freshwater eel in sweet kabayaki sauce — ready to heat and serve over rice (unadon). A Japanese restaurant classic.",
     ["unagi", "eel", "kabayaki", "japanese", "unadon", "ready to eat"], True, True),

    ("japanese/tuna-loins", "Tuna Loins (Sushi Grade)",
     2299, 2699, "Sri Lanka", "300g", None,
     "Deep red tuna loins — cleaned and trimmed for sashimi, tuna steak or tataki.",
     ["tuna", "loin", "sushi grade", "sashimi", "premium", "red tuna"], False, False),

    ("japanese/octopus-boiled", "Japanese Boiled Octopus",
     1499, 1799, "Japan", "500g", None,
     "Japanese-style pre-boiled octopus — tender, subtly seasoned. Slice thin for octopus sashimi, chop for takoyaki, or grill.",
     ["octopus", "boiled", "japanese", "tako", "sashimi", "takoyaki"], False, False),

    ("japanese/prawns-nobashi", "Nobashi Prawns (Japanese Stretched)",
     1299, 1499, "Japan", "500g (10 pieces)", None,
     "Nobashi — stretched prawns with no curves, specially prepared for ebi nigiri and ebi tempura. Used in top sushi restaurants.",
     ["nobashi", "prawns", "stretched", "ebi", "nigiri", "sushi", "japanese"], True, True),

    ("japanese/prawns-sweet", "Sweet Prawns / Amaebi",
     2499, 2999, "Canada", "250g", None,
     "Amaebi (sweet shrimp) — raw, delicate prawns with natural sweetness. Served as nigiri or sashimi. The heads can be deep fried.",
     ["amaebi", "sweet shrimp", "raw prawn", "sashimi", "nigiri", "premium", "sushi"], True, False),

    ("japanese/scallops-hotate", "Scallops Hotate (Sushi Grade)",
     2799, 3299, "Japan / Hokkaido", "250g (5-6 pieces)", None,
     "Hokkaido hotate scallops — the finest scallops in the world. Naturally sweet with a pillowy texture. For sashimi, seared scallops, or pasta.",
     ["scallops", "hotate", "hokkaido", "sushi grade", "sashimi", "premium", "luxury"], True, True),

    ("japanese/ikura-salmon-roe", "Ikura Salmon Roe",
     1999, 2399, "Japan", "200g", None,
     "Premium salmon roe (ikura) marinated in soy and mirin — a sushi restaurant staple. Juicy orange pearls that burst with rich umami.",
     ["ikura", "salmon roe", "caviar", "sushi", "premium", "japanese"], True, True),

    ("japanese/tobikko-orange", "Tobikko Orange (Flying Fish Roe)",
     1299, 1499, "Japan", "200g", None,
     "Crispy orange flying fish roe — used for California rolls, toppings and garnish. Adds a satisfying pop of texture.",
     ["tobiko", "tobikko", "flying fish roe", "orange", "sushi", "california roll"], False, True),

    ("japanese/tobikko-black", "Tobikko Black (Flying Fish Roe)",
     1399, 1599, "Japan", "200g", None,
     "Black tobiko with a striking colour and slightly smoky flavour — ideal for dramatic presentation on sushi.",
     ["tobiko", "tobikko", "flying fish roe", "black", "sushi", "garnish"], False, False),

    ("japanese/tobikko-green", "Tobikko Green Wasabi (Flying Fish Roe)",
     1399, 1599, "Japan", "200g", None,
     "Green wasabi-flavoured tobiko with a spicy kick. Perfect for wasabi-lovers and adds colour to sushi platters.",
     ["tobiko", "tobikko", "wasabi", "green", "flying fish roe", "spicy", "sushi"], False, False),

    ("japanese/edamame", "Edamame Green Soybeans",
     399, None, "Japan / Taiwan", "500g", None,
     "Premium frozen edamame — blanched and ready to serve. Simply steam or microwave. The perfect Japanese snack with sea salt.",
     ["edamame", "soybeans", "japanese snack", "vegetarian", "healthy"], False, True),

    ("japanese/wakame-chuke", "Chuka Wakame (Seaweed Salad)",
     549, 649, "Japan", "500g", None,
     "Ready-to-serve seasoned wakame seaweed salad — a Japanese restaurant appetiser staple. Slightly sweet and sesame-flavoured.",
     ["wakame", "seaweed salad", "chuka", "japanese", "appetiser", "vegan"], True, True),

    ("japanese/wakame-dry", "Dried Wakame Seaweed",
     449, None, "Japan", "100g (dried)", None,
     "Premium dried wakame seaweed — rehydrates quickly for miso soup, salads and udon. Rich in iodine and minerals.",
     ["wakame", "dried seaweed", "miso soup", "japanese", "healthy", "vegan"], False, False),

    ("japanese/kaiso-salad", "Kaiso Mixed Seaweed Salad",
     599, 699, "Japan", "500g", None,
     "Colourful mixed seaweed salad (kaiso) with multiple varieties — a visually stunning Japanese starter.",
     ["kaiso", "seaweed", "mixed", "salad", "japanese", "colourful"], False, False),

    ("japanese/nori-sheet", "Nori Seaweed Sheets",
     549, 649, "Japan", "50 sheets", None,
     "Premium grade nori for sushi rolls, temaki and onigiri. Rich dark colour and crisp texture that doesn't get soggy.",
     ["nori", "seaweed", "sushi", "maki", "temaki", "onigiri", "japanese"], True, True),

    ("japanese/konbu-kelp", "Konbu Dried Kelp",
     699, None, "Japan / Hokkaido", "100g", None,
     "Hokkaido konbu for making authentic dashi stock — the foundation of Japanese cooking. Also used for kombu tsukudani.",
     ["konbu", "kombu", "kelp", "dashi", "japanese soup", "umami", "vegan"], False, False),

    ("japanese/mamenori", "Mamenori Soy Paper Sheets",
     799, None, "Japan", "40 sheets (assorted colours)", None,
     "Coloured soy paper sheets — a gluten-free alternative to nori with a subtle flavour. Popular for rainbow rolls.",
     ["mamenori", "soy paper", "sushi", "gluten free", "coloured", "rainbow roll"], False, False),

    ("japanese/hijiki", "Hijiki Black Seaweed",
     499, None, "Japan", "100g (dried)", None,
     "Hijiki seaweed — a nutritious Japanese ingredient used in traditional simmered dishes (hijiki no nimono).",
     ["hijiki", "black seaweed", "japanese", "healthy", "simmered", "vegan"], False, False),

    ("japanese/bamboo-leaf", "Bamboo Leaves (Sushi)",
     349, None, "Japan / China", "100 sheets", None,
     "Natural bamboo leaves for wrapping sushi, onigiri and traditional Japanese dishes. Impart a subtle fragrance.",
     ["bamboo leaf", "sushi", "wrapping", "japanese", "decoration"], False, False),

    ("japanese/gyoza-sheet", "Gyoza Dumpling Wrappers",
     299, None, "Japan", "40 sheets", None,
     "Thin wheat wrappers for making gyoza, potstickers and dumplings. Slightly thicker for pan-frying and steaming.",
     ["gyoza", "dumpling wrappers", "wonton", "japanese", "dumplings"], False, True),

    ("japanese/wonton-sheet-white", "Wonton Wrappers (White)",
     249, None, "China / Thailand", "80 sheets", None,
     "Classic white wonton wrappers — thin and delicate for wontons, dumplings and dim sum.",
     ["wonton", "wrappers", "dim sum", "dumplings", "chinese"], False, False),

    ("japanese/wonton-sheet-yellow", "Wonton Wrappers (Yellow / Egg)",
     269, None, "China / Thailand", "80 sheets", None,
     "Egg-enriched yellow wonton wrappers with a slightly richer flavour. Ideal for Hong Kong-style wontons.",
     ["wonton", "egg wrappers", "yellow", "hong kong", "dim sum"], False, False),

    ("japanese/spring-roll-sheet", "Spring Roll Sheets",
     279, None, "Thailand", "25 sheets", None,
     "Thin spring roll pastry sheets — for crispy fried spring rolls. Also used for fresh Vietnamese summer rolls.",
     ["spring roll", "wrappers", "pastry", "fried", "vietnamese", "thai"], False, False),

    ("japanese/wasabi-paste", "Wasabi Paste",
     499, 599, "Japan", "43g (tube)", "S&B",
     "Authentic Japanese wasabi paste — the real deal. Made with real wasabi root. Essential for sushi and sashimi.",
     ["wasabi", "paste", "japanese", "sushi", "spicy", "condiment"], True, True),

    ("japanese/wasabi-powder", "Wasabi Powder (Horseradish)",
     399, None, "Japan", "100g", "S&B",
     "Japanese wasabi powder — mix with water to make fresh wasabi paste. Also excellent in dressings and marinades.",
     ["wasabi", "powder", "horseradish", "japanese", "spicy"], False, False),

    ("japanese/wasabi-oil", "Wasabi Oil",
     699, None, "Japan", "200ml", None,
     "Spicy wasabi-infused oil — drizzle over sushi, seafood or salads for a pungent heat.",
     ["wasabi", "oil", "spicy", "dressing", "japanese", "condiment"], False, False),

    ("japanese/sushi-rice", "Premium Sushi Rice",
     599, 699, "Japan", "1kg", "Nishiki",
     "Premium Japanese short-grain rice specially cultivated for sushi. Sticky, glossy texture that holds together perfectly.",
     ["sushi rice", "japanese rice", "short grain", "premium", "sticky rice"], True, True),

    ("japanese/thai-rice-jasmine", "Thai Jasmine Rice",
     299, None, "Thailand", "1kg", "Royal Thai",
     "Fragrant Thai jasmine rice (KDML 105) with a natural floral aroma. Cook by absorption method for perfect fluffy rice.",
     ["jasmine rice", "thai rice", "fragrant", "long grain", "cooking"], False, False),

    ("japanese/hondashi", "Hondashi Dashi Stock Powder",
     499, 599, "Japan", "100g", "Ajinomoto",
     "Ajinomoto Hondashi — the most popular dashi powder in Japan. Made from katsuobushi (bonito). Essential for miso soup, noodles and Japanese simmered dishes.",
     ["hondashi", "dashi", "bonito", "japanese", "soup stock", "ajinomoto"], True, True),

    ("japanese/konbudashi", "Konbudashi (Kelp Dashi Powder)",
     549, None, "Japan", "60g", None,
     "Vegetarian kelp-based dashi powder for a clean, mineral-rich umami stock. Perfect for vegan Japanese cooking.",
     ["konbu", "kelp", "dashi", "vegan", "soup stock", "vegetarian", "umami"], False, False),

    ("japanese/furikake", "Furikake Rice Seasoning",
     449, 499, "Japan", "80g (assorted)", None,
     "Colourful Japanese rice seasoning mix — dried fish, sesame, seaweed and egg. Sprinkle over rice, onigiri or popcorn.",
     ["furikake", "rice seasoning", "japanese", "topping", "nori", "sesame"], False, True),

    ("japanese/matcha-powder", "Matcha Green Tea Powder",
     999, 1199, "Japan / Uji", "50g (Ceremonial Grade)", "Aiya",
     "Premium ceremonial grade matcha from Uji, Kyoto — vibrant green, umami-rich with no bitterness. For matcha latte, desserts and tea ceremony.",
     ["matcha", "green tea", "japanese", "ceremonial grade", "uji", "premium", "latte"], True, True),

    ("japanese/japanese-pepper", "Shichimi Togarashi (7-Spice Blend)",
     399, None, "Japan", "40g", "S&B",
     "S&B Shichimi — Japan's iconic 7-spice chilli blend with orange peel, sesame, nori and sansho pepper. Sprinkle on ramen, udon or yakitori.",
     ["shichimi", "togarashi", "7 spice", "japanese", "chilli", "condiment", "ramen"], False, True),

    ("japanese/katsuobushi", "Katsuobushi (Bonito Flakes)",
     699, 799, "Japan", "100g", None,
     "Smoky, paper-thin bonito flakes (katsuobushi) — for dashi, okonomiyaki topping, takoyaki and Japanese omelette.",
     ["katsuobushi", "bonito flakes", "dashi", "okonomiyaki", "japanese", "umami"], True, False),

    ("japanese/panko-crumbs", "Panko Bread Crumbs",
     299, None, "Japan", "500g", None,
     "Japanese panko breadcrumbs — larger, flakier and crunchier than regular breadcrumbs. The secret to perfect tonkatsu, ebi fry and karaage.",
     ["panko", "breadcrumbs", "japanese", "tonkatsu", "karaage", "coating"], False, True),

    ("japanese/sesame-seeds", "Sesame Seeds (Black & White)",
     249, None, "Japan / India", "200g", None,
     "Premium toasted sesame seeds — essential garnish for ramen, sushi, salads and stir-fries.",
     ["sesame seeds", "black", "white", "toasted", "japanese", "garnish"], False, False),

    ("japanese/sesame-paste", "Atari Goma (Sesame Paste)",
     699, 799, "Japan", "300g", None,
     "Japanese roasted white sesame paste — rich and nutty. Used for shabu-shabu dipping sauce, ramen tonkotsu broth and dressings.",
     ["sesame paste", "atari goma", "tahini", "japanese", "dressing", "ramen"], False, False),

    ("japanese/miso-paste", "Miso Paste (White / Shiro Miso)",
     549, 649, "Japan", "500g", "Hikari",
     "Hikari Shiro miso (white miso) — mild, slightly sweet with gentle umami. For miso soup, miso-glazed fish and dressings.",
     ["miso", "white miso", "shiro miso", "japanese", "fermented", "umami", "soup"], True, True),

    ("japanese/japanese-curry", "Japanese Curry (Golden Vermont)",
     499, 599, "Japan", "230g (8 servings)", "S&B Golden",
     "S&B Golden Vermont curry blocks — sweet-apple variety. Japan's most popular home-cooked dinner. Comes in mild, medium, and hot.",
     ["japanese curry", "golden curry", "curry block", "s&b", "easy dinner", "kids"], True, True),

    ("japanese/gari-pink", "Gari (Pink Pickled Ginger)",
     349, None, "Japan", "200g", None,
     "Sweet pink pickled ginger (gari) — the palate-cleanser served with every sushi platter. Made from young ginger root.",
     ["gari", "pickled ginger", "pink", "sushi", "japanese", "palate cleanser"], False, True),

    ("japanese/gari-white", "Gari (White Pickled Ginger)",
     349, None, "Japan", "200g", None,
     "Traditional white pickled ginger — natural colour without artificial dyes. Cleaner, purer taste.",
     ["gari", "pickled ginger", "white", "natural", "sushi", "japanese"], False, False),

    ("japanese/pickle-benishouga", "Benishouga (Red Pickled Ginger Strips)",
     349, None, "Japan", "200g", None,
     "Julienned red pickled ginger for topping gyudon, okonomiyaki and yakisoba. Distinctive vinegar-red flavour.",
     ["benishouga", "red ginger", "pickled", "japanese", "topping", "gyudon"], False, False),

    ("japanese/pickle-takuwan", "Takuwan (Yellow Pickled Daikon Radish)",
     299, None, "Japan", "250g", None,
     "Crunchy yellow pickled daikon — a Japanese pickle served with rice and bento boxes. Turmeric-coloured and tangy.",
     ["takuwan", "daikon", "pickled radish", "yellow", "japanese", "pickle", "bento"], False, False),

    ("japanese/pickle-umeboshi", "Umeboshi (Pickled Plum)",
     799, None, "Japan", "200g", None,
     "Authentic Japanese pickled plum (umeboshi) — intensely sour and salty. A traditional accompaniment to rice and onigiri filling.",
     ["umeboshi", "pickled plum", "ume", "sour", "japanese", "onigiri", "traditional"], False, False),

    ("japanese/ginger-hajikami", "Hajikami Ginger Sprout",
     499, None, "Japan", "100g", None,
     "Hajikami — delicate pickled ginger sprouts served as a garnish with grilled fish (yakizakana) and teppanyaki.",
     ["hajikami", "pickled ginger", "sprout", "garnish", "japanese", "sushi"], False, False),

    ("japanese/ramen-noodle", "Ramen Noodles",
     299, None, "Japan", "500g", None,
     "Authentic Japanese ramen noodles — wavy wheat noodles for tonkotsu, shoyu, miso and shio ramen soups.",
     ["ramen", "noodles", "japanese", "wheat", "soup noodles"], False, True),

    ("japanese/udon-noodle", "Udon Noodles (Thick)",
     349, None, "Japan", "500g", None,
     "Thick, chewy udon noodles — for kake udon, yaki udon stir-fry or curry udon. Traditional Japanese comfort food.",
     ["udon", "noodles", "thick", "japanese", "stir fry", "soup"], False, True),

    ("japanese/soba-noodle", "Soba Noodles (Buckwheat)",
     449, None, "Japan", "250g", None,
     "100% buckwheat soba noodles — healthy, nutty and gluten-reduced. Serve cold with dipping sauce (zaru soba) or hot in broth.",
     ["soba", "buckwheat", "noodles", "japanese", "healthy", "cold noodles"], False, False),

    ("japanese/somen-noodle", "Somen Noodles (Thin)",
     399, None, "Japan", "500g", None,
     "Extremely thin Japanese wheat noodles — served cold in summer with dipping sauce. The traditional Tanabata dish.",
     ["somen", "thin noodles", "japanese", "summer", "cold noodles"], False, False),

    ("japanese/glass-noodle", "Glass Noodles (Cellophane / Harusame)",
     249, None, "Japan / China", "200g", None,
     "Transparent mung bean noodles — absorb the flavours of soups and stir-fries beautifully. Use in japchae and sukiyaki.",
     ["glass noodles", "cellophane", "harusame", "transparent", "mung bean", "sukiyaki"], False, False),

    ("japanese/pad-thai-noodle", "Pad Thai Rice Noodles",
     249, None, "Thailand", "400g", None,
     "Flat rice noodles (sen lek) — the authentic noodle for pad thai, pho and Vietnamese stir-fry.",
     ["pad thai", "rice noodles", "flat noodles", "thai", "stir fry", "pho"], False, False),

    ("japanese/gochujang-paste", "Gochujang (Korean Chilli Paste)",
     499, 599, "Korea", "500g", "CJ",
     "CJ Gochujang — fermented Korean chilli paste with deep, spicy umami. Essential for bibimbap, tteokbokki and Korean fried chicken.",
     ["gochujang", "korean", "chilli paste", "spicy", "fermented", "bibimbap"], False, True),

    ("japanese/thai-curry-paste", "Thai Curry Paste (Red / Green / Yellow)",
     349, None, "Thailand", "400g", "Mae Ploy",
     "Mae Ploy authentic Thai curry paste — aromatic blend of lemongrass, galangal and chilli. Choose Red, Green or Yellow.",
     ["thai curry paste", "red curry", "green curry", "yellow curry", "mae ploy", "thai"], False, True),

    ("japanese/yuzu-koshu", "Yuzu Koshu (Citrus Chilli Paste)",
     1299, None, "Japan / Kyushu", "50g", None,
     "Yuzu koshu — a pungent paste of yuzu zest and green chilli. A tiny amount transforms grilled fish, sashimi or ramen.",
     ["yuzu koshu", "yuzu", "chilli paste", "japanese", "citrus", "gourmet"], False, False),

    ("japanese/sesame-dressing", "Roasted Sesame Dressing",
     399, 449, "Japan", "200ml", "Kewpie",
     "Kewpie roasted sesame dressing — creamy, nutty and slightly sweet. Perfect on salads, cold noodles and as a dipping sauce.",
     ["sesame dressing", "kewpie", "japanese", "salad dressing", "roasted sesame"], False, True),

    ("japanese/tofu", "Silken / Firm Tofu",
     249, None, "Japan", "300g", "Morinaga",
     "Premium Morinaga tofu — available in silken (for miso soup, smoothies) or firm (for stir-fry and grilling).",
     ["tofu", "silken", "firm", "japanese", "vegan", "protein", "miso soup"], False, False),

    ("japanese/bamboo-shoot", "Bamboo Shoot (Canned / Sliced)",
     299, None, "China / Thailand", "560g", None,
     "Sliced bamboo shoots — crunchy texture that absorbs sauces beautifully. Use in stir-fry, curry and Japanese nimono.",
     ["bamboo shoot", "canned", "asian", "stir fry", "vegetable", "nimono"], False, False),

    # ═══════════════════════════════════════════════════════
    # IMPORTED MEAT
    # ═══════════════════════════════════════════════════════
    ("meat/duck-whole", "Whole Duck (Eden Duck, Thailand)",
     2499, 2999, "Thailand", "1.8-2.2kg (whole)", "Eden Duck",
     "Premium Eden Duck from Thailand — renowned for its rich flavour and good fat distribution. Perfect for Peking duck, roast duck and duck confit.",
     ["duck", "whole duck", "eden duck", "thailand", "peking duck", "roast", "premium"], True, True),

    ("meat/duck-breast-raw", "Raw Duck Breast",
     1499, 1799, "France / Thailand", "2 pieces (400g)", None,
     "Premium duck breast with skin — score the skin and pan-sear to a perfect medium-rare. Serve with orange sauce or cherry reduction.",
     ["duck breast", "raw", "premium", "pan sear", "magret", "french"], True, True),

    ("meat/duck-breast-smoked", "Smoked Duck Breast (Sliced)",
     1999, 2299, "France", "200g (sliced)", None,
     "Thinly sliced smoked duck breast — rich and savoury. Ready to eat in salads, sandwiches or as an elegant charcuterie starter.",
     ["smoked duck", "duck breast", "sliced", "ready to eat", "charcuterie", "premium"], True, False),

    ("meat/duck-legs", "Duck Legs (Confit Ready)",
     1299, 1499, "France / Thailand", "2 pieces (600g)", None,
     "Duck legs ideal for confit — slow-cook in duck fat for 3 hours for silky, fall-off-the-bone perfection.",
     ["duck legs", "confit", "slow cook", "french", "premium", "cassoulet"], False, False),

    ("meat/turkey-whole", "Whole Turkey (Butterball)",
     5999, 6999, "USA", "5-6kg (whole)", "Butterball",
     "Authentic Butterball turkey from the USA — the #1 Thanksgiving and Christmas turkey brand. Succulent, pre-basted for maximum juiciness.",
     ["turkey", "butterball", "whole turkey", "christmas", "thanksgiving", "usa", "roast"], True, True),

    ("meat/pork-bacon-streaky", "Pork Streaky Bacon",
     699, 849, "Netherlands / Denmark", "250g", None,
     "Thin-sliced streaky pork bacon with the perfect fat-to-lean ratio. For breakfast fry-ups, BLT sandwiches, pasta carbonara.",
     ["streaky bacon", "pork bacon", "breakfast", "bacon rashers", "imported"], True, True),

    ("meat/pork-bacon-back", "Pork Back Bacon (Sliced)",
     799, 949, "Netherlands / Denmark", "250g", None,
     "Lean back bacon — more meat, less fat. The classic British-style rasher for a healthy English breakfast.",
     ["back bacon", "lean bacon", "pork", "british", "breakfast", "sliced"], False, False),

    ("meat/pork-loin-ribs", "Pork Loin Ribs (Rack)",
     1299, 1599, "USA / Netherlands", "700g (rack)", None,
     "Full rack of pork loin ribs — for BBQ, oven-baked ribs or Chinese-style char siu ribs.",
     ["pork ribs", "loin ribs", "rack", "bbq", "barbecue", "char siu"], True, True),

    ("meat/pork-tenderloin", "Pork Tenderloin (Fillet)",
     1099, 1299, "Netherlands", "400-500g (whole)", None,
     "The leanest pork cut — ultra-tender, perfect for quick roasting, pan-frying or sous vide. Pairs beautifully with mustard sauce.",
     ["pork tenderloin", "pork fillet", "lean", "premium", "roast", "sous vide"], False, False),

    ("meat/pork-collar", "Pork Collar / Boston Butt",
     899, None, "Netherlands", "1kg", None,
     "Pork collar / Boston Butt — the ideal cut for slow-cooked pulled pork, char siu and Filipino lechon.",
     ["pork collar", "boston butt", "shoulder", "pulled pork", "char siu", "slow cook"], False, False),

    ("meat/pork-loin-chops", "Pork Loin Chops (Bone-In)",
     999, 1199, "Netherlands", "500g (2 pieces)", None,
     "Thick-cut bone-in pork loin chops — for grilling, pan-frying or baking. Better flavour than boneless cuts.",
     ["pork chops", "bone in", "loin chops", "grilling", "premium"], False, False),

    ("meat/pork-belly", "Pork Belly (Skin On)",
     1199, 1399, "Netherlands", "1kg (slab)", None,
     "Pork belly slab with skin — for crispy roast pork, Chinese-style hong shao rou (red braised pork), or chashu ramen.",
     ["pork belly", "skin on", "crispy pork", "roast", "ramen chashu", "braised"], True, True),

    ("meat/pork-loin-boneless", "Pork Loin (Boneless)",
     1099, None, "Netherlands", "1kg", None,
     "Boneless pork loin — versatile for roasting whole, slicing into schnitzels or making pork schnitzel.",
     ["pork loin", "boneless", "roast", "schnitzel", "versatile", "lean"], False, False),

    ("meat/lamb-rack-cap-off", "Lamb Rack (Cap Off) — New Zealand",
     4499, 4999, "New Zealand", "700-800g (8 bones)", None,
     "Frenched New Zealand lamb rack — cap removed for clean presentation. The most impressive dinner party centrepiece. Herb-crusted or marinated.",
     ["lamb rack", "frenched", "new zealand", "premium", "lamb", "roast", "dinner party"], True, True),

    ("meat/lamb-rack-cap-on", "Lamb Rack (Cap On) — New Zealand",
     3999, 4499, "New Zealand", "800-900g (8 bones)", None,
     "New Zealand grass-fed lamb rack with cap on — full flavour from the fat covering. Superior marbling and taste.",
     ["lamb rack", "cap on", "new zealand", "grass fed", "premium", "lamb"], True, False),

    ("meat/lamb-shank", "Lamb Shank (Hind) — New Zealand",
     1299, 1499, "New Zealand", "2 pieces (800g)", None,
     "New Zealand lamb shank — slow-braise in red wine for 3 hours for supremely tender, fall-off-the-bone results.",
     ["lamb shank", "hind shank", "new zealand", "braised", "slow cook", "premium"], True, True),

    ("meat/lamb-loin-boneless", "Lamb Loin (Boneless) — New Zealand",
     2999, 3499, "New Zealand", "400g", None,
     "Boneless lamb loin — the most tender lamb cut. Pan-sear quickly and serve medium-rare for a premium restaurant experience.",
     ["lamb loin", "boneless", "tender", "new zealand", "premium", "pan sear"], False, False),

    ("meat/lamb-loin-chop", "Lamb Loin Chop (T-Bone) — New Zealand",
     2499, 2999, "New Zealand", "400g (2 pieces)", None,
     "T-bone lamb loin chops — includes both the loin and tenderloin. Grill over high heat for a quick, impressive meal.",
     ["lamb chop", "loin chop", "t-bone", "new zealand", "grilling", "premium"], False, False),

    ("meat/lamb-leg-boneless", "Lamb Leg (Boneless, Rolled) — New Zealand",
     3499, 3999, "New Zealand", "1.2-1.5kg (rolled)", None,
     "Boneless rolled New Zealand lamb leg — ready to stuff and roast. Yields perfectly even slices for a Sunday roast.",
     ["lamb leg", "boneless", "rolled", "new zealand", "roast", "sunday roast", "premium"], True, False),

    # ═══════════════════════════════════════════════════════
    # GROCERIES
    # ═══════════════════════════════════════════════════════
    ("groceries/filo-pastry", "Filo Pastry Sheets",
     499, None, "Greece / Turkey", "500g (30 sheets)", None,
     "Paper-thin filo pastry sheets — for baklava, spanakopita, samosas and Middle Eastern pastries. Butter and layer for maximum crispness.",
     ["filo", "phyllo", "pastry", "baklava", "spanakopita", "greek", "thin"], False, True),

    ("groceries/kataifi-pastry", "Kataifi Shredded Pastry",
     549, None, "Greece / Turkey", "500g", None,
     "Shredded filo dough (kataifi) — for crispy nests filled with nuts and syrup, or for coating prawns.",
     ["kataifi", "shredded filo", "pastry", "greek", "baklava", "prawn coating"], False, False),

    ("groceries/puff-pastry", "Puff Pastry (Ready Rolled)",
     449, 529, "France / UK", "500g (2 sheets)", None,
     "Ready-rolled all-butter puff pastry — for sausage rolls, beef wellington, croissants, tarts and vol-au-vents.",
     ["puff pastry", "ready rolled", "croissant", "beef wellington", "tart", "french"], False, True),

    ("groceries/ajinomoto", "Ajinomoto (MSG Seasoning)",
     299, None, "Japan", "500g", "Ajinomoto",
     "Ajinomoto MSG — the original umami seasoning used in Japanese, Chinese and Thai cooking. A small pinch enhances any savoury dish.",
     ["ajinomoto", "msg", "seasoning", "umami", "japanese", "flavour enhancer"], False, False),

    ("groceries/tempura-powder", "Tempura Batter Powder",
     349, None, "Japan / Thailand", "1kg", None,
     "Professional tempura batter mix — just add ice water for a light, crispy coating on prawns, vegetables and fish.",
     ["tempura", "batter", "powder", "coating", "japanese", "fry"], False, True),

    ("groceries/chicken-seasoning-knorr", "Knorr Chicken Seasoning Powder",
     349, None, "Indonesia / Thailand", "1kg", "Knorr",
     "Knorr professional chicken powder — the backbone of restaurant-quality soups, rice and marinades across Asia.",
     ["knorr", "chicken powder", "seasoning", "bouillon", "umami", "soup", "restaurant"], False, True),

    ("groceries/rice-flour-glutinous", "Glutinous Rice Flour (Sweet Rice Flour)",
     249, None, "Thailand / Japan", "500g", None,
     "Glutinous rice flour for mochi, tangyuan, Thai sticky sweets and Japanese daifuku.",
     ["glutinous rice flour", "sweet rice flour", "mochi", "sticky", "thai", "japanese"], False, False),

    ("groceries/red-lotus-flour", "Red Lotus Rice Flour",
     299, None, "Thailand", "500g", "Red Lotus",
     "Premium Thai rice flour — finer than regular rice flour. For dim sum, Chinese steamed cake (bai tang gao) and rice noodles.",
     ["rice flour", "red lotus", "thai", "dim sum", "steamed cake", "chinese"], False, False),

    ("groceries/potato-starch", "Potato Starch",
     299, None, "Japan / Germany", "500g", None,
     "Fine potato starch — for karaage coating, Japanese thick sauces (ankake), and gluten-free baking.",
     ["potato starch", "katakuriko", "karaage", "gluten free", "thickener", "japanese"], False, False),

    ("groceries/wheat-starch", "Wheat Starch",
     249, None, "China", "400g", None,
     "Wheat starch for translucent dim sum wrappers (har gow skin), cheung fun rice rolls and crystal dumplings.",
     ["wheat starch", "dim sum", "har gow", "cheung fun", "crystal dumpling", "chinese"], False, False),

    ("groceries/mushroom-shiitake", "Dried Shiitake Mushrooms",
     699, 849, "Japan / China", "100g (dried)", None,
     "Premium dried shiitake mushrooms — rehydrate for intense umami in dashi, stir-fry and ramen. Soaking liquid is liquid gold.",
     ["shiitake", "dried mushroom", "umami", "dashi", "japanese", "chinese", "vegan"], True, True),

    ("groceries/mushroom-porcini", "Dried Porcini Mushrooms",
     999, 1199, "Italy", "50g (dried)", None,
     "Italian dried porcini — earthy, intense flavour for risotto, pasta sauce, beef stew and gourmet soups.",
     ["porcini", "dried mushroom", "italian", "risotto", "gourmet", "umami", "earthy"], True, False),

    ("groceries/mushroom-straw-canned", "Straw Mushrooms (Canned)",
     199, None, "Thailand", "425g (drained 240g)", None,
     "Whole straw mushrooms in brine — for Thai green curry, Chinese stir-fry and Vietnamese pho.",
     ["straw mushroom", "canned", "asian", "thai curry", "stir fry", "pho"], False, False),

    ("groceries/black-fungus", "Black Wood Ear Fungus (Dried)",
     349, None, "China", "100g (dried)", None,
     "Dried wood ear fungus — crunchy, gelatinous texture with subtle earthy flavour. Use in hot and sour soup, spring rolls and salads.",
     ["black fungus", "wood ear", "dried", "chinese", "hot sour soup", "crunchy"], False, False),

    ("groceries/white-fungus", "Silver Ear Fungus (Dried)",
     449, None, "China", "50g (dried)", None,
     "Dried white silver ear fungus — snow fungus traditionally used in Chinese sweet soups and healthy tonics.",
     ["silver ear", "white fungus", "snow fungus", "chinese", "tonic", "sweet soup", "healthy"], False, False),

    ("groceries/szechuan-pepper", "Szechuan Peppercorns",
     449, None, "China", "100g", None,
     "Authentic Szechuan (Sichuan) peppercorns — the unique mouth-numbing citrusy spice essential for authentic Chinese mapo tofu and kung pao chicken.",
     ["szechuan pepper", "sichuan", "peppercorns", "chinese", "numbing", "spice", "mapo tofu"], False, False),

    ("groceries/black-bean-dry", "Black Soy Beans (Dried)",
     249, None, "Japan / China", "500g", None,
     "Organic dried black soybeans — for Japanese kuromame (sweet simmered black beans) served at New Year and for nutritious cooking.",
     ["black bean", "soybean", "dried", "japanese", "kuromame", "protein", "vegan"], False, False),

    ("groceries/thai-curry-paste", "Thai Curry Paste — Namjai Brand",
     299, None, "Thailand", "400g", "Namjai",
     "Namjai authentic Thai curry pastes — freshly ground herbs and spices from Thailand. Superior to mass-market brands.",
     ["thai curry paste", "namjai", "thai", "authentic", "green curry", "red curry"], False, False),

    # ═══════════════════════════════════════════════════════
    # SAUCES & CONDIMENTS
    # ═══════════════════════════════════════════════════════
    ("sauces/sushi-vinegar", "Sushi Vinegar (Mizkan)",
     449, 529, "Japan", "360ml", "Mizkan",
     "Mizkan sushi vinegar — perfectly balanced seasoned rice vinegar for sushi rice. No need to mix your own; just add to warm rice.",
     ["sushi vinegar", "mizkan", "rice vinegar", "japanese", "sushi rice", "seasoned"], True, True),

    ("sauces/mirin", "Mirin (Sweet Rice Wine)",
     599, 699, "Japan", "500ml", "Kikkoman",
     "Kikkoman authentic mirin — sweet Japanese rice wine for teriyaki glaze, sukiyaki, miso soup and simmered dishes. Adds shine and sweetness.",
     ["mirin", "sweet rice wine", "kikkoman", "teriyaki", "japanese", "glazing"], True, True),

    ("sauces/sake", "Sake (Japanese Rice Wine for Cooking)",
     799, 899, "Japan", "720ml", None,
     "Authentic Japanese cooking sake — for removing fishy odours, tenderising meat and adding depth to soups and sauces.",
     ["sake", "rice wine", "japanese", "cooking sake", "teriyaki", "seafood"], False, True),

    ("sauces/soy-sauce-kikkoman", "Kikkoman Soy Sauce",
     499, 599, "Japan", "500ml", "Kikkoman",
     "The world's best-selling soy sauce — naturally brewed for 6 months in Japan. Balanced umami with no caramel colour. Essential in any kitchen.",
     ["soy sauce", "kikkoman", "japanese", "shoyu", "essential", "umami", "condiment"], True, True),

    ("sauces/soy-sauce-tamari", "Tamari Soy Sauce (Gluten-Free)",
     649, 749, "Japan", "500ml", "San-J",
     "San-J tamari — wheat-free, gluten-free soy sauce with a deeper, richer flavour than regular soy. Ideal for coeliacs and sashimi dipping.",
     ["tamari", "gluten free", "soy sauce", "wheat free", "coeliac", "japanese", "dipping"], False, False),

    ("sauces/mayonnaise-kewpie", "Kewpie Japanese Mayonnaise",
     549, 649, "Japan", "500g (squeeze bottle)", "Kewpie",
     "Kewpie — Japan's most loved mayonnaise made with rice vinegar and egg yolks only (no whites). Richer, tangier and creamier than regular mayo. The ultimate for okonomiyaki, takoyaki and sushi.",
     ["kewpie", "mayonnaise", "japanese mayo", "squeeze", "okonomiyaki", "creamy", "egg yolk"], True, True),

    ("sauces/oyster-sauce", "Oyster Sauce (LKK Premium)",
     449, 529, "China / Hong Kong", "510g", "Lee Kum Kee",
     "Lee Kum Kee Premium Oyster Sauce — invented by LKK in 1888. Rich, savoury concentrate for stir-fry, noodles and dim sum.",
     ["oyster sauce", "lkk", "lee kum kee", "panda", "chinese", "stir fry", "umami"], True, True),

    ("sauces/sesame-oil", "Sesame Oil (Kadoya Premium)",
     699, 799, "Japan", "327ml", "Kadoya",
     "Kadoya pure roasted sesame oil — the gold standard in Japanese sesame oils. Dark, nutty and aromatic. A finishing oil for ramen, salads and stir-fry.",
     ["sesame oil", "kadoya", "roasted sesame", "japanese", "finishing oil", "aromatic", "ramen"], True, True),

    ("sauces/tonkatsu-sauce", "Tonkatsu Sauce (Bulldog)",
     499, 579, "Japan", "500ml", "Bulldog",
     "Bulldog Tonkatsu sauce — Japan's famous thick fruity-sweet sauce for tonkatsu pork cutlets, korokke and Worcestershire-style dishes.",
     ["tonkatsu sauce", "bulldog", "katsu", "japanese", "worcestershire", "fruity", "thick"], False, True),

    ("sauces/sriracha-hot-sauce", "Sriracha Hot Chilli Sauce",
     399, 449, "USA / Thailand", "435ml", "Huy Fong",
     "Huy Fong Sriracha — the iconic rooster sauce. Garlicky, tangy heat for pho, tacos, eggs, pizza and anything that needs a kick.",
     ["sriracha", "hot sauce", "chilli sauce", "huy fong", "rooster sauce", "spicy", "thai"], True, True),

    ("sauces/sweet-chilli-sauce", "Sweet Chilli Sauce",
     299, None, "Thailand", "350ml", "Mae Ploy",
     "Mae Ploy sweet chilli sauce — the perfect balance of heat and sweetness. For spring rolls, satay, fish cakes and as a universal dipping sauce.",
     ["sweet chilli sauce", "thai", "mae ploy", "dipping", "spring rolls", "satay"], False, True),

    ("sauces/tabasco", "Tabasco Original Hot Sauce",
     549, 649, "USA", "60ml", "Tabasco",
     "The original Tabasco pepper sauce aged in oak barrels on Avery Island. Just 3 ingredients — tabasco peppers, salt, vinegar. Universal heat.",
     ["tabasco", "hot sauce", "original", "pepper sauce", "american", "spicy", "louisiana"], False, False),

    # ═══════════════════════════════════════════════════════
    # GOURMET PRODUCTS
    # ═══════════════════════════════════════════════════════
    ("gourmet/beluga-caviar", "Beluga Caviar (Premium Russian)",
     18999, None, "Russia / Caspian Sea", "30g tin", None,
     "The rarest, most prized caviar in the world — Beluga sturgeon roe from the Caspian Sea. Large, silver-grey pearls with a buttery, creamy flavour. Served on blini with crème fraîche.",
     ["beluga caviar", "caviar", "russian", "caspian", "luxury", "gourmet", "premium"], True, False),

    ("gourmet/osectra-caviar", "Osectra Caviar (Premium)",
     8999, 9999, "Iran / Russia", "30g tin", None,
     "Osectra (Osetra) sturgeon caviar — medium-sized golden-brown pearls with a distinctly nutty, briny flavour. The connoisseur's caviar.",
     ["osectra", "osetra", "caviar", "sturgeon", "gourmet", "premium", "luxury"], True, True),

    ("gourmet/ikura-salmon-roe", "Ikura Salmon Roe (Gourmet Tin)",
     2499, 2999, "Japan / Russia", "100g tin", None,
     "Premium large-format ikura salmon roe in an elegant gift tin — perfect for entertaining and gifting. Naturally marinated in dashi and soy.",
     ["ikura", "salmon roe", "gourmet", "gift", "tin", "premium", "japanese"], True, True),

    ("gourmet/tobikko", "Tobikko Mixed Flying Fish Roe",
     1499, 1799, "Japan", "500g (mixed colours)", None,
     "A premium mix of orange, black, green and red tobiko flying fish roe — the visual showstopper for sushi platters and canapés.",
     ["tobiko", "flying fish roe", "mixed", "orange", "black", "green", "gourmet", "sushi"], False, True),
]


# ─── Seeder functions ─────────────────────────────────────────────────────────

def seed_categories(db, wipe=False):
    if wipe:
        result = db.categories.delete_many({})
        print(f"  [wipe] Deleted {result.deleted_count} existing categories")

    cat_id_map = {}  # slug → ObjectId
    inserted = 0
    for cat in CATEGORIES:
        slug = cat["slug"]
        existing = db.categories.find_one({"slug": slug})
        if existing:
            cat_id_map[slug] = existing["_id"]
            continue
        doc = {**cat, "created_at": utcnow(), "updated_at": utcnow()}
        result = db.categories.insert_one(doc)
        cat_id_map[slug] = result.inserted_id
        inserted += 1

    print(f"  [OK] Categories: {inserted} inserted, {len(CATEGORIES) - inserted} already existed")
    return cat_id_map


def seed_products(db, cat_id_map, wipe=False):
    if wipe:
        result = db.products.delete_many({})
        print(f"  [wipe] Deleted {result.deleted_count} existing products")

    # Map category display names → slugs
    CAT_NAME_TO_SLUG = {
        "Frozen Seafood":    "frozen-seafood",
        "Japanese Products": "japanese-products",
        "Imported Meat":     "imported-meat",
        "Groceries":         "groceries",
        "Sauces":            "sauces-condiments",
        "Gourmet Products":  "gourmet-products",
    }

    inserted = 0
    skipped = 0

    for row in PRODUCTS:
        (folder, name, price, orig_price, origin, weight, brand,
         description, tags, is_featured, is_best_seller) = row

        # Derive slug from folder path (last component)
        folder_slug = folder.split("/")[-1]

        # Determine category
        # Read category from the folder prefix
        cat_prefix = folder.split("/")[0]
        prefix_to_cat = {
            "seafood":   "frozen-seafood",
            "japanese":  "japanese-products",
            "meat":      "imported-meat",
            "groceries": "groceries",
            "sauces":    "sauces-condiments",
            "gourmet":   "gourmet-products",
        }
        cat_slug = prefix_to_cat.get(cat_prefix, "groceries")
        category_id = cat_id_map.get(cat_slug)

        # Image paths from the generated placeholder files
        image_base = f"/assets/products/{folder}/{folder_slug}"
        images = [
            f"{image_base}-01.webp",
        ]
        # Only add second image if it's not a duplicate
        thumbnail = f"{image_base}-thumb.webp"

        # Skip if already exists
        if db.products.find_one({"slug": folder_slug}):
            skipped += 1
            continue

        doc = {
            "name": name,
            "slug": folder_slug,
            "category_id": category_id,
            "price": float(price),
            "original_price": float(orig_price) if orig_price else None,
            "description": description,
            "brand": brand,
            "origin": origin,
            "weight": weight,
            "images": images,
            "thumbnail": thumbnail,
            "tags": tags,
            "in_stock": True,
            "stock_quantity": 50,
            "rating": 0.0,
            "review_count": 0,
            "is_featured": is_featured,
            "is_best_seller": is_best_seller,
            "is_active": True,
            "meta_title": f"Buy {name} Online — Divya Luxury Seafoods Delhi",
            "meta_description": f"Order {name} online. Premium quality, fast delivery in Delhi NCR, Gurgaon, Noida. {description[:100]}",
            "attributes": {
                "origin": origin,
                "weight": weight,
                "brand": brand or "Divya Luxury Seafoods",
            },
            "created_at": utcnow(),
            "updated_at": utcnow(),
        }
        db.products.insert_one(doc)
        inserted += 1

    print(f"  [OK] Products: {inserted} inserted, {skipped} already existed")


def main():
    parser = argparse.ArgumentParser(description="Seed Divya Luxury Seafoods database")
    parser.add_argument("--wipe", action="store_true", help="Delete existing data before seeding")
    parser.add_argument("--products", action="store_true", help="Seed products only")
    parser.add_argument("--cats", action="store_true", help="Seed categories only")
    args = parser.parse_args()

    print(f"\n[Divya Luxury Seafoods Seeder]")
    print(f"  MongoDB: {MONGODB_URL}")
    print(f"  Database: {DATABASE_NAME}")
    print(f"  Wipe: {'YES — existing data will be deleted' if args.wipe else 'No (upsert mode)'}\n")

    client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]

    # Test connection
    try:
        client.admin.command("ping")
        print("  [OK] MongoDB connection successful\n")
    except Exception as e:
        print(f"  [ERROR] Cannot connect to MongoDB: {e}")
        print(f"    Make sure MongoDB is running at: {MONGODB_URL}")
        print(f"    If using Atlas, set MONGODB_URL in backend/.env")
        sys.exit(1)

    seed_cats = not args.products  # seed cats unless --products only
    seed_prods = not args.cats     # seed products unless --cats only

    if seed_cats:
        print("Seeding categories...")
        cat_id_map = seed_categories(db, wipe=args.wipe)
    else:
        # Build cat_id_map from existing data
        cat_id_map = {c["slug"]: c["_id"] for c in db.categories.find()}

    if seed_prods:
        print("\nSeeding products...")
        seed_products(db, cat_id_map, wipe=args.wipe)

    total_cats = db.categories.count_documents({})
    total_prods = db.products.count_documents({})
    print(f"\n{'-'*50}")
    print(f"  Database now has:")
    print(f"    {total_cats} categories")
    print(f"    {total_prods} products")
    print(f"{'-'*50}")
    print("\n  Done! Start your backend server and visit /products to see them.\n")


if __name__ == "__main__":
    main()
