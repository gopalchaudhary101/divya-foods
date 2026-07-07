"""
Divya Luxury Seafoods — Create Admin / Developer Account
=========================================================
One-time CLI to create a brand-new admin or developer account directly,
without going through public signup (which always creates 'customer'
accounts — see app/services/auth_service.py:register_user).

Usage (from the project root):
  cd backend
  python scripts/create_admin.py <email> <name> <password> <role>

  role must be "admin" or "developer".

Example:
  python scripts/create_admin.py owner@divyafoods.com "Divya Owner" "MyS3cureP@ss" admin
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timezone
from pymongo import MongoClient
from passlib.context import CryptContext

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALLOWED_ROLES = {"admin", "developer"}


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
MONGODB_URL = ENV.get("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = ENV.get("DATABASE_NAME", "divyafoods")


def create_admin(email: str, name: str, password: str, role: str) -> None:
    email = email.lower().strip()

    if role not in ALLOWED_ROLES:
        print(f"Invalid role '{role}'. Must be one of: {', '.join(sorted(ALLOWED_ROLES))}")
        sys.exit(1)

    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    existing = db.users.find_one({"email": email})
    if existing:
        print(f"An account with email '{email}' already exists (role: {existing.get('role')}).")
        print("Use scripts/promote_to_developer.py, or update the role manually, instead.")
        client.close()
        sys.exit(1)

    now = datetime.now(timezone.utc)
    user_doc = {
        "name": name.strip(),
        "email": email,
        "phone": None,
        "password_hash": _pwd_context.hash(password),
        "role": role,
        "avatar": None,
        "is_active": True,
        "is_email_verified": True,
        "refresh_token": None,
        "reset_token": None,
        "reset_token_expires": None,
        "created_at": now,
        "updated_at": now,
    }

    result = db.users.insert_one(user_doc)
    print(f"Created {role} account: {email} (id: {result.inserted_id})")
    print("Log in at /admin/login with this email and password.")
    client.close()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("Usage: python scripts/create_admin.py <email> <name> <password> <role>")
        print("  role must be 'admin' or 'developer'")
        sys.exit(1)
    create_admin(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
