#!/usr/bin/env python3
"""
Migration script to add is_admin column to users table.

Run this on your production database before deploying the admin feature.

Usage:
    python scripts/migrate_add_is_admin.py

For PostgreSQL (production):
    DATABASE_URL=postgresql://... python scripts/migrate_add_is_admin.py
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


def migrate_sqlite(db_path: str) -> None:
    """Run migration on SQLite database."""
    import sqlite3

    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.cursor()

        # Check if column already exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [col[1] for col in cursor.fetchall()]

        if "is_admin" in columns:
            print("Column 'is_admin' already exists in users table. Skipping.")
            return

        # Add the column
        print("Adding 'is_admin' column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0")
        conn.commit()
        print("Migration complete!")
    finally:
        conn.close()


def migrate_postgresql(database_url: str) -> None:
    """Run migration on PostgreSQL database."""
    try:
        import psycopg2
    except ImportError:
        print("Error: psycopg2 not installed. Install with: pip install psycopg2-binary")
        sys.exit(1)

    conn = None
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        # Check if column already exists
        cursor.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'is_admin'
        """)

        if cursor.fetchone():
            print("Column 'is_admin' already exists in users table. Skipping.")
            return

        # Add the column
        print("Adding 'is_admin' column to users table...")
        cursor.execute("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE")
        conn.commit()
        print("Migration complete!")
    except psycopg2.Error:
        if conn is not None:
            conn.rollback()
        raise
    finally:
        if conn is not None:
            conn.close()


def main() -> None:
    database_url = os.environ.get("DATABASE_URL", "")

    if not database_url:
        # Default to local SQLite
        db_path = Path(__file__).parent.parent / "data" / "raid_planner.db"
        if not db_path.exists():
            print(f"Error: Database not found at {db_path}")
            sys.exit(1)
        print(f"Using SQLite database: {db_path}")
        migrate_sqlite(str(db_path))
    elif "postgresql" in database_url or "postgres" in database_url:
        print("Using PostgreSQL database")
        migrate_postgresql(database_url)
    elif "sqlite" in database_url:
        # Extract path from sqlite URL
        db_path = database_url.replace("sqlite:///", "").replace("sqlite+aiosqlite:///", "")
        print(f"Using SQLite database: {db_path}")
        migrate_sqlite(db_path)
    else:
        print(f"Error: Unsupported database URL format: {database_url}")
        sys.exit(1)


if __name__ == "__main__":
    main()
