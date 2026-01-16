/**
 * API Cookbook - Practical examples for using the FFXIV Raid Planner API
 *
 * Includes Python and curl examples for common workflows.
 *
 * Accessible at: /docs/api/cookbook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { CodeBlock, DualCodeBlock } from '../components/docs';

// Navigation items grouped by category
const NAV_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction' },
      { id: 'setup', label: 'Setup & Installation' },
      { id: 'auth-flow', label: 'Authentication Flow' },
    ],
  },
  {
    label: 'Common Workflows',
    items: [
      { id: 'create-static', label: 'Create a Static' },
      { id: 'setup-tier', label: 'Set Up a Tier' },
      { id: 'manage-players', label: 'Manage Players' },
      { id: 'import-bis', label: 'Import BiS' },
      { id: 'log-loot', label: 'Log Loot' },
      { id: 'track-pages', label: 'Track Pages' },
    ],
  },
  {
    label: 'Advanced Topics',
    items: [
      { id: 'invitations', label: 'Invitation Links' },
      { id: 'webhooks', label: 'Polling for Updates' },
      { id: 'error-handling', label: 'Error Handling' },
    ],
  },
];

// Flat list for scroll tracking
const NAV_SECTIONS = NAV_GROUPS.flatMap(group => group.items);

// Section header component
function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12 scroll-mt-6">
      <h2 className="text-2xl font-semibold text-accent mb-6 pb-2 border-b border-border-default">
        {title}
      </h2>
      {children}
    </section>
  );
}

// Subsection component
function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-lg font-medium text-text-primary mb-4">{title}</h3>
      {children}
    </div>
  );
}

// Info callout component
function InfoBox({
  type = 'info',
  title,
  children
}: {
  type?: 'info' | 'tip' | 'warning';
  title?: string;
  children: React.ReactNode;
}) {
  const colors = {
    info: 'bg-status-info/10 border-status-info/30 text-status-info',
    tip: 'bg-status-success/10 border-status-success/30 text-status-success',
    warning: 'bg-status-warning/10 border-status-warning/30 text-status-warning',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[type]} my-4`}>
      {title && <h4 className="font-medium mb-2">{title}</h4>}
      <div className="text-text-secondary text-sm">{children}</div>
    </div>
  );
}

// Sidebar Navigation Component
function NavSidebar({
  activeSection,
  onSectionClick
}: {
  activeSection: string;
  onSectionClick: (id: string) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [scrollState, setScrollState] = useState({ top: true, bottom: false });
  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const handleScroll = () => {
        const { scrollTop, scrollHeight, clientHeight } = node;
        setScrollState({
          top: scrollTop < 10,
          bottom: scrollTop + clientHeight >= scrollHeight - 10,
        });
      };
      node.addEventListener('scroll', handleScroll);
      handleScroll();
    }
  }, []);

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const handleClick = (id: string) => {
    onSectionClick(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <nav className="sticky top-6 w-56 shrink-0 hidden lg:block self-start h-fit z-40">
      <div className="relative bg-surface-card border border-border-subtle rounded-lg">
        <div
          className={`
            absolute top-0 left-0 right-0 h-6 rounded-t-lg pointer-events-none z-10
            bg-gradient-to-b from-surface-card to-transparent
            transition-opacity duration-150
            ${scrollState.top ? 'opacity-0' : 'opacity-100'}
          `}
        />

        <div
          ref={scrollContainerRef}
          className="p-3 max-h-[calc(100vh-6rem)] overflow-y-auto scrollbar-thin"
        >
          {NAV_GROUPS.map((group, groupIndex) => {
            const isCollapsed = collapsedGroups.has(group.label);
            const itemCount = group.items.length;

            return (
              <div key={group.label} className={groupIndex > 0 ? 'mt-3' : ''}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className="
                    w-full flex items-center justify-between
                    text-[9px] font-semibold text-text-muted/70 uppercase tracking-[0.1em]
                    mb-1 px-1 py-0.5 rounded
                    hover:text-text-muted hover:bg-surface-interactive cursor-pointer
                  "
                >
                  <span>{group.label}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-[9px] font-normal tracking-normal opacity-60">
                      {itemCount}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${isCollapsed ? '-rotate-90' : ''}`}
                    />
                  </span>
                </button>

                {!isCollapsed && (
                  <ul className="space-y-px">
                    {group.items.map((section) => (
                      <li key={section.id}>
                        <button
                          onClick={() => handleClick(section.id)}
                          className={`
                            w-full text-left pl-3 pr-2 py-1.5 text-[13px] rounded transition-colors
                            ${activeSection === section.id
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-text-secondary hover:text-text-primary hover:bg-surface-interactive'
                            }
                          `}
                        >
                          {section.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className="w-full text-left pl-3 pr-2 py-1.5 text-[12px] text-text-muted hover:text-text-secondary rounded hover:bg-surface-interactive transition-colors"
                  >
                    {itemCount} items...
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div
          className={`
            absolute bottom-0 left-0 right-0 h-6 rounded-b-lg pointer-events-none z-10
            bg-gradient-to-t from-surface-card to-transparent
            transition-opacity duration-150
            ${scrollState.bottom ? 'opacity-0' : 'opacity-100'}
          `}
        />
      </div>
    </nav>
  );
}

export default function ApiCookbook() {
  const location = useLocation();
  const navigate = useNavigate();
  // Initialize from URL hash if present
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some(s => s.id === id)) return id;
    }
    return 'intro';
  });
  const isScrollingRef = useRef(false);
  const scrollEndTimeoutRef = useRef<number | null>(null);

  // Handle URL hash anchor scrolling on mount/change
  useEffect(() => {
    if (location.hash) {
      const id = location.hash.slice(1); // Remove #
      const element = document.getElementById(id);
      if (element) {
        // State is already set via initializer or handleNavClick
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  }, [location.hash]);

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingRef.current = true;
    // Update URL hash
    navigate(`#${sectionId}`, { replace: true });
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) {
        if (scrollEndTimeoutRef.current) {
          clearTimeout(scrollEndTimeoutRef.current);
        }
        scrollEndTimeoutRef.current = window.setTimeout(() => {
          isScrollingRef.current = false;
        }, 150);
        return;
      }

      const threshold = 120;
      const viewportHeight = window.innerHeight;

      const sections = NAV_SECTIONS.map(s => ({
        id: s.id,
        element: document.getElementById(s.id)
      })).filter(s => s.element);

      let bestSection: string | null = null;
      let bestTop = -Infinity;

      for (const section of sections) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= threshold && rect.top > bestTop) {
            bestTop = rect.top;
            bestSection = section.id;
          }
        }
      }

      if (!bestSection) {
        for (const section of sections) {
          if (section.element) {
            const rect = section.element.getBoundingClientRect();
            if (rect.top >= 0 && rect.top < viewportHeight) {
              bestSection = section.id;
              break;
            }
          }
        }
      }

      if (!bestSection) {
        bestSection = sections[0]?.id || 'intro';
      }

      setActiveSection(prev => {
        if (prev !== bestSection) {
          // Update URL hash when active section changes from scroll
          window.history.replaceState(null, '', `#${bestSection}`);
        }
        return bestSection;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface-base">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8">
          <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
            <a href="/docs" className="hover:text-accent transition-colors">Documentation</a>
            <span>/</span>
            <a href="/docs/api" className="hover:text-accent transition-colors">API Reference</a>
            <span>/</span>
            <span className="text-text-secondary">Cookbook</span>
          </div>
          <h1 className="text-3xl font-bold text-accent">API Cookbook</h1>
          <p className="text-text-secondary mt-2">
            Practical examples for common API workflows with Python and curl
          </p>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Introduction */}
          <Section id="intro" title="Introduction">
            <p className="text-text-secondary mb-6">
              This cookbook provides practical, copy-paste examples for integrating with the
              FFXIV Raid Planner API. Each example is shown in both Python (using httpx) and
              curl for maximum flexibility.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Base URL</h4>
                <code className="text-accent text-sm">http://localhost:8000/api</code>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Content Type</h4>
                <code className="text-accent text-sm">application/json</code>
              </div>
            </div>

            <InfoBox type="info" title="Prerequisites">
              These examples assume you have a running instance of the FFXIV Raid Planner
              backend at <code>localhost:8000</code>. For production use, replace the base URL
              with your deployment URL.
            </InfoBox>
          </Section>

          {/* Setup & Installation */}
          <Section id="setup" title="Setup & Installation">
            <Subsection title="Python Setup">
              <p className="text-text-secondary mb-4">
                Install the required Python packages:
              </p>
              <CodeBlock
                language="bash"
                code={`pip install httpx python-dotenv`}
              />

              <p className="text-text-secondary mb-4">
                Create a helper module for API calls:
              </p>
              <CodeBlock
                language="python"
                title="raid_planner.py"
                code={`import httpx
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("RAID_PLANNER_URL", "http://localhost:8000/api")
ACCESS_TOKEN = os.getenv("RAID_PLANNER_TOKEN", "")

def get_client():
    """Create an authenticated HTTP client."""
    return httpx.Client(
        base_url=BASE_URL,
        headers={
            "Authorization": f"Bearer {ACCESS_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )

def api_get(path: str):
    """Make an authenticated GET request."""
    with get_client() as client:
        response = client.get(path)
        response.raise_for_status()
        return response.json()

def api_post(path: str, data: dict):
    """Make an authenticated POST request."""
    with get_client() as client:
        response = client.post(path, json=data)
        response.raise_for_status()
        return response.json()

def api_put(path: str, data: dict):
    """Make an authenticated PUT request."""
    with get_client() as client:
        response = client.put(path, json=data)
        response.raise_for_status()
        return response.json()

def api_delete(path: str):
    """Make an authenticated DELETE request."""
    with get_client() as client:
        response = client.delete(path)
        response.raise_for_status()
        return response.status_code == 204`}
              />
            </Subsection>

            <Subsection title="Environment Variables">
              <p className="text-text-secondary mb-4">
                Create a <code>.env</code> file with your configuration:
              </p>
              <CodeBlock
                language="bash"
                title=".env"
                code={`RAID_PLANNER_URL=http://localhost:8000/api
RAID_PLANNER_TOKEN=your-access-token-here`}
              />
            </Subsection>
          </Section>

          {/* Authentication Flow */}
          <Section id="auth-flow" title="Authentication Flow">
            <p className="text-text-secondary mb-6">
              The API uses Discord OAuth for authentication. Here's the complete flow:
            </p>

            <Subsection title="Step 1: Get OAuth URL">
              <p className="text-text-secondary mb-4">
                First, get the Discord OAuth authorization URL:
              </p>
              <DualCodeBlock
                python={`import httpx

BASE_URL = "http://localhost:8000/api"

# Get the Discord OAuth URL
response = httpx.get(f"{BASE_URL}/auth/discord")
data = response.json()

print(f"Redirect user to: {data['url']}")
print(f"State token: {data['state']}")`}
                curl={`curl -X GET "http://localhost:8000/api/auth/discord"

# Response:
# {
#   "url": "https://discord.com/oauth2/authorize?...",
#   "state": "random-state-token"
# }`}
              />
            </Subsection>

            <Subsection title="Step 2: Handle Callback">
              <p className="text-text-secondary mb-4">
                After user authorizes, Discord redirects with a code. Exchange it for tokens:
              </p>
              <DualCodeBlock
                python={`import httpx

BASE_URL = "http://localhost:8000/api"

# Exchange the authorization code for tokens
response = httpx.post(
    f"{BASE_URL}/auth/discord/callback",
    json={
        "code": "discord-auth-code-from-redirect",
        "state": "state-from-url"
    }
)
tokens = response.json()

print(f"Access Token: {tokens['accessToken']}")
print(f"Refresh Token: {tokens['refreshToken']}")
print(f"Expires In: {tokens['expiresIn']} seconds")`}
                curl={`curl -X POST "http://localhost:8000/api/auth/discord/callback" \\
  -H "Content-Type: application/json" \\
  -d '{
    "code": "discord-auth-code-from-redirect",
    "state": "state-from-url"
  }'`}
              />
            </Subsection>

            <Subsection title="Step 3: Refresh Tokens">
              <p className="text-text-secondary mb-4">
                Access tokens expire after 15 minutes. Use the refresh token to get new ones:
              </p>
              <DualCodeBlock
                python={`import httpx

BASE_URL = "http://localhost:8000/api"
refresh_token = "your-refresh-token"

response = httpx.post(
    f"{BASE_URL}/auth/refresh",
    json={"refreshToken": refresh_token}
)
new_tokens = response.json()

print(f"New Access Token: {new_tokens['accessToken']}")`}
                curl={`curl -X POST "http://localhost:8000/api/auth/refresh" \\
  -H "Content-Type: application/json" \\
  -d '{"refreshToken": "your-refresh-token"}'`}
              />
            </Subsection>
          </Section>

          {/* Create a Static */}
          <Section id="create-static" title="Create a Static">
            <p className="text-text-secondary mb-6">
              Create a new static group where your raid team can track gear and loot.
            </p>

            <DualCodeBlock
              title="Create a new static group"
              python={`from raid_planner import api_post

# Create a new static group
static = api_post("/static-groups", {
    "name": "My Awesome Static",
    "isPublic": False,
    "settings": {
        "lootPriority": ["melee", "ranged", "caster", "tank", "healer"]
    }
})

print(f"Static ID: {static['id']}")
print(f"Share Code: {static['shareCode']}")`}
              curl={`curl -X POST "http://localhost:8000/api/static-groups" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Awesome Static",
    "isPublic": false,
    "settings": {
      "lootPriority": ["melee", "ranged", "caster", "tank", "healer"]
    }
  }'`}
            />

            <InfoBox type="tip" title="Share Code">
              The share code allows read-only access to your static. Use invite links
              (covered later) to give members edit permissions.
            </InfoBox>
          </Section>

          {/* Set Up a Tier */}
          <Section id="setup-tier" title="Set Up a Tier">
            <p className="text-text-secondary mb-6">
              Create a tier snapshot to track gear progress for a specific raid tier.
            </p>

            <DualCodeBlock
              title="Create a tier snapshot"
              python={`from raid_planner import api_post

static_id = "your-static-uuid"

# Create a new tier snapshot
tier = api_post(f"/static-groups/{static_id}/tiers", {
    "tierId": "aac-heavyweight",
    "contentType": "savage",
    "isActive": True
})

print(f"Tier Snapshot ID: {tier['id']}")
print(f"Tier: {tier['tierId']}")`}
              curl={`curl -X POST "http://localhost:8000/api/static-groups/$STATIC_ID/tiers" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tierId": "aac-heavyweight",
    "contentType": "savage",
    "isActive": true
  }'`}
            />

            <Subsection title="Available Tier IDs">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-4">
                <ul className="space-y-1 text-text-secondary text-sm font-mono">
                  <li><code className="text-accent">aac-heavyweight</code> - AAC Light-heavyweight (M1S-M4S)</li>
                  <li><code className="text-accent">aac-cruiserweight</code> - AAC Cruiserweight (M5S-M8S)</li>
                  <li><code className="text-accent">aac-welterweight</code> - AAC Welterweight (M9S-M12S)</li>
                </ul>
              </div>
            </Subsection>
          </Section>

          {/* Manage Players */}
          <Section id="manage-players" title="Manage Players">
            <Subsection title="Add a Player">
              <DualCodeBlock
                python={`from raid_planner import api_post

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Add a new player
player = api_post(
    f"/static-groups/{static_id}/tiers/{tier_id}/players",
    {
        "name": "Warrior of Light",
        "job": "DRG",
        "role": "melee",
        "position": "M1"
    }
)

print(f"Player ID: {player['id']}")
print(f"Job: {player['job']}")`}
                curl={`curl -X POST "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/players" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Warrior of Light",
    "job": "DRG",
    "role": "melee",
    "position": "M1"
  }'`}
              />
            </Subsection>

            <Subsection title="Update Player Gear">
              <DualCodeBlock
                python={`from raid_planner import api_put

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"
player_id = "your-player-uuid"

# Update player's gear status
api_put(
    f"/static-groups/{static_id}/tiers/{tier_id}/players/{player_id}",
    {
        "gear": [
            {
                "slot": "weapon",
                "bisSource": "raid",
                "hasItem": True,
                "isAugmented": False
            },
            {
                "slot": "body",
                "bisSource": "tome",
                "hasItem": True,
                "isAugmented": True
            }
        ]
    }
)

print("Gear updated successfully")`}
                curl={`curl -X PUT "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/players/$PLAYER_ID" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "gear": [
      {"slot": "weapon", "bisSource": "raid", "hasItem": true, "isAugmented": false},
      {"slot": "body", "bisSource": "tome", "hasItem": true, "isAugmented": true}
    ]
  }'`}
              />
            </Subsection>

            <Subsection title="List All Players">
              <DualCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Get tier with all players
