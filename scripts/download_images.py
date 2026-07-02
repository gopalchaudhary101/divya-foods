"""
Divya Foods — Product Image Download & Management Script
=========================================================
Usage:
  1. Get a FREE Pexels API key at: https://www.pexels.com/api/
  2. Get a FREE Pixabay API key at: https://pixabay.com/api/docs/
  3. Add them to backend/.env:
       PEXELS_API_KEY=your_key_here
       PIXABAY_API_KEY=your_key_here
  4. Run: python scripts/download_images.py --batch 1

Batches:
  --batch 1  → Seafood (products 1-20)
  --batch 2  → Seafood continued (products 21-40)
  --batch 3  → Seafood finish (products 41-60)
  --batch 4  → Japanese fish & seaweed (61-80)
  --batch 5  → Japanese dry goods & noodles (81-100)
  --batch 6  → Japanese condiments & Meat duck/turkey (101-120)
  --batch 7  → Meat pork/lamb + Groceries (121-140)
  --batch 8  → Sauces + Gourmet (141-154)
  --placeholders → Generate placeholder images for all products
"""

import os
import sys
import json
import time
import argparse
import hashlib
import requests
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont

# ─── Paths ────────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR   = SCRIPT_DIR.parent
ASSETS_DIR = ROOT_DIR / "public" / "assets" / "products"
CATALOG_FILE = SCRIPT_DIR / "image_catalog.json"
REPORT_FILE  = SCRIPT_DIR / "download-report.md"

# ─── Load API keys from backend/.env ──────────────────────────────────────────
def load_env():
    env_path = ROOT_DIR / "backend" / ".env"
    env = {}
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env

ENV = load_env()
PEXELS_KEY  = ENV.get("PEXELS_API_KEY", "")
PIXABAY_KEY = ENV.get("PIXABAY_API_KEY", "")

