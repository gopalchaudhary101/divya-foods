import logging

from pymongo import MongoClient
from pymongo.database import Database
from app.config import settings

logger = logging.getLogger("app.database")

_client: MongoClient | None = None
_database: Database | None = None


def connect_to_mongo() -> None:
    global _client, _database
    _client = MongoClient(
        settings.MONGODB_URL,
        serverSelectionTimeoutMS=5000,  # fail fast if Atlas is unreachable
        connectTimeoutMS=5000,
    )
    _database = _client[settings.DATABASE_NAME]
    logger.info("Connected to MongoDB — database: %s", settings.DATABASE_NAME)

    from app.utils.db_init import create_indexes
    create_indexes(_database)


def close_mongo_connection() -> None:
    if _client:
        _client.close()
        logger.info("MongoDB connection closed")


def get_database() -> Database:
    """Return the live database handle. Used by the get_db() FastAPI dependency."""
    return _database


def ping_database() -> bool:
    """
    Send a lightweight ping command to verify the connection is alive.
    Returns True on success, False on any network / auth error.
    """
    try:
        _client.admin.command("ping")
        return True
    except Exception:
        return False