tier = api_get(f"/static-groups/{static_id}/tiers/{tier_id}")

for player in tier['players']:
    bis_count = sum(1 for g in player['gear'] if g.get('hasItem'))
    print(f"{player['name']} ({player['job']}): {bis_count}/11 BiS")`}
                curl={`curl -X GET "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID" \\
  -H "Authorization: Bearer $TOKEN"`}
              />
            </Subsection>
          </Section>

          {/* Import BiS */}
          <Section id="import-bis" title="Import BiS">
            <p className="text-text-secondary mb-6">
              Import BiS sets from XIVGear or Etro to automatically populate gear data.
            </p>

            <Subsection title="From XIVGear">
              <DualCodeBlock
                python={`from raid_planner import api_get, api_put

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"
player_id = "your-player-uuid"

# Fetch BiS data from XIVGear
xivgear_url = "https://xivgear.app/?page=sl|12345678-1234-1234-1234-123456789abc"
bis_data = api_get(f"/bis/xivgear/{xivgear_url}")

# Convert to gear array format
gear = []
for slot_data in bis_data['slots']:
    gear.append({
        "slot": slot_data['slot'],
        "bisSource": slot_data['source'],
        "itemName": slot_data['itemName'],
        "itemLevel": slot_data['itemLevel'],
        "itemIcon": slot_data['itemIcon'],
        "hasItem": False,
        "isAugmented": False
    })