# ─── Product Master List ───────────────────────────────────────────────────────
# Format: (folder_path, display_name, search_query, category)
PRODUCTS = [
    # ── BATCH 1: Frozen Seafood (1–20) ──────────────────────────────────────
    ("seafood/prawns-iqf",            "Frozen IQF Prawns",              "frozen peeled prawns white background",          "Frozen Seafood"),
    ("seafood/prawns-fresh",          "Fresh Head-On Prawns",           "fresh prawns head on raw seafood",               "Frozen Seafood"),
    ("seafood/prawns-tempura",        "Tempura Prawns",                 "tempura prawns fried japanese",                  "Frozen Seafood"),
    ("seafood/tilapia-fillet",        "Tilapia Fish Fillet",            "tilapia fish fillet raw white background",       "Frozen Seafood"),
    ("seafood/basa-fillet-indian",    "Indian Basa Fish Fillet",        "basa fish fillet raw fresh seafood",             "Frozen Seafood"),
    ("seafood/basa-fillet-vietnamese","Vietnamese Basa Fish Fillet",    "pangasius basa fish fillet vietnam",             "Frozen Seafood"),
    ("seafood/seabass-bethki",        "Bethki Indian Seabass Fillet",   "sea bass fillet raw fresh white",                "Frozen Seafood"),
    ("seafood/river-sole-fillet",     "River Sole Fish Fillet",         "sole fish fillet raw fresh seafood",             "Frozen Seafood"),
    ("seafood/surmai-seer-fish",      "Surmai Seer Fish",               "king fish seer fish raw fresh",                  "Frozen Seafood"),
    ("seafood/red-snapper-fillet",    "Red Snapper Fish Fillet",        "red snapper fillet raw fresh fish",              "Frozen Seafood"),
    ("seafood/pomfret-white",         "White Pomfret Fish",             "pomfret fish whole raw white",                   "Frozen Seafood"),
    ("seafood/octopus-whole",         "Octopus Whole",                  "octopus whole raw fresh seafood",                "Frozen Seafood"),
    ("seafood/squid-tube",            "Squid Tube IQF",                 "squid tube cleaned raw white background",        "Frozen Seafood"),
    ("seafood/squid-ring",            "Squid Ring",                     "calamari squid rings raw fresh",                 "Frozen Seafood"),
    ("seafood/squid-ink",             "Squid Ink",                      "squid ink black food photography",               "Frozen Seafood"),
    ("seafood/soft-shell-crabs",      "Soft Shell Crabs",               "soft shell crab raw frozen",                     "Frozen Seafood"),
    ("seafood/blue-crabs",            "Blue Crabs",                     "blue crab raw fresh seafood",                    "Frozen Seafood"),
    ("seafood/mud-crabs",             "Mud Crabs",                      "mud crab raw fresh live seafood",                "Frozen Seafood"),
    ("seafood/lobster-whole",         "Lobster Whole",                  "lobster whole raw fresh premium",                "Frozen Seafood"),
    ("seafood/lobster-tail",          "Lobster Tail",                   "lobster tail raw frozen premium seafood",        "Frozen Seafood"),

    # ── BATCH 2: Seafood continued (21–40) ───────────────────────────────────
    ("seafood/salmon-fillet-norwegian","Norwegian Salmon Fillet Sushi Grade","atlantic salmon fillet raw sushi grade pink", "Frozen Seafood"),
    ("seafood/salmon-smoked-fillet",  "Smoked Salmon Fillet",           "smoked salmon fillet sliced premium",            "Frozen Seafood"),
    ("seafood/salmon-portions",       "Salmon Portions",                "salmon portion fillet raw pink fish",            "Frozen Seafood"),
    ("seafood/salmon-smoked-portions","Smoked Salmon Portions",         "smoked salmon portion cut premium",              "Frozen Seafood"),
    ("seafood/salmon-loin",           "Salmon Loin Boneless",           "salmon loin belly boneless raw",                 "Frozen Seafood"),
    ("seafood/salmon-head",           "Salmon Head Gutted",             "salmon head fish raw fresh",                     "Frozen Seafood"),
    ("seafood/salmon-fresh-whole",    "Fresh Whole Salmon Gutted",      "whole salmon fish fresh gutted",                 "Frozen Seafood"),
    ("seafood/salmon-fresh-steaks",   "Fresh Salmon Steaks",            "salmon steak cross cut raw fresh",               "Frozen Seafood"),
    ("seafood/tuna-yellowfin-saku",   "Yellowfin Tuna Saku Block",      "yellowfin tuna saku block sushi grade red",      "Frozen Seafood"),
    ("seafood/chilean-sea-bass",      "Chilean Sea Bass",               "chilean sea bass fillet raw premium",            "Frozen Seafood"),
    ("seafood/black-cod",             "Black Cod Headless",             "black cod sablefish whole raw",                  "Frozen Seafood"),
    ("seafood/imitation-crab-sticks", "Imitation Crab Sticks",          "imitation crab sticks surimi",                   "Frozen Seafood"),
    ("seafood/tempura-prawns",        "Tempura Prawns Battered",        "tempura battered prawns ready cook",             "Frozen Seafood"),

    # ── BATCH 3: Japanese Fish & Roe (41–60) ─────────────────────────────────
    ("japanese/hamachi-fillet",       "Hamachi Yellowtail Fillet",      "hamachi yellowtail fish fillet sushi",           "Japanese Products"),
    ("japanese/kampachi-fillet",      "Kampachi Amberjack Fillet",      "kampachi amberjack fish fillet premium",         "Japanese Products"),
    ("japanese/unagi-kabayaki",       "Unagi Kabayaki Grilled Eel",     "unagi eel kabayaki grilled japanese",            "Japanese Products"),
    ("japanese/tuna-loins",           "Tuna Loins Sushi Grade",         "tuna loin red raw sushi grade",                  "Japanese Products"),
    ("japanese/octopus-boiled",       "Japanese Octopus Boiled",        "boiled octopus japanese pink seafood",           "Japanese Products"),
    ("japanese/prawns-nobashi",       "Nobashi Prawns Japanese",        "nobashi prawn stretched japanese sushi",         "Japanese Products"),
    ("japanese/prawns-sweet",         "Sweet Prawns Japanese",          "amaebi sweet shrimp raw red japanese",           "Japanese Products"),
    ("japanese/scallops-hotate",      "Scallops Hotate",                "scallop hotate raw white premium sushi",         "Japanese Products"),
    ("japanese/ikura-salmon-roe",     "Ikura Salmon Roe",               "ikura salmon roe orange fish eggs sushi",        "Japanese Products"),
    ("japanese/tobikko-orange",       "Tobikko Orange Flying Fish Roe", "tobiko orange flying fish roe caviar",           "Japanese Products"),
    ("japanese/tobikko-black",        "Tobikko Black Flying Fish Roe",  "tobiko black flying fish roe caviar",            "Japanese Products"),
    ("japanese/tobikko-green",        "Tobikko Green Flying Fish Roe",  "tobiko green flying fish roe wasabi",            "Japanese Products"),
    ("japanese/edamame",              "Edamame Green Soybeans",         "edamame green soybeans pod bowl",                "Japanese Products"),
    ("japanese/wakame-chuke",         "Chuka Wakame Seaweed Salad",     "chuka wakame seaweed salad green japanese",      "Japanese Products"),
    ("japanese/wakame-dry",           "Dried Wakame Seaweed",           "dried wakame seaweed dark green",                "Japanese Products"),
    ("japanese/kaiso-salad",          "Kaiso Mixed Seaweed Salad",      "kaiso mixed seaweed salad japanese",             "Japanese Products"),
    ("japanese/nori-sheet",           "Nori Seaweed Sheet",             "nori seaweed sheet black sushi",                 "Japanese Products"),
    ("japanese/konbu-kelp",           "Konbu Dry Kelp",                 "konbu kelp dried seaweed japanese dashi",        "Japanese Products"),
    ("japanese/mamenori",             "Mamenori Colored Soy Sheet",     "mamenori soy paper sheet sushi",                 "Japanese Products"),
    ("japanese/hijiki",               "Hijiki Black Seaweed",           "hijiki black seaweed dry japanese health",       "Japanese Products"),

    # ── BATCH 4: Japanese Pantry (61–80) ─────────────────────────────────────
    ("japanese/bamboo-leaf",          "Bamboo Leaf Sushi",              "bamboo leaf green sushi japanese",               "Japanese Products"),
    ("japanese/gyoza-sheet",          "Gyoza Dumpling Sheet",           "gyoza dumpling wrappers white dough",            "Japanese Products"),
    ("japanese/wonton-sheet-white",   "Wonton Sheet White",             "wonton wrapper white dough chinese",             "Japanese Products"),
    ("japanese/wonton-sheet-yellow",  "Wonton Sheet Yellow",            "wonton wrapper yellow egg dough",                "Japanese Products"),
    ("japanese/spring-roll-sheet",    "Spring Roll Sheet",              "spring roll wrapper pastry sheet",               "Japanese Products"),
    ("japanese/wasabi-paste",         "Wasabi Paste",                   "wasabi paste green tube japanese",               "Japanese Products"),
    ("japanese/wasabi-powder",        "Wasabi Powder Horseradish",      "wasabi powder green horseradish japanese",       "Japanese Products"),
    ("japanese/wasabi-oil",           "Wasabi Oil",                     "wasabi oil green condiment japanese",            "Japanese Products"),
    ("japanese/sushi-rice",           "Sushi Rice Premium",             "sushi rice white japanese premium cooked",       "Japanese Products"),
    ("japanese/thai-rice-jasmine",    "Thai Jasmine Rice",              "jasmine rice white thai fragrant",               "Japanese Products"),
    ("japanese/hondashi",             "Hondashi Dashi Stock",           "hondashi dashi powder japanese soup stock",      "Japanese Products"),
    ("japanese/konbudashi",           "Konbudashi Kelp Stock",          "konbu kelp dashi stock powder",                  "Japanese Products"),
    ("japanese/furikake",             "Furikake Rice Seasoning",        "furikake japanese rice seasoning colorful",      "Japanese Products"),
    ("japanese/matcha-powder",        "Matcha Green Tea Powder",        "matcha green tea powder premium japanese",       "Japanese Products"),
    ("japanese/japanese-pepper",      "Shichimi Ichimi Pepper",         "shichimi togarashi japanese seven spice",        "Japanese Products"),
    ("japanese/katsuobushi",          "Katsuobushi Bonito Flakes",      "katsuobushi bonito flakes dried fish",           "Japanese Products"),
    ("japanese/panko-crumbs",         "Panko Bread Crumbs",             "panko breadcrumbs japanese white crispy",        "Japanese Products"),
    ("japanese/sesame-seeds",         "Sesame Seeds Black White",       "sesame seeds black white close up",              "Japanese Products"),
    ("japanese/sesame-paste",         "Atari Goma Sesame Paste",        "sesame paste tahini cream white jar",            "Japanese Products"),
    ("japanese/miso-paste",           "Miso Paste White",               "miso paste white japanese fermented soybean",    "Japanese Products"),

    # ── BATCH 5: Japanese Pickles & Noodles (81–100) ─────────────────────────
    ("japanese/japanese-curry",       "Japanese Curry Golden Vermont",  "japanese curry block golden medium hot",         "Japanese Products"),
    ("japanese/gari-pink",            "Gari Pink Pickled Ginger",       "gari pink pickled ginger sushi japanese",        "Japanese Products"),
    ("japanese/gari-white",           "Gari White Pickled Ginger",      "pickled ginger white sliced japanese",           "Japanese Products"),
    ("japanese/pickle-benishouga",    "Benishouga Red Ginger Pickle",   "benishouga red pickled ginger strips",           "Japanese Products"),
    ("japanese/pickle-takuwan",       "Takuwan Yellow Pickled Radish",  "takuwan daikon pickled radish yellow japanese",  "Japanese Products"),
    ("japanese/pickle-umeboshi",      "Umeboshi Plum Pickle",           "umeboshi pickled plum japanese red",             "Japanese Products"),
    ("japanese/ginger-hajikami",      "Hajikami Ginger Stick",          "hajikami pickled ginger sprout stem sushi",      "Japanese Products"),
    ("japanese/ramen-noodle",         "Ramen Noodle",                   "ramen noodle japanese wheat curly",              "Japanese Products"),
    ("japanese/udon-noodle",          "Udon Noodle Thick",              "udon noodle thick white japanese",               "Japanese Products"),
    ("japanese/soba-noodle",          "Soba Buckwheat Noodle",          "soba buckwheat noodle dry japanese",             "Japanese Products"),
    ("japanese/somen-noodle",         "Somen Thin Noodle",              "somen thin white noodle japanese",               "Japanese Products"),
    ("japanese/glass-noodle",         "Glass Noodle Cellophane",        "glass noodle cellophane transparent thai",       "Japanese Products"),
    ("japanese/pad-thai-noodle",      "Pad Thai Rice Noodle",           "pad thai rice noodle flat dried",                "Japanese Products"),
    ("japanese/gochujang-paste",      "Gochujang Korean Chili Paste",   "gochujang korean red chili paste fermented",     "Japanese Products"),
    ("japanese/thai-curry-paste",     "Thai Curry Paste",               "thai curry paste red green yellow jar",          "Japanese Products"),
    ("japanese/yuzu-koshu",           "Yuzu Koshu Citrus Paste",        "yuzu koshu citrus chili paste japanese green",   "Japanese Products"),
    ("japanese/sesame-dressing",      "Roasted Sesame Dressing",        "sesame dressing japanese roasted bottle",        "Japanese Products"),
    ("japanese/tofu",                 "Tofu Silken Firm",               "tofu block silken white soy japanese",           "Japanese Products"),
    ("japanese/bamboo-shoot",         "Bamboo Shoot Canned",            "bamboo shoot canned sliced asian",               "Japanese Products"),

    # ── BATCH 6: Imported Meat (101–120) ─────────────────────────────────────
    ("meat/duck-whole",               "Whole Duck Eden Duck Thailand",  "whole duck raw fresh frozen premium",            "Imported Meat"),
    ("meat/duck-breast-raw",          "Raw Duck Breast",                "duck breast raw fresh premium",                  "Imported Meat"),
    ("meat/duck-breast-smoked",       "Smoked Duck Breast",             "smoked duck breast sliced premium",              "Imported Meat"),
    ("meat/duck-legs",                "Duck Legs",                      "duck legs raw fresh poultry",                    "Imported Meat"),
    ("meat/turkey-whole",             "Whole Turkey Butterball",        "whole turkey raw fresh butterball thanksgiving",  "Imported Meat"),
    ("meat/pork-bacon-streaky",       "Pork Streaky Bacon",             "pork streaky bacon raw rashers",                 "Imported Meat"),
    ("meat/pork-bacon-back",          "Pork Back Bacon Sliced",         "back bacon sliced raw pork premium",             "Imported Meat"),
    ("meat/pork-loin-ribs",           "Pork Loin Ribs",                 "pork loin ribs rack raw premium",                "Imported Meat"),
    ("meat/pork-tenderloin",          "Pork Tenderloin",                "pork tenderloin raw whole premium",              "Imported Meat"),
    ("meat/pork-collar",              "Pork Collar Boston Butt",        "pork collar boston butt raw shoulder",           "Imported Meat"),
    ("meat/pork-loin-chops",          "Pork Loin Chops Bone-In",        "pork chops bone in raw thick cut",               "Imported Meat"),
    ("meat/pork-belly",               "Pork Belly Skin On",             "pork belly raw skin on slab premium",            "Imported Meat"),
    ("meat/pork-loin-boneless",       "Pork Loin Boneless",             "pork loin boneless raw fresh",                   "Imported Meat"),
    ("meat/lamb-rack-cap-off",        "Lamb Rack Cap Off New Zealand",  "lamb rack frenched cap off raw premium",         "Imported Meat"),
    ("meat/lamb-rack-cap-on",         "Lamb Rack Cap On New Zealand",   "lamb rack cap on raw new zealand grass fed",     "Imported Meat"),
    ("meat/lamb-shank",               "Lamb Shank Hind",                "lamb shank raw whole premium new zealand",       "Imported Meat"),
    ("meat/lamb-loin-boneless",       "Lamb Loin Boneless",             "lamb loin boneless raw premium",                 "Imported Meat"),
    ("meat/lamb-loin-chop",           "Lamb Loin Chop T-Bone",          "lamb loin chop t bone raw premium",              "Imported Meat"),
    ("meat/lamb-leg-boneless",        "Lamb Leg Boneless",              "lamb leg boneless rolled raw premium",           "Imported Meat"),

    # ── BATCH 7: Groceries (121–140) ─────────────────────────────────────────
    ("groceries/filo-pastry",         "Filo Pastry Sheets",             "filo phyllo pastry sheets thin layers",          "Groceries"),
    ("groceries/kataifi-pastry",      "Kataifi Shredded Pastry",        "kataifi shredded filo pastry nest",              "Groceries"),
    ("groceries/puff-pastry",         "Puff Pastry Ready Rolled",       "puff pastry sheet rolled ready bake",            "Groceries"),
    ("groceries/ajinomoto",           "Ajinomoto Monosodium Glutamate", "ajinomoto msg seasoning powder bag",             "Groceries"),
    ("groceries/tempura-powder",      "Tempura Batter Powder",          "tempura batter powder flour mix",                "Groceries"),
    ("groceries/chicken-seasoning-knorr","Knorr Chicken Seasoning Powder","knorr chicken powder seasoning bouillon",       "Groceries"),
    ("groceries/rice-flour-glutinous","Glutinous Rice Flour",           "glutinous sweet rice flour white bag",           "Groceries"),
    ("groceries/red-lotus-flour",     "Red Lotus Rice Flour",           "lotus rice flour thai cooking powder",           "Groceries"),
    ("groceries/potato-starch",       "Potato Starch",                  "potato starch powder white cooking thickener",   "Groceries"),
    ("groceries/wheat-starch",        "Wheat Starch",                   "wheat starch powder white cooking dim sum",      "Groceries"),
    ("groceries/mushroom-shiitake",   "Shiitake Mushroom Dried",        "dried shiitake mushroom dark close up",          "Groceries"),
    ("groceries/mushroom-porcini",    "Porcini Mushroom Dried",         "dried porcini mushroom italian gourmet",         "Groceries"),
    ("groceries/mushroom-straw-canned","Straw Mushroom Canned",         "straw mushroom canned asian cooking",            "Groceries"),
    ("groceries/black-fungus",        "Black Wood Ear Fungus",          "black wood ear fungus dried chinese",            "Groceries"),
    ("groceries/white-fungus",        "White Silver Ear Fungus",        "white silver ear fungus dried chinese health",   "Groceries"),
    ("groceries/szechuan-pepper",     "Szechuan Pepper Corn",           "szechuan sichuan pepper corn red spice",         "Groceries"),
    ("groceries/black-bean-dry",      "Black Bean Dry",                 "black bean dry whole soybean japanese",          "Groceries"),
    ("groceries/thai-curry-paste",    "Thai Curry Paste Namjai",        "thai curry paste jar red green yellow namjai",   "Groceries"),

    # ── BATCH 8: Sauces + Gourmet (141–154) ──────────────────────────────────
    ("sauces/sushi-vinegar",          "Sushi Vinegar Mizkan",           "sushi vinegar mizkan bottle japanese",           "Sauces"),
    ("sauces/mirin",                  "Mirin Sweet Rice Wine",          "mirin sweet cooking rice wine bottle japanese",  "Sauces"),
    ("sauces/sake",                   "Sake Japanese Rice Wine",        "sake japanese rice wine bottle cooking",         "Sauces"),
    ("sauces/soy-sauce-kikkoman",     "Kikkoman Soy Sauce",             "kikkoman soy sauce bottle japanese",             "Sauces"),
    ("sauces/soy-sauce-tamari",       "Tamari Soy Sauce Gluten Free",   "tamari soy sauce bottle gluten free",            "Sauces"),
    ("sauces/mayonnaise-kewpie",      "Kewpie Mayonnaise Japanese",     "kewpie mayonnaise bottle japanese squeeze",      "Sauces"),
    ("sauces/oyster-sauce",           "Oyster Sauce LKK",               "oyster sauce bottle panda lkk thai",             "Sauces"),
    ("sauces/sesame-oil",             "Sesame Oil Kadoya",              "sesame oil bottle kadoya dark japanese",         "Sauces"),
    ("sauces/tonkatsu-sauce",         "Tonkatsu Sauce Bulldog",         "tonkatsu sauce bulldog bottle japanese",         "Sauces"),
    ("sauces/sriracha-hot-sauce",     "Sriracha Hot Chilli Sauce",      "sriracha hot sauce red bottle thai",             "Sauces"),
    ("sauces/sweet-chilli-sauce",     "Sweet Chilli Sauce",             "sweet chilli sauce bottle thai",                 "Sauces"),
    ("sauces/tabasco",                "Tabasco Hot Sauce",              "tabasco hot sauce original red bottle",          "Sauces"),
    ("gourmet/beluga-caviar",         "Beluga Caviar Premium Russian",  "beluga caviar black tin premium luxury",         "Gourmet Products"),
    ("gourmet/osectra-caviar",        "Osectra Caviar Premium",         "osectra osetra caviar tin premium",              "Gourmet Products"),
    ("gourmet/ikura-salmon-roe",      "Ikura Salmon Roe Gourmet",       "ikura salmon roe orange gourmet tin",            "Gourmet Products"),
    ("gourmet/tobikko",               "Tobikko Flying Fish Roe Mix",    "tobiko flying fish roe colorful orange black green","Gourmet Products"),
]


