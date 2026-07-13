"""
Slug generation — shared between product_service and recipe_service, which
each had their own byte-identical copy of both functions.

Usage mirrors the existing two-step call pattern: slugify(title) first, then
unique_slug(db, collection, that_result) to resolve any collision. Kept as
two separate calls (rather than one combined helper) so callers can slugify
a value without immediately committing to a uniqueness check against a
specific collection.
"""

from typing import Optional

import re

from bson import ObjectId
from pymongo.database import Database


def slugify(text: str) -> str:
    slug = text.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug.strip())
    return re.sub(r'-+', '-', slug)


def unique_slug(db: Database, collection_name: str, base_slug: str, exclude_id: Optional[ObjectId] = None) -> str:
    """Appends -1, -2, ... to base_slug until it's unique in the given collection.
    base_slug is expected to already be slugified — call slugify() first."""
    collection = db[collection_name]
    slug = base_slug
    counter = 1
    while True:
        query: dict = {"slug": slug}
        if exclude_id:
            query["_id"] = {"$ne": exclude_id}
        if not collection.find_one(query, {"_id": 1}):
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1