# Update player with BiS data
api_put(
    f"/static-groups/{static_id}/tiers/{tier_id}/players/{player_id}",
    {"gear": gear, "bisLink": xivgear_url}
)

print(f"Imported {len(gear)} gear slots from XIVGear")`}
                curl={`# First, fetch BiS data from XIVGear
curl -X GET "http://localhost:8000/api/bis/xivgear/https://xivgear.app/?page=sl|UUID" \\
  -H "Authorization: Bearer $TOKEN"

# Then update the player with the gear data
curl -X PUT "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/players/$PLAYER_ID" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"gear": [...], "bisLink": "..."}'`}
              />
            </Subsection>

            <Subsection title="From Presets">
              <DualCodeBlock
                python={`from raid_planner import api_get

# Get available presets for a job
presets = api_get("/bis/presets/DRG?category=savage")

print(f"Available presets for DRG:")
for preset in presets['presets']:
    print(f"  - {preset['name']} (GCD: {preset.get('gcd', 'N/A')})")

# Use a preset UUID with the xivgear endpoint
if presets['presets']:
    preset_uuid = presets['presets'][0]['uuid']
    bis_data = api_get(f"/bis/xivgear/{preset_uuid}")
    print(f"Loaded preset: {bis_data['name']}")`}
                curl={`# Get presets for a job
curl -X GET "http://localhost:8000/api/bis/presets/DRG?category=savage" \\
  -H "Authorization: Bearer $TOKEN"

# Then fetch the preset data
curl -X GET "http://localhost:8000/api/bis/xivgear/$PRESET_UUID" \\
  -H "Authorization: Bearer $TOKEN"`}
              />
            </Subsection>
          </Section>

          {/* Log Loot */}
          <Section id="log-loot" title="Log Loot">
            <p className="text-text-secondary mb-6">
              Record loot drops and track who received what items each week.
            </p>

            <Subsection title="Log a Drop">
              <DualCodeBlock
                python={`from raid_planner import api_post

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Log a loot drop
loot_entry = api_post(
    f"/static-groups/{static_id}/tiers/{tier_id}/loot-log",
    {
        "weekNumber": 1,
        "floor": "M9S",
        "itemSlot": "earring",
        "recipientPlayerId": "player-uuid",
        "method": "drop"  # or "book", "tome"
    }
)

print(f"Logged loot entry #{loot_entry['id']}")`}
                curl={`curl -X POST "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/loot-log" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "weekNumber": 1,
    "floor": "M9S",
    "itemSlot": "earring",
    "recipientPlayerId": "player-uuid",
    "method": "drop"
  }'`}
              />
            </Subsection>

            <Subsection title="Get Loot History">
              <DualCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Get all loot entries