# ─── Thumbnail sizes ──────────────────────────────────────────────────────────
THUMBNAIL_SIZE = (300, 300)
RESPONSIVE_SIZES = [400, 800, 1200]

# ─── Colors for placeholder images ────────────────────────────────────────────
PLACEHOLDER_COLORS = {
    "Frozen Seafood":    [(13, 71, 161), (21, 101, 192)],   # deep blue gradient
    "Japanese Products": [(183, 28, 28), (229, 57, 53)],    # Japanese red
    "Imported Meat":     [(74, 20, 140), (106, 27, 154)],   # dark purple
    "Groceries":         [(27, 94, 32), (46, 125, 50)],     # green
    "Cheese":            [(245, 127, 23), (251, 140, 0)],   # amber
    "Sauces":            [(62, 39, 35), (93, 64, 55)],      # dark brown
    "Gourmet Products":  [(49, 27, 146), (69, 39, 160)],    # royal purple
}


def create_placeholder(folder_path: Path, product_name: str, category: str, index: int) -> Path:
    """Create a premium-looking placeholder image with product name."""
    colors = PLACEHOLDER_COLORS.get(category, [(30, 30, 30), (50, 50, 50)])
    c1, c2 = colors[0], colors[1]

    img = Image.new("RGB", (1200, 1200), c1)
    draw = ImageDraw.Draw(img)

    # Gradient-like effect with overlapping rectangles
    for i in range(1200):
        ratio = i / 1200
        r = int(c1[0] + (c2[0] - c1[0]) * ratio)
        g = int(c1[1] + (c2[1] - c1[1]) * ratio)
        b = int(c1[2] + (c2[2] - c1[2]) * ratio)
        draw.line([(0, i), (1200, i)], fill=(r, g, b))

    # White border frame
    draw.rectangle([40, 40, 1160, 1160], outline=(255, 255, 255, 180), width=4)
    draw.rectangle([60, 60, 1140, 1140], outline=(255, 255, 255, 80), width=2)

    # Top label
    draw.rectangle([0, 0, 1200, 120], fill=(0, 0, 0, 120))

    try:
        font_large  = ImageFont.truetype("arial.ttf", 56)
        font_medium = ImageFont.truetype("arial.ttf", 40)
        font_small  = ImageFont.truetype("arial.ttf", 28)
        font_brand  = ImageFont.truetype("arialbd.ttf", 48)
    except Exception:
        font_large  = ImageFont.load_default()
        font_medium = font_large
        font_small  = font_large
        font_brand  = font_large

    # Divya Foods brand
    brand_text = "DIVYA FOODS"
    draw.text((600, 60), brand_text, fill=(255, 255, 255), font=font_brand, anchor="mm")

    # Camera icon placeholder area
    draw.ellipse([500, 300, 700, 500], outline=(255, 255, 255, 150), width=3)
    draw.line([(580, 390), (620, 390)], fill=(255, 255, 255, 150), width=3)
    draw.line([(600, 370), (600, 410)], fill=(255, 255, 255, 150), width=3)

    # Product name (wrap long names)
    words = product_name.upper().split()
    lines = []
    current = ""
    for word in words:
        if len(current + " " + word) <= 22:
            current = (current + " " + word).strip()
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)

    y_start = 580
    for line in lines:
        draw.text((600, y_start), line, fill=(255, 255, 255), font=font_large, anchor="mm")
        y_start += 70

    # "Premium Product Image" subtext
    draw.text((600, y_start + 30), "Premium Product Image Coming Soon", fill=(255, 255, 255, 180), font=font_small, anchor="mm")

    # Category badge
    draw.rounded_rectangle([200, 1020, 1000, 1090], radius=20, fill=(255, 255, 255, 30))
    draw.text((600, 1055), category.upper(), fill=(255, 255, 255), font=font_small, anchor="mm")

    # Bottom URL
    draw.text((600, 1140), "www.divyafoods.com", fill=(255, 255, 255, 120), font=font_small, anchor="mm")

    # Save as WebP
    slug = folder_path.name
    filename = f"{slug}-0{index}.webp"
    out_path = folder_path / filename
    img.save(str(out_path), "WEBP", quality=85)

    # Thumbnail
    thumb = img.copy()
    thumb.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
    thumb_path = folder_path / f"{slug}-thumb.webp"
    thumb.save(str(thumb_path), "WEBP", quality=80)

    return out_path


