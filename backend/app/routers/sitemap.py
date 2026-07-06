"""
SEO router — public, unauthenticated.

GET /sitemap.xml → dynamic XML sitemap (all products/categories/static pages)
"""

from fastapi import APIRouter, Depends, Response
from pymongo.database import Database

from app.dependencies import get_db
from app.services import sitemap_service

router = APIRouter(tags=["SEO"])


@router.get("/sitemap.xml")
def get_sitemap(db: Database = Depends(get_db)):
    xml = sitemap_service.generate_sitemap_xml(db)
    return Response(content=xml, media_type="application/xml")