loot_log = api_get(f"/static-groups/{static_id}/tiers/{tier_id}/loot-log")

# Group by week
by_week = {}
for entry in loot_log:
    week = entry['weekNumber']
    if week not in by_week:
        by_week[week] = []
    by_week[week].append(entry)

for week, entries in sorted(by_week.items()):
    print(f"\\nWeek {week}:")
    for e in entries:
        print(f"  {e['floor']} {e['itemSlot']} -> {e['recipientPlayerName']}")`}
                curl={`curl -X GET "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/loot-log" \\
  -H "Authorization: Bearer $TOKEN"

# Filter by week
curl -X GET "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/loot-log?week=1" \\
  -H "Authorization: Bearer $TOKEN"`}
              />
            </Subsection>
          </Section>

          {/* Track Pages */}
          <Section id="track-pages" title="Track Pages">
            <p className="text-text-secondary mb-6">
              Track book/page earnings and spending for the page exchange system.
            </p>

            <Subsection title="Mark Floor Cleared">
              <DualCodeBlock
                python={`from raid_planner import api_post

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Mark a floor as cleared for multiple players
api_post(
    f"/static-groups/{static_id}/tiers/{tier_id}/mark-floor-cleared",
    {
        "weekNumber": 1,
        "floor": "M9S",
        "playerIds": [
            "player-uuid-1",
            "player-uuid-2",
            "player-uuid-3",
            # ... all 8 players who cleared
        ]
    }
)