def search_pexels(query: str, per_page: int = 3) -> list[str]:
    """Search Pexels API and return list of image URLs."""
    if not PEXELS_KEY:
        return []
    headers = {"Authorization": PEXELS_KEY}
    params = {
        "query": query,
        "per_page": per_page,
        "orientation": "square",
        "size": "large",
    }
    try:
        resp = requests.get("https://api.pexels.com/v1/search", headers=headers, params=params, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            return [photo["src"]["large2x"] for photo in data.get("photos", [])]
    except Exception as e:
        print(f"  Pexels error: {e}")
    return []


def search_pixabay(query: str, per_page: int = 3) -> list[str]:
    """Search Pixabay API and return list of image URLs."""
    if not PIXABAY_KEY:
        return []
    params = {
        "key": PIXABAY_KEY,
        "q": query.replace(" ", "+"),
        "image_type": "photo",
        "orientation": "horizontal",
        "min_width": 1000,
        "min_height": 1000,
        "per_page": per_page,
        "safesearch": "true",
        "editors_choice": "false",
    }
    try:
        resp = requests.get("https://pixabay.com/api/", params=params, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            return [hit["largeImageURL"] for hit in data.get("hits", [])]
    except Exception as e:
        print(f"  Pixabay error: {e}")
    return []


def download_image(url: str, save_path: Path) -> bool:
    """Download image, convert to WebP, save."""
    try:
        resp = requests.get(url, timeout=30, stream=True)
        if resp.status_code != 200:
            return False
        img = Image.open(BytesIO(resp.content)).convert("RGB")
        # Resize to 1200×1200 square crop
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top  = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))
        img = img.resize((1200, 1200), Image.LANCZOS)
        img.save(str(save_path), "WEBP", quality=88)
        return True
    except Exception as e:
        print(f"  Download error: {e}")
        return False


