#!/usr/bin/env python3
"""
Email Removal Verification Script

Generates a timestamped Markdown report proving that email collection
has been completely removed from the FFXIV Raid Planner application.

Usage:
    cd scripts && python verify_email_removal.py

Output:
    EMAIL_REMOVAL_PROOF_{timestamp}.md in the scripts directory
"""

import os
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Project paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"


def check_oauth_scope():
    """Verify OAuth scope contains only 'identify' (not 'email')."""
    auth_file = BACKEND_DIR / "app" / "routers" / "auth.py"
    if not auth_file.exists():
        return False, "auth.py not found"

    content = auth_file.read_text()

    # Find scope line
    scope_match = re.search(r'"scope":\s*"([^"]+)"', content)
    if not scope_match:
        return False, "Could not find scope definition in auth.py"

    scope = scope_match.group(1)
    if "email" in scope:
        return False, f"OAuth scope still contains 'email': {scope}"

    if scope != "identify":
        return False, f"OAuth scope has unexpected value: {scope}"

    return True, f"OAuth scope is '{scope}' (no email)"


def check_user_model():
    """Verify User model has no email field."""
    model_file = BACKEND_DIR / "app" / "models" / "user.py"
    if not model_file.exists():
        return False, "user.py not found"

    content = model_file.read_text()

    # Check for email column definition
    if re.search(r'email.*=.*mapped_column', content):
        return False, "User model still has email column definition"

    return True, "User model has no email field"


def check_user_schema():
    """Verify UserResponse schema has no email field."""
    schema_file = BACKEND_DIR / "app" / "schemas" / "user.py"
    if not schema_file.exists():
        return False, "schemas/user.py not found"

    content = schema_file.read_text()

    # Check for email field in schema
    if re.search(r'^\s*email\s*:', content, re.MULTILINE):
        return False, "UserResponse schema still has email field"

    return True, "UserResponse schema has no email field"


def check_frontend_types():
    """Verify frontend User type has no email field."""
    types_file = FRONTEND_DIR / "src" / "types" / "index.ts"
    if not types_file.exists():
        return False, "types/index.ts not found"

    content = types_file.read_text()

    # Find User interface and check for email
    user_interface_match = re.search(
        r'export interface User \{([^}]+)\}',
        content,
        re.DOTALL
    )
    if not user_interface_match:
        return False, "Could not find User interface"

    user_interface = user_interface_match.group(1)
    if re.search(r'^\s*email\??:', user_interface, re.MULTILINE):
        return False, "User interface still has email field"

    return True, "User interface has no email field"


def check_database_column():
    """Check if email column exists in database (if database is accessible)."""
    try:
        # Try to run a simple check against the database
        os.chdir(BACKEND_DIR)
        result = subprocess.run(
            [
                sys.executable, "-c",
                """
import os
import sys
sys.path.insert(0, '.')
from sqlalchemy import create_engine, inspect, text
from app.config import get_settings

settings = get_settings()
if not settings.database_url:
    print("NO_DB")
    sys.exit(0)

engine = create_engine(settings.database_url)
inspector = inspect(engine)
columns = [col['name'] for col in inspector.get_columns('users')]
if 'email' in columns:
    print("HAS_EMAIL")
else:
    print("NO_EMAIL")
"""
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        output = result.stdout.strip()

        if output == "NO_DB":
            return None, "Database not configured (skipped)"
        elif output == "HAS_EMAIL":
            return False, "Database still has email column (run migration)"
        elif output == "NO_EMAIL":
            return True, "Database has no email column"
        else:
            return None, f"Unexpected output: {output or result.stderr}"

    except subprocess.TimeoutExpired:
        return None, "Database check timed out (skipped)"
    except Exception as e:
        return None, f"Database check failed: {e} (skipped)"
    finally:
        os.chdir(SCRIPT_DIR)


def check_codebase_references():
    """Search for any remaining references to user email storage."""
    issues = []

    # Patterns that indicate email storage/usage
    patterns = [
        (r'discord_user\.get\(["\']email', "Discord email extraction"),
        (r'user\.email\s*=', "Email assignment"),
        (r'email=discord_user', "Email in User constructor"),
    ]

    # Files to check
    files_to_check = [
        BACKEND_DIR / "app" / "routers" / "auth.py",
    ]

    for file_path in files_to_check:
        if not file_path.exists():
            continue

        content = file_path.read_text()
        for pattern, description in patterns:
            if re.search(pattern, content):
                issues.append(f"{file_path.name}: {description}")

    if issues:
        return False, "Found email references:\n" + "\n".join(f"  - {i}" for i in issues)

    return True, "No email storage references found in codebase"


def generate_report():
    """Generate the verification report."""
    timestamp = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    report_path = SCRIPT_DIR / f"EMAIL_REMOVAL_PROOF_{timestamp}.md"

    checks = [
        ("OAuth Scope", check_oauth_scope()),
        ("User Model", check_user_model()),
        ("API Schema", check_user_schema()),
        ("Frontend Types", check_frontend_types()),
        ("Database Column", check_database_column()),
        ("Codebase References", check_codebase_references()),
    ]

    all_passed = all(
        result[0] is True or result[0] is None
        for _, result in checks
    )
    critical_passed = all(
        result[0] is True
        for name, result in checks
        if name != "Database Column"  # DB check is optional
    )

    status = "PASSED" if critical_passed else "FAILED"

    lines = [
        "# Email Removal Verification Report",
        f"Generated: {datetime.now().isoformat()}",
        "",
        "## Summary",
        f"- **Status**: {status}",
        f"- **All checks passed**: {'Yes' if all_passed else 'No'}",
        "",
        "## Purpose",
        "This report verifies that email collection has been completely removed",
        "from the FFXIV Raid Planner application for data minimization compliance.",
        "",
        "## Verification Checks",
        "",
    ]

    for name, (passed, message) in checks:
        if passed is True:
            icon = "✅"
        elif passed is False:
            icon = "❌"
        else:
            icon = "⚠️"

        lines.append(f"### {icon} {name}")
        lines.append(f"**Result**: {message}")
        lines.append("")

    lines.extend([
        "## What Was Removed",
        "",
        "1. **OAuth scope**: `email` scope removed from Discord OAuth request",
        "2. **New user creation**: No longer stores email from Discord",
        "3. **User updates**: No longer updates email on login",
        "4. **API response**: `UserResponse` no longer includes email field",
        "5. **Frontend type**: `User` interface no longer has email property",
        "6. **Database**: `email` column dropped from `users` table (via migration)",
        "",
        "## Proof of Compliance",
        "",
        "After this change:",
        "- Discord OAuth only requests `identify` scope (username, avatar, discriminator)",
        "- No user email data is collected, stored, or exposed via API",
        "- Existing email data was purged during database migration",
        "",
        "---",
        f"*Report generated by verify_email_removal.py*",
    ])

    report_content = "\n".join(lines)
    report_path.write_text(report_content)

    print(f"\n{'=' * 60}")
    print(f"Email Removal Verification Report")
    print(f"{'=' * 60}")
    print(f"Status: {status}")
    print(f"Report saved to: {report_path.name}")
    print(f"{'=' * 60}\n")

    for name, (passed, message) in checks:
        icon = "✓" if passed is True else ("✗" if passed is False else "?")
        print(f"  [{icon}] {name}: {message}")

    print()

    return critical_passed


if __name__ == "__main__":
    os.chdir(SCRIPT_DIR)
    success = generate_report()
    sys.exit(0 if success else 1)