print("Floor clear marked for all players")`}
                curl={`curl -X POST "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/mark-floor-cleared" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "weekNumber": 1,
    "floor": "M9S",
    "playerIds": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5", "uuid6", "uuid7", "uuid8"]
  }'`}
              />
            </Subsection>

            <Subsection title="Get Page Balances">
              <DualCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Get current book balances for all players
balances = api_get(f"/static-groups/{static_id}/tiers/{tier_id}/page-balances")

print("Book Balances:")
print("-" * 50)
for player in balances:
    print(f"{player['playerName']:20} I:{player['bookI']:2} II:{player['bookII']:2} III:{player['bookIII']:2} IV:{player['bookIV']:2}")`}
                curl={`curl -X GET "http://localhost:8000/api/static-groups/$STATIC_ID/tiers/$TIER_ID/page-balances" \\
  -H "Authorization: Bearer $TOKEN"`}
              />
            </Subsection>
          </Section>

          {/* Invitation Links */}
          <Section id="invitations" title="Invitation Links">
            <p className="text-text-secondary mb-6">
              Create invitation links to add members to your static with specific roles.
            </p>

            <Subsection title="Create an Invite">
              <DualCodeBlock
                python={`from raid_planner import api_post

static_id = "your-static-uuid"

# Create an invitation link
invite = api_post(
    f"/static-groups/{static_id}/invitations",
    {
        "role": "member",  # or "lead", "viewer"
        "expiresInDays": 7,
        "maxUses": 10
    }
)