def process_product(folder_key: str, product_name: str, search_query: str, category: str,
                    target_images: int = 3) -> dict:
    """Download or create placeholder images for one product."""
    folder_path = ASSETS_DIR / folder_key
    folder_path.mkdir(parents=True, exist_ok=True)
    slug = folder_path.name

    downloaded = []
    sources = []
    used_placeholder = False

    has_api = bool(PEXELS_KEY or PIXABAY_KEY)

    if has_api:
        print(f"  Searching: {search_query}")
        urls = search_pexels(search_query, per_page=target_images)
        if not urls and PIXABAY_KEY:
            urls = search_pixabay(search_query, per_page=target_images)

        for i, url in enumerate(urls[:target_images], start=1):
            out_path = folder_path / f"{slug}-0{i}.webp"
            success = download_image(url, out_path)
            if success:
                downloaded.append(str(out_path.relative_to(ROOT_DIR / "public")))
                sources.append(url)
                print(f"    ✓ Downloaded image {i}")
            time.sleep(0.5)

    # Fill remaining with placeholders
    for i in range(len(downloaded) + 1, target_images + 1):
        ph_path = create_placeholder(folder_path, product_name, category, i)
        downloaded.append(str(ph_path.relative_to(ROOT_DIR / "public")))
        used_placeholder = True
        print(f"    ○ Created placeholder {i}")

    # Thumbnail from first image
    thumb_path = folder_path / f"{slug}-thumb.webp"
    if not thumb_path.exists() and downloaded:
        first_img = ROOT_DIR / "public" / downloaded[0]
        if first_img.exists():
            img = Image.open(str(first_img))
            img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
            img.save(str(thumb_path), "WEBP", quality=80)

    return {
        "product_name": product_name,
        "category": category,
        "folder": folder_key,
        "images": downloaded,
        "thumbnail": str(thumb_path.relative_to(ROOT_DIR / "public")) if thumb_path.exists() else "",
        "needs_custom_image": used_placeholder or len(downloaded) == 0,
        "image_sources": sources,
        "license": "Pexels License / Pixabay License — Commercial use OK" if sources else "Placeholder — Needs replacement",
    }


