"""
Divya Foods — Promote User to Developer
=========================================
One-time CLI to promote an existing user (by email) to the "developer" role.

There is no admin/developer role-management UI for this — developer is a
rare, manually-bootstrapped role, not something granted through the app.

Usage (from the project root):
  cd backend
  python scripts/promote_to_developer.py someone@example.com
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from pymongo import MongoClient


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


def promote(email: str) -> None:
    client = MongoClient(MONGODB_URL)
    db = client[DATABASE_NAME]

    user = db.users.find_one({"email": email})
    if not user:
        print(f"No user found with email: {email}")
        client.close()
        sys.exit(1)

    if user.get("role") == "developer":
        print(f"{email} is already a developer.")
        client.close()
        return

    db.users.update_one({"_id": user["_id"]}, {"$set": {"role": "developer"}})
    print(f"Promoted {email} (was '{user.get('role')}') to 'developer'.")
    client.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/promote_to_developer.py <email>")
        sys.exit(1)
    promote(sys.argv[1])