print(f"Invite Code: {invite['inviteCode']}")
print(f"Invite URL: https://yoursite.com/invite/{invite['inviteCode']}")
print(f"Expires: {invite['expiresAt']}")`}
                curl={`curl -X POST "http://localhost:8000/api/static-groups/$STATIC_ID/invitations" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "member",
    "expiresInDays": 7,
    "maxUses": 10
  }'`}
              />
            </Subsection>

            <Subsection title="List Active Invites">
              <DualCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"

# Get all invitations
invites = api_get(f"/static-groups/{static_id}/invitations")

print("Active Invitations:")
for invite in invites:
    if invite['isValid']:
        print(f"  {invite['inviteCode']} - {invite['role']} ({invite['useCount']}/{invite['maxUses']} uses)")`}
                curl={`curl -X GET "http://localhost:8000/api/static-groups/$STATIC_ID/invitations" \\
  -H "Authorization: Bearer $TOKEN"`}
              />
            </Subsection>
          </Section>

          {/* Polling for Updates */}
          <Section id="webhooks" title="Polling for Updates">
            <p className="text-text-secondary mb-6">
              The API doesn't support webhooks, but you can poll for changes.
            </p>

            <Subsection title="Poll for Changes">
              <CodeBlock
                language="python"
                title="Simple polling script"
                code={`import time