def run_batch(batch_number: int, target_images: int = 3):
    """Run download for a specific batch (1-indexed, 20 products per batch)."""
    start = (batch_number - 1) * 20
    end   = start + 20
    batch_products = PRODUCTS[start:end]

    if not batch_products:
        print(f"No products in batch {batch_number}")
        return

    print(f"\n{'='*60}")
    print(f"BATCH {batch_number} — {len(batch_products)} products")
    print(f"API Keys: Pexels={'✓' if PEXELS_KEY else '✗'} | Pixabay={'✓' if PIXABAY_KEY else '✗'}")
    print(f"{'='*60}\n")

    catalog = load_catalog()
    results = []
    downloaded_count = 0
    placeholder_count = 0

    for i, (folder_key, product_name, search_query, category) in enumerate(batch_products, 1):
        print(f"[{i}/{len(batch_products)}] {product_name}")
        result = process_product(folder_key, product_name, search_query, category, target_images)
        results.append(result)
        catalog[folder_key] = result

        n_real = len(result["image_sources"])
        n_ph   = len(result["images"]) - n_real
        downloaded_count += n_real
        placeholder_count += n_ph

    save_catalog(catalog)
    generate_report(catalog)

    print(f"\n{'='*60}")
    print(f"BATCH {batch_number} COMPLETE")
    print(f"  Products processed : {len(batch_products)}")
    print(f"  Real images        : {downloaded_count}")
    print(f"  Placeholders       : {placeholder_count}")
    print(f"  Catalog saved      : {CATALOG_FILE}")
    print(f"  Report saved       : {REPORT_FILE}")
    print(f"{'='*60}\n")


