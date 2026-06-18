"""Register /xrp slash commands with Discord (run once after bot setup).

Usage:
    cd backend
    python register_slash_commands.py

Reads DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID from backend/.env.
If DISCORD_CLIENT_ID is not set, it's derived from the bot token automatically.
"""

import asyncio
import base64
import sys
import os

# Load .env from backend directory
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

import httpx

BOT_TOKEN = os.environ.get("DISCORD_BOT_TOKEN", "").strip().strip('"')
CLIENT_ID = os.environ.get("DISCORD_CLIENT_ID", "").strip()

if not BOT_TOKEN:
    sys.exit("ERROR: DISCORD_BOT_TOKEN is not set in backend/.env")

if not CLIENT_ID:
    # Derive from bot token first segment (base64-encoded application ID)
    try:
        part = BOT_TOKEN.split(".")[0]
        padded = part + "=" * (-len(part) % 4)
        CLIENT_ID = base64.b64decode(padded).decode("ascii")
        print(f"Derived application ID from token: {CLIENT_ID}")
    except Exception as e:
        sys.exit(f"ERROR: Could not derive client ID from bot token: {e}")

# Command definition — /xrp with a 'link' subcommand
COMMANDS = [
    {
        "name": "xrp",
        "description": "XIVRaidPlanner bot commands",
        "options": [
            {
                "name": "link",
                "description": "Link this Discord server to your XIVRaidPlanner static",
                "type": 1,  # SUB_COMMAND
                "options": [
                    {
                        "name": "code",
                        "description": "Claim code from XIVRaidPlanner (format: XRP-XXXX-XXXX)",
                        "type": 3,  # STRING
                        "required": True,
                    }
                ],
            }
        ],
    }
]


async def register():
    url = f"https://discord.com/api/v10/applications/{CLIENT_ID}/commands"
    headers = {
        "Authorization": f"Bot {BOT_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        for cmd in COMMANDS:
            print(f"Registering /{cmd['name']} …")
            r = await client.post(url, headers=headers, json=cmd)
            if r.status_code in (200, 201):
                data = r.json()
                print(f"  OK — command ID: {data['id']}")
            else:
                print(f"  FAILED ({r.status_code}): {r.text}")
                sys.exit(1)

    print("\nDone. Set the Interactions Endpoint URL in the Discord Developer Portal:")
    print("  https://discord.com/developers/applications/<app-id>/information")
    print("  Interactions Endpoint URL: https://<your-domain>/api/discord/interactions")


if __name__ == "__main__":
    asyncio.run(register())
