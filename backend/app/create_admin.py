"""
Run this ONCE to create your first admin account, before anyone can
log in. There's no public signup endpoint on purpose (you asked for
"only I create accounts") — so the very first account has to be
created directly against the database, not through the API.

Usage (make sure your .env is filled in, and the database — local
Docker Compose or Supabase — is reachable):

    cd backend
    python -m app.create_admin

After this, log in through the frontend with the username/password
you enter here, then create any further accounts from the Admin panel.
"""
import getpass

from sqlalchemy import insert, select

from app.auth.security import hash_password
from app.db.connection import get_engine
from app.db.models import metadata, users


def main() -> None:
    engine = get_engine()
    metadata.create_all(engine)  # safe if tables already exist

    username = input("Admin username: ").strip()
    password = getpass.getpass("Admin password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords don't match. Aborting.")
        return
    if not username or not password:
        print("Username and password can't be empty. Aborting.")
        return

    with engine.begin() as conn:
        existing = conn.execute(select(users.c.id).where(users.c.username == username)).first()
        if existing:
            print(f"A user named '{username}' already exists. Aborting.")
            return

        conn.execute(
            insert(users).values(
                username=username,
                hashed_password=hash_password(password),
                is_admin=True,
            )
        )

    print(f"Admin user '{username}' created. You can now log in from the frontend.")


if __name__ == "__main__":
    main()