def run_placeholders_only():
    """Generate placeholder images for ALL products (no API needed)."""
    print(f"\nGenerating placeholders for {len(PRODUCTS)} products...\n")
    catalog = load_catalog()
    for i, (folder_key, product_name, search_query, category) in enumerate(PRODUCTS, 1):
        folder_path = ASSETS_DIR / folder_key
        slug = folder_path.name
        # Only create if no images exist yet
        existing = list(folder_path.glob("*.webp"))
        if existing:
            print(f"[{i}] SKIP (has {len(existing)} images): {product_name}")
            continue
        print(f"[{i}] Creating placeholder: {product_name}")
        out_path = create_placeholder(folder_path, product_name, category, 1)
        thumb_path = folder_path / f"{slug}-thumb.webp"
        img = Image.open(str(out_path))
        img.thumbnail(THUMBNAIL_SIZE, Image.LANCZOS)
        img.save(str(thumb_path), "WEBP", quality=80)
        catalog[folder_key] = {
            "product_name": product_name,
            "category": category,
            "folder": folder_key,
            "images": [str(out_path.relative_to(ROOT_DIR / "public"))],
            "thumbnail": str(thumb_path.relative_to(ROOT_DIR / "public")),
            "needs_custom_image": True,
            "image_sources": [],
            "license": "Placeholder — Needs replacement",
        }

    save_catalog(catalog)
    generate_report(catalog)
    print(f"\nDone. {len(PRODUCTS)} placeholders created.")