from raid_planner import api_get

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

def get_state():
    """Get current state hash."""
    tier = api_get(f"/static-groups/{static_id}/tiers/{tier_id}")
    # Simple hash based on player gear states
    state = []
    for player in tier.get('players', []):
        gear_state = tuple(
            (g['slot'], g.get('hasItem'), g.get('isAugmented'))
            for g in player.get('gear', [])
        )
        state.append((player['id'], gear_state))
    return tuple(sorted(state))

last_state = None

while True:
    current_state = get_state()

    if last_state is not None and current_state != last_state:
        print("Changes detected!")
        # Handle the change (send notification, update UI, etc.)

    last_state = current_state
    time.sleep(30)  # Poll every 30 seconds`}
              />
            </Subsection>

            <InfoBox type="info" title="Rate Limits">
              Be mindful of rate limits when polling. The API has a limit of 60 requests
              per minute per user. Polling every 30 seconds is a safe default.
            </InfoBox>
          </Section>

          {/* Error Handling */}
          <Section id="error-handling" title="Error Handling">
            <p className="text-text-secondary mb-6">
              Properly handle API errors for a robust integration.
            </p>

            <Subsection title="Python Error Handling">
              <CodeBlock
                language="python"
                code={`import httpx
from raid_planner import BASE_URL, get_client

def safe_api_call(method: str, path: str, data: dict = None):
    """Make an API call with proper error handling."""
    try:
        with get_client() as client:
            if method == "GET":
                response = client.get(path)
            elif method == "POST":
                response = client.post(path, json=data)
            elif method == "PUT":
                response = client.put(path, json=data)
            elif method == "DELETE":
                response = client.delete(path)

            response.raise_for_status()
            return response.json() if response.content else None

    except httpx.HTTPStatusError as e:
        status = e.response.status_code

        if status == 401:
            print("Authentication failed - refresh your token")
        elif status == 403:
            print("Permission denied - check your role")
        elif status == 404:
            print("Resource not found")
        elif status == 429:
            print("Rate limited - wait and retry")
            retry_after = e.response.headers.get("Retry-After", 60)
            print(f"Retry after {retry_after} seconds")
        else:
            error_body = e.response.json()
            print(f"API Error: {error_body.get('message', 'Unknown error')}")

        return None

    except httpx.RequestError as e:
        print(f"Network error: {e}")
        return None`}
              />
            </Subsection>

            <Subsection title="Common Error Codes">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Code</th>
                      <th className="text-left py-2 text-text-muted font-medium">Meaning</th>
                      <th className="text-left py-2 text-text-muted font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr>
                      <td className="py-2 text-accent font-mono">401</td>
                      <td className="py-2 text-text-secondary">Unauthorized</td>
                      <td className="py-2 text-text-secondary">Refresh your access token</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">403</td>
                      <td className="py-2 text-text-secondary">Forbidden</td>
                      <td className="py-2 text-text-secondary">Check user permissions</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">404</td>
                      <td className="py-2 text-text-secondary">Not Found</td>
                      <td className="py-2 text-text-secondary">Verify resource ID</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">409</td>
                      <td className="py-2 text-text-secondary">Conflict</td>
                      <td className="py-2 text-text-secondary">Resource already exists</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">429</td>
                      <td className="py-2 text-text-secondary">Rate Limited</td>
                      <td className="py-2 text-text-secondary">Wait and retry</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Subsection>
          </Section>
        </main>
      </div>
    </div>
  );
}
