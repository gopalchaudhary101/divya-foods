"""
Seed script — populates MongoDB Atlas with demo categories and products.

Usage (from the backend/ directory):
    python seed_products.py

Environment: reads MONGODB_URL and DATABASE_NAME from .env (or env vars).
Safe to re-run — it skips anything that already exists (upserts by slug).
Images use Lorem Picsum placeholders (deterministic per slug) — replace
them with real Cloudinary URLs once CLOUDINARY_* vars are set in Railway.
"""

import os
import sys
from datetime import datetime, timezone

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URL   = os.getenv("MONGODB_URL",   "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "divyafoods")


def utcnow():
    return datetime.now(timezone.utc)


def picsum(seed: str) -> str:
    """Deterministic placeholder image from Lorem Picsum."""
    return f"https://picsum.photos/seed/{seed}/600/600"


CATEGORIES = [
    {"name": "Salmon",           "slug": "salmon",           "emoji": "🐟", "description": "Fresh Norwegian and Atlantic salmon fillets, steaks and portions."},
    {"name": "Prawns & Shrimp",  "slug": "prawns",           "emoji": "🍤", "description": "Jumbo tiger prawns, vannamei white shrimp and more."},
    {"name": "Tuna",             "slug": "tuna",             "emoji": "🐠", "description": "Sashimi-grade bluefin and yellowfin tuna steaks."},
    {"name": "Squid & Calamari", "slug": "squid",            "emoji": "🦑", "description": "Whole squid, cleaned tubes and ready-to-fry calamari rings."},
    {"name": "Crab",             "slug": "crab",             "emoji": "🦀", "description": "Snow crab clusters, whole crab and crab meat."},
    {"name": "Lobster",          "slug": "lobster",          "emoji": "🦞", "description": "Whole Canadian lobster and lobster tails."},
    {"name": "Octopus",          "slug": "octopus",          "emoji": "🐙", "description": "Whole cleaned octopus, baby octopus and tentacles."},
    {"name": "Japanese Grocery", "slug": "japanese-grocery", "emoji": "🍱", "description": "Miso paste, nori, mirin, soy sauce and other Japanese pantry essentials."},
]

PRODUCTS = [
    # ── Salmon ────────────────────────────────────────────────────────────────
    {
        "name": "Norwegian Atlantic Salmon Fillet",
        "slug": "norwegian-atlantic-salmon-fillet",
        "category_slug": "salmon",
        "description": (
            "Premium Norwegian Atlantic salmon, sourced directly from Fjord farms. "
            "Each fillet is individually vacuum-sealed and flash-frozen within hours of harvest "
            "to lock in freshness, colour and omega-3 content. "
            "Ideal for pan-searing, oven-baking or sashimi."
        ),
        "price": 1299.0,
        "original_price": 1599.0,
        "images": [picsum("norwegian-salmon-fillet"), picsum("salmon-raw-closeup")],
        "weight": "500g (2 fillets)",
        "origin": "Norway",
        "brand": "Fjord Fresh",
        "stock_quantity": 48,
        "tags": ["salmon", "frozen", "omega-3", "sashimi-grade", "norwegian"],
        "is_featured": True,
        "is_best_seller": True,
        "attributes": {"grade": "A+", "fat_content": "High", "skin_on": True},
    },
    {
        "name": "Sashimi Grade Salmon Block",
        "slug": "sashimi-grade-salmon-block",
        "category_slug": "salmon",
        "description": (
            "Restaurant-quality sashimi block, cut from the belly of Norwegian Atlantic salmon. "
            "Deep-red colour with superior marbling. "
            "Certified for raw consumption — no parasites, no additives. "
            "Thaw overnight in the fridge and slice against the grain."
        ),
        "price": 1899.0,
        "original_price": 2299.0,
        "images": [picsum("sashimi-salmon-block"), picsum("salmon-sashimi-plated")],
        "weight": "250g block",
        "origin": "Norway",
        "brand": "Fjord Fresh",
        "stock_quantity": 30,
        "tags": ["salmon", "sashimi", "raw", "japanese", "premium"],
        "is_featured": True,
        "is_best_seller": False,
        "attributes": {"grade": "Sashimi", "safe_raw": True},
    },

    # ── Prawns ─────────────────────────────────────────────────────────────────
    {
        "name": "Jumbo Tiger Prawns (Head-On)",
        "slug": "jumbo-tiger-prawns-head-on",
        "category_slug": "prawns",
        "description": (
            "Wild-caught black tiger prawns from South East Asian waters. "
            "Head-on for maximum flavour — the head releases sweetness into curries and gravies. "
            "Count: 10–12 pcs per kg. Devein easily with a cocktail stick before cooking."
        ),
        "price": 1150.0,
        "original_price": None,
        "images": [picsum("tiger-prawns-head-on"), picsum("tiger-prawns-grilled")],
        "weight": "1 kg",
        "origin": "Vietnam",
        "brand": None,
        "stock_quantity": 60,
        "tags": ["prawns", "frozen", "wild-caught", "tiger-prawns", "curry"],
        "is_featured": True,
        "is_best_seller": True,
        "attributes": {"count_per_kg": "10-12", "head_on": True, "deveined": False},
    },
    {
        "name": "Vannamei White Prawns (Peeled & Deveined)",
        "slug": "vannamei-white-prawns-peeled-deveined",
        "category_slug": "prawns",
        "description": (
            "Farm-raised Litopenaeus vannamei (Pacific white shrimp), peeled and deveined — "
            "ready to cook straight from the freezer. "
            "Count: 31–40 pcs per kg. Great for stir-fries, pasta, fried rice and cocktails."
        ),
        "price": 849.0,
        "original_price": 999.0,
        "images": [picsum("vannamei-white-prawns"), picsum("peeled-shrimp-bowl")],
        "weight": "500g",
        "origin": "India",
        "brand": "Ocean Harvest",
        "stock_quantity": 80,
        "tags": ["prawns", "frozen", "peeled", "deveined", "quick-cook"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"count_per_kg": "31-40", "head_on": False, "deveined": True},
    },

    # ── Tuna ───────────────────────────────────────────────────────────────────
    {
        "name": "Bluefin Tuna Steak",
        "slug": "bluefin-tuna-steak",
        "category_slug": "tuna",
        "description": (
            "Premium bluefin tuna loins, sliced into 2 cm steaks. "
            "Deep red, firm flesh with excellent fat marbling — "
            "sear for 90 seconds per side for a restaurant-quality result. "
            "Also excellent for tataki and poke bowls."
        ),
        "price": 2499.0,
        "original_price": 2999.0,
        "images": [picsum("bluefin-tuna-steak"), picsum("tuna-sear-pan")],
        "weight": "400g (2 steaks, 200g each)",
        "origin": "Japan",
        "brand": "Tokyo Marine",
        "stock_quantity": 20,
        "tags": ["tuna", "sashimi", "premium", "steak", "japanese"],
        "is_featured": True,
        "is_best_seller": False,
        "attributes": {"thickness_cm": 2, "grade": "Sashimi"},
    },
    {
        "name": "Yellowfin Tuna (Ahi) Portions",
        "slug": "yellowfin-tuna-ahi-portions",
        "category_slug": "tuna",
        "description": (
            "Wild-caught yellowfin tuna (Ahi) from the Indian Ocean. "
            "Vibrant red colour and mild, meaty flavour. "
            "Versatile — great for grilling, searing, or poke bowls. "
            "Each portion is vacuum-sealed for freshness."
        ),
        "price": 1499.0,
        "original_price": None,
        "images": [picsum("yellowfin-tuna-ahi"), picsum("tuna-poke-bowl")],
        "weight": "500g (2–3 portions)",
        "origin": "Maldives",
        "brand": None,
        "stock_quantity": 35,
        "tags": ["tuna", "ahi", "wild-caught", "poke"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"grade": "Restaurant"},
    },

    # ── Squid ──────────────────────────────────────────────────────────────────
    {
        "name": "Calamari Rings",
        "slug": "calamari-rings",
        "category_slug": "squid",
        "description": (
            "Pre-cleaned squid tubes, sliced into uniform rings — ready to coat and fry. "
            "Made from Indian squid (Loligo duvauceli), a mild, sweet variety perfect for calamari. "
            "No ink sac, no cartilage, no waste — just fry."
        ),
        "price": 649.0,
        "original_price": 799.0,
        "images": [picsum("calamari-rings-raw"), picsum("calamari-fried")],
        "weight": "500g",
        "origin": "India",
        "brand": "Coastal Catch",
        "stock_quantity": 55,
        "tags": ["squid", "calamari", "fry", "starter", "party"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"pre_cleaned": True, "ring_width_mm": "8-10"},
    },
    {
        "name": "Whole Cleaned Squid",
        "slug": "whole-cleaned-squid",
        "category_slug": "squid",
        "description": (
            "Whole squid, cleaned and ready for stuffing, grilling or slicing. "
            "Skin, ink sac and cartilage removed — just the body and tentacles. "
            "Excellent stuffed with rice or herbs, or grilled with olive oil and garlic."
        ),
        "price": 549.0,
        "original_price": None,
        "images": [picsum("whole-cleaned-squid"), picsum("grilled-squid")],
        "weight": "500g (2–3 whole squid)",
        "origin": "India",
        "brand": None,
        "stock_quantity": 40,
        "tags": ["squid", "whole", "grill", "stuff"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"pre_cleaned": True},
    },

    # ── Crab ───────────────────────────────────────────────────────────────────
    {
        "name": "Canadian Snow Crab Cluster",
        "slug": "canadian-snow-crab-cluster",
        "category_slug": "crab",
        "description": (
            "Wild-caught Canadian snow crab clusters, pre-cooked and frozen. "
            "Sweet, delicate white meat — all legs attached to the shoulder. "
            "Simply steam or boil from frozen for 8–10 minutes and serve with butter. "
            "One cluster serves 1 person generously."
        ),
        "price": 3299.0,
        "original_price": 3999.0,
        "images": [picsum("snow-crab-cluster"), picsum("crab-with-butter")],
        "weight": "500g (1 cluster)",
        "origin": "Canada",
        "brand": "Arctic King",
        "stock_quantity": 15,
        "tags": ["crab", "snow-crab", "premium", "pre-cooked"],
        "is_featured": True,
        "is_best_seller": False,
        "attributes": {"pre_cooked": True, "wild_caught": True},
    },
    {
        "name": "Whole Rock Crab",
        "slug": "whole-rock-crab",
        "category_slug": "crab",
        "description": (
            "Whole Indian rock crab, cleaned and frozen. "
            "Best for butter garlic crab, Kerala crab curry or the Singaporean chilli crab style. "
            "Weight is per piece — each crab weighs 500–700g. "
            "Steam or boil first (12–15 min), then toss in your sauce."
        ),
        "price": 899.0,
        "original_price": None,
        "images": [picsum("whole-rock-crab"), picsum("crab-curry")],
        "weight": "500–700g (1 whole crab)",
        "origin": "India",
        "brand": None,
        "stock_quantity": 25,
        "tags": ["crab", "whole", "curry", "butter-garlic"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"wild_caught": True, "pre_cooked": False},
    },

    # ── Lobster ────────────────────────────────────────────────────────────────
    {
        "name": "Canadian Lobster Tail",
        "slug": "canadian-lobster-tail",
        "category_slug": "lobster",
        "description": (
            "Cold-water Canadian lobster tails — the most prized cut. "
            "Shell-on for superior flavour during cooking. "
            "Butterfly the tail, brush with herb butter and grill 5 minutes per side. "
            "An impressive centrepiece for any dinner party."
        ),
        "price": 4499.0,
        "original_price": 5499.0,
        "images": [picsum("canadian-lobster-tail"), picsum("lobster-tail-grilled")],
        "weight": "300g (2 tails)",
        "origin": "Canada",
        "brand": "Atlantic Prime",
        "stock_quantity": 10,
        "tags": ["lobster", "premium", "grill", "date-night", "shell-on"],
        "is_featured": True,
        "is_best_seller": False,
        "attributes": {"shell_on": True, "cold_water": True},
    },

    # ── Octopus ────────────────────────────────────────────────────────────────
    {
        "name": "Baby Octopus (Cleaned)",
        "slug": "baby-octopus-cleaned",
        "category_slug": "octopus",
        "description": (
            "Tender baby octopus, already cleaned — beak and ink sac removed. "
            "Quick-cook option: grill or pan-fry for 2–3 minutes per side. "
            "Fantastic in Mediterranean salads, Korean BBQ style, or tossed with garlic and olive oil. "
            "Pro tip: blanch in boiling water for 1 minute first for extra tenderness."
        ),
        "price": 799.0,
        "original_price": 999.0,
        "images": [picsum("baby-octopus-raw"), picsum("octopus-grilled")],
        "weight": "500g",
        "origin": "India",
        "brand": None,
        "stock_quantity": 30,
        "tags": ["octopus", "baby", "grill", "mediterranean"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"pre_cleaned": True, "size": "baby"},
    },

    # ── Japanese Grocery ───────────────────────────────────────────────────────
    {
        "name": "Shiro Miso Paste (White Miso)",
        "slug": "shiro-miso-paste-white",
        "category_slug": "japanese-grocery",
        "description": (
            "Authentic Japanese white miso paste (shiro miso) from Kyoto. "
            "Mild, sweet and creamy — perfect for miso soup, glazes and salad dressings. "
            "Made from soybeans, rice, salt and koji mould. No artificial preservatives. "
            "One tub makes approximately 40 bowls of miso soup."
        ),
        "price": 449.0,
        "original_price": None,
        "images": [picsum("white-miso-paste"), picsum("miso-soup-bowl")],
        "weight": "400g",
        "origin": "Japan",
        "brand": "Marukome",
        "stock_quantity": 40,
        "tags": ["japanese", "miso", "fermented", "vegan", "pantry"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"type": "White (Shiro)", "vegan": True},
    },
    {
        "name": "Mirin (Hon Mirin) – Japanese Sweet Rice Wine",
        "slug": "hon-mirin-japanese-sweet-rice-wine",
        "category_slug": "japanese-grocery",
        "description": (
            "Hon Mirin — the real, fermented mirin with 14% alcohol. "
            "Adds depth, sweetness and glossy shine to teriyaki, yakitori, miso glazes and simmered dishes. "
            "Unlike mirin-style condiments, hon mirin has a richer, more complex flavour. "
            "Essential for Japanese home cooking."
        ),
        "price": 399.0,
        "original_price": 499.0,
        "images": [picsum("hon-mirin-bottle"), picsum("japanese-cooking-sauce")],
        "weight": "500ml",
        "origin": "Japan",
        "brand": "Takaraboshi",
        "stock_quantity": 35,
        "tags": ["japanese", "mirin", "sauce", "cooking-wine", "pantry"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"alcohol_pct": 14, "type": "Hon Mirin"},
    },
    {
        "name": "Kikkoman Koikuchi Soy Sauce",
        "slug": "kikkoman-koikuchi-soy-sauce",
        "category_slug": "japanese-grocery",
        "description": (
            "The original Kikkoman naturally brewed soy sauce — made in Japan since 1630. "
            "Lighter, sweeter and more aromatic than Chinese soy sauce. "
            "Brewed from soy, wheat, salt and water using traditional fermentation over months. "
            "The definitive all-purpose Japanese soy sauce for dipping, marinading and cooking."
        ),
        "price": 349.0,
        "original_price": None,
        "images": [picsum("kikkoman-soy-sauce"), picsum("soy-sauce-dipping")],
        "weight": "500ml",
        "origin": "Japan",
        "brand": "Kikkoman",
        "stock_quantity": 50,
        "tags": ["japanese", "soy sauce", "shoyu", "pantry", "kikkoman"],
        "is_featured": True,
        "is_best_seller": True,
        "attributes": {"type": "Koikuchi (Dark)", "naturally_brewed": True},
    },
    {
        "name": "Premium Roasted Nori Seaweed Sheets",
        "slug": "premium-roasted-nori-seaweed-sheets",
        "category_slug": "japanese-grocery",
        "description": (
            "Full-size roasted nori sheets for sushi rolls, onigiri and hand rolls. "
            "Sourced from the clean coastal waters of Japan, kiln-roasted for a crisp texture and deep umami flavour. "
            "Each sheet measures 19 x 21 cm — standard sushi size. "
            "Resealable pack to keep sheets crisp between uses."
        ),
        "price": 449.0,
        "original_price": 549.0,
        "images": [picsum("nori-seaweed-sheets"), picsum("sushi-roll-nori")],
        "weight": "25g (10 full sheets)",
        "origin": "Japan",
        "brand": "Yakinori",
        "stock_quantity": 45,
        "tags": ["japanese", "nori", "seaweed", "sushi", "onigiri", "pantry"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"sheets": 10, "size_cm": "19x21", "roasted": True},
    },
    {
        "name": "Hondashi Instant Dashi Stock Granules",
        "slug": "hondashi-instant-dashi-stock-granules",
        "category_slug": "japanese-grocery",
        "description": (
            "Ajinomoto's Hondashi — Japan's most widely used instant dashi granules. "
            "Dissolve in hot water in seconds to make a rich, authentic bonito dashi broth. "
            "Use as the base for miso soup, ramen, udon, chawanmushi and noodle sauces. "
            "One 50g pack makes approximately 20 cups of dashi stock."
        ),
        "price": 299.0,
        "original_price": None,
        "images": [picsum("hondashi-granules"), picsum("dashi-broth-bowl")],
        "weight": "50g",
        "origin": "Japan",
        "brand": "Ajinomoto",
        "stock_quantity": 60,
        "tags": ["japanese", "dashi", "stock", "bonito", "pantry", "instant"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"servings": 20, "type": "Bonito Dashi"},
    },
    {
        "name": "Japanese Short-Grain Sushi Rice (Koshihikari)",
        "slug": "japanese-short-grain-sushi-rice-koshihikari",
        "category_slug": "japanese-grocery",
        "description": (
            "Authentic Koshihikari-variety Japanese short-grain rice — the gold standard for sushi. "
            "Small, round grains that become perfectly sticky when cooked, "
            "holding together in nigiri and rolls without falling apart. "
            "Also superb for plain steamed rice, onigiri and donburi bowls."
        ),
        "price": 699.0,
        "original_price": 899.0,
        "images": [picsum("koshihikari-rice-bag"), picsum("japanese-rice-bowl")],
        "weight": "1 kg",
        "origin": "Japan",
        "brand": "Tamaki Gold",
        "stock_quantity": 35,
        "tags": ["japanese", "rice", "sushi rice", "koshihikari", "pantry"],
        "is_featured": True,
        "is_best_seller": False,
        "attributes": {"variety": "Koshihikari", "grain": "Short"},
    },
    {
        "name": "Japanese Rice Vinegar (Yonezu)",
        "slug": "japanese-rice-vinegar-yonezu",
        "category_slug": "japanese-grocery",
        "description": (
            "Pure Japanese rice vinegar — much milder and slightly sweeter than white wine vinegar. "
            "Essential for seasoning sushi rice, making ponzu sauce and Japanese-style pickles (tsukemono). "
            "Made from fermented rice with no additives or artificial flavours. "
            "One bottle seasons approximately 4 kg of cooked sushi rice."
        ),
        "price": 249.0,
        "original_price": None,
        "images": [picsum("rice-vinegar-bottle"), picsum("sushi-rice-seasoning")],
        "weight": "360ml",
        "origin": "Japan",
        "brand": "Mizkan",
        "stock_quantity": 45,
        "tags": ["japanese", "vinegar", "rice vinegar", "sushi", "pantry"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"type": "Rice vinegar", "acidity_pct": 4.2},
    },
    {
        "name": "Wasabi Paste (Japanese Horseradish Tube)",
        "slug": "wasabi-paste-tube",
        "category_slug": "japanese-grocery",
        "description": (
            "Ready-to-use wasabi paste in a convenient squeeze tube. "
            "A blend of real wasabi and horseradish for authentic heat and aroma. "
            "Serve alongside sashimi, sushi and ramen — or mix with soy sauce for a dipping sauce. "
            "Refrigerate after opening and use within 1 month."
        ),
        "price": 349.0,
        "original_price": 399.0,
        "images": [picsum("wasabi-paste-tube"), picsum("wasabi-sushi-plate")],
        "weight": "43g",
        "origin": "Japan",
        "brand": "S&B",
        "stock_quantity": 55,
        "tags": ["japanese", "wasabi", "condiment", "sushi", "sashimi"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"real_wasabi": True, "tube": True},
    },
    {
        "name": "Kewpie Japanese Mayonnaise",
        "slug": "kewpie-japanese-mayonnaise",
        "category_slug": "japanese-grocery",
        "description": (
            "Kewpie mayo — Japan's most iconic condiment. "
            "Creamier, richer and slightly tangier than Western mayonnaise, "
            "made with egg yolks only (no whole egg) and rice vinegar instead of white vinegar. "
            "Used in sushi rolls, okonomiyaki, takoyaki, potato salad and Japanese sandwiches (sando)."
        ),
        "price": 549.0,
        "original_price": 649.0,
        "images": [picsum("kewpie-mayo-squeeze"), picsum("japanese-mayo-dishes")],
        "weight": "300ml squeeze bottle",
        "origin": "Japan",
        "brand": "Kewpie",
        "stock_quantity": 40,
        "tags": ["japanese", "mayonnaise", "kewpie", "condiment", "pantry"],
        "is_featured": False,
        "is_best_seller": True,
        "attributes": {"egg_yolk_only": True, "vinegar": "Rice vinegar"},
    },
    {
        "name": "Kikkoman Teriyaki Marinade & Sauce",
        "slug": "kikkoman-teriyaki-sauce",
        "category_slug": "japanese-grocery",
        "description": (
            "Kikkoman's classic teriyaki sauce — a balanced blend of soy sauce, mirin and sugar "
            "that glazes, marinates and sauces in one bottle. "
            "Use as a marinade for chicken, salmon or tofu (30 mins), or brush on during grilling for a glossy caramelised finish. "
            "Also excellent as a stir-fry sauce."
        ),
        "price": 299.0,
        "original_price": None,
        "images": [picsum("kikkoman-teriyaki-bottle"), picsum("teriyaki-salmon-glaze")],
        "weight": "250ml",
        "origin": "Japan",
        "brand": "Kikkoman",
        "stock_quantity": 50,
        "tags": ["japanese", "teriyaki", "sauce", "marinade", "kikkoman"],
        "is_featured": False,
        "is_best_seller": False,
        "attributes": {"type": "Marinade & Sauce"},
    },
]


def run():
    print(f"Connecting to {MONGODB_URL[:30]}...")
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    # ── Categories ─────────────────────────────────────────────────────────────
    print("\n[Categories]")
    cat_id_map: dict[str, object] = {}

    for cat in CATEGORIES:
        existing = db.categories.find_one({"slug": cat["slug"]})
        if existing:
            cat_id_map[cat["slug"]] = existing["_id"]
            print(f"  skip  {cat['name']} (already exists)")
            continue

        doc = {
            "name":        cat["name"],
            "slug":        cat["slug"],
            "emoji":       cat["emoji"],
            "description": cat["description"],
            "image":       picsum(cat["slug"]),
            "is_active":   True,
            "sort_order":  CATEGORIES.index(cat),
            "created_at":  utcnow(),
            "updated_at":  utcnow(),
        }
        result = db.categories.insert_one(doc)
        cat_id_map[cat["slug"]] = result.inserted_id
        print(f"  added {cat['name']}")

    # ── Products ───────────────────────────────────────────────────────────────
    print("\n[Products]")
    for product in PRODUCTS:
        existing = db.products.find_one({"slug": product["slug"]})
        if existing:
            print(f"  skip  {product['name']} (already exists)")
            continue

        cat_id = cat_id_map.get(product["category_slug"])
        if cat_id is None:
            print(f"  ERROR {product['name']}: category '{product['category_slug']}' not found — skipping")
            continue

        doc = {
            "name":           product["name"],
            "slug":           product["slug"],
            "description":    product["description"],
            "price":          product["price"],
            "original_price": product.get("original_price"),
            "images":         product["images"],
            "category_id":    cat_id,
            "subcategory":    None,
            "brand":          product.get("brand"),
            "origin":         product.get("origin"),
            "weight":         product.get("weight"),
            "in_stock":       True,
            "stock_quantity": product["stock_quantity"],
            "rating":         0.0,
            "review_count":   0,
            "tags":           product["tags"],
            "is_featured":    product["is_featured"],
            "is_best_seller": product["is_best_seller"],
            "meta_title":     None,
            "meta_description": None,
            "attributes":     product.get("attributes", {}),
            "created_at":     utcnow(),
            "updated_at":     utcnow(),
        }
        db.products.insert_one(doc)
        print(f"  added {product['name']}")

    # ── Summary ────────────────────────────────────────────────────────────────
    total_cats = db.categories.count_documents({})
    total_products = db.products.count_documents({})
    print(f"\nDone. Database now has {total_cats} categories and {total_products} products.")
    client.close()


if __name__ == "__main__":
    run()