def load_catalog() -> dict:
    if CATALOG_FILE.exists():
        try:
            return json.loads(CATALOG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_catalog(catalog: dict):
    CATALOG_FILE.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def generate_report(catalog: dict):
    total      = len(catalog)
    with_real  = sum(1 for p in catalog.values() if p.get("image_sources"))
    need_img   = sum(1 for p in catalog.values() if p.get("needs_custom_image"))
    total_imgs = sum(len(p.get("images", [])) for p in catalog.values())
    real_imgs  = sum(len(p.get("image_sources", [])) for p in catalog.values())
    ph_imgs    = total_imgs - real_imgs

    cats = {}
    for p in catalog.values():
        c = p.get("category", "Unknown")
        cats[c] = cats.get(c, 0) + 1

    lines = [
        "# Divya Foods — Image Download Report",
        "",
        f"**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "## Summary",
        "",
        f"| Metric | Count |",
        f"|--------|-------|",
        f"| Total products processed | {total} |",
        f"| Products with real images | {with_real} |",
        f"| Products needing real images | {need_img} |",
        f"| Total images created | {total_imgs} |",
        f"| Real downloaded images | {real_imgs} |",
        f"| Placeholder images | {ph_imgs} |",
        "",
        "## Category Breakdown",
        "",
        "| Category | Products |",
        "|----------|----------|",
    ]
    for cat, count in sorted(cats.items()):
        lines.append(f"| {cat} | {count} |")

    lines += [
        "",
        "## License Information",
        "",
        "| Source | License |",
        "|--------|---------|",
        "| Pexels | [Pexels License](https://www.pexels.com/license/) — Free for commercial use, no attribution required |",
        "| Pixabay | [Pixabay License](https://pixabay.com/service/license-summary/) — Free for commercial use |",
        "| Placeholder | Internal — must be replaced before launch |",
        "",
        "## Products Needing Custom Images",
        "",
    ]
    for key, p in catalog.items():
        if p.get("needs_custom_image"):
            lines.append(f"- `{key}` — {p['product_name']}")

    REPORT_FILE.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Divya Foods Image Manager")
    parser.add_argument("--batch",        type=int, help="Batch number to download (1-8)")
    parser.add_argument("--placeholders", action="store_true", help="Generate placeholders for all products")
    parser.add_argument("--images",       type=int, default=3, help="Images per product (default: 3)")
    args = parser.parse_args()

    if args.placeholders:
        run_placeholders_only()
    elif args.batch:
        run_batch(args.batch, target_images=args.images)
    else:
        print(__doc__)
        print("\nQuick start:")
        print("  python scripts/download_images.py --placeholders")
        print("  python scripts/download_images.py --batch 1")


if __name__ == "__main__":
    main()
