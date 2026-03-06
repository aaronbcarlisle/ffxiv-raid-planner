/**
 * API Cookbook - Practical examples for using the FFXIV Raid Planner API
 *
 * Includes Python and curl examples for common workflows.
 *
 * Accessible at: /docs/api/cookbook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Terminal } from 'lucide-react';
import { CodeBlock, TripleCodeBlock, NavSidebar } from '../components/docs';

// Language icons (from CodeBlock.tsx)
function PythonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M14.25.18l.9.2.73.26.59.3.45.32.34.34.25.34.16.33.1.3.04.26.02.2-.01.13V8.5l-.05.63-.13.55-.21.46-.26.38-.3.31-.33.25-.35.19-.35.14-.33.1-.3.07-.26.04-.21.02H8.77l-.69.05-.59.14-.5.22-.41.27-.33.32-.27.35-.2.36-.15.37-.1.35-.07.32-.04.27-.02.21v3.06H3.17l-.21-.03-.28-.07-.32-.12-.35-.18-.36-.26-.36-.36-.35-.46-.32-.59-.28-.73-.21-.88-.14-1.05-.05-1.23.06-1.22.16-1.04.24-.87.32-.71.36-.57.4-.44.42-.33.42-.24.4-.16.36-.1.32-.05.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75-.02-.37.05-.34.11-.31.17-.28.25-.26.31-.23.38-.2.44-.18.51-.15.58-.12.64-.1.71-.06.77-.04.84-.02 1.27.05zm-6.3 1.98l-.23.33-.08.41.08.41.23.34.33.22.41.09.41-.09.33-.22.23-.34.08-.41-.08-.41-.23-.33-.33-.22-.41-.09-.41.09zm13.09 3.95l.28.06.32.12.35.18.36.27.36.35.35.47.32.59.28.73.21.88.14 1.04.05 1.23-.06 1.23-.16 1.04-.24.86-.32.71-.36.57-.4.45-.42.33-.42.24-.4.16-.36.09-.32.05-.24.02-.16-.01h-8.22v.82h5.84l.01 2.76.02.36-.05.34-.11.31-.17.29-.25.25-.31.24-.38.2-.44.17-.51.15-.58.13-.64.09-.71.07-.77.04-.84.01-1.27-.04-1.07-.14-.9-.2-.73-.25-.59-.3-.45-.33-.34-.34-.25-.34-.16-.33-.1-.3-.04-.25-.02-.2.01-.13v-5.34l.05-.64.13-.54.21-.46.26-.38.3-.32.33-.24.35-.2.35-.14.33-.1.3-.06.26-.04.21-.02.13-.01h5.84l.69-.05.59-.14.5-.21.41-.28.33-.32.27-.35.2-.36.15-.36.1-.35.07-.32.04-.28.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33-.08.41.08.41.23.33.33.23.41.08.41-.08.33-.23.23-.33.08-.41-.08-.41-.23-.33-.33-.23-.41-.08-.41.08z" />
    </svg>
  );
}

function CSharpIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zM9.426 7.12a5.55 5.55 0 013.19-.94c.271 0 .541.02.81.058v2.37a3.991 3.991 0 00-.824-.084 3.565 3.565 0 00-2.443 1.035 3.558 3.558 0 00-1.024 2.55 3.558 3.558 0 001.024 2.55 3.565 3.565 0 002.443 1.035c.283 0 .558-.03.824-.084v2.37c-.269.039-.539.058-.81.058a5.55 5.55 0 01-3.19-.94 5.626 5.626 0 01-1.917-2.443 7.273 7.273 0 01-.675-3.086 7.273 7.273 0 01.675-3.086 5.626 5.626 0 011.917-2.442zm6.902 1.708h.894l.342 1.026h.01l.342-1.026h.894v3.456h-.72v-2.11h-.01l-.407 1.095h-.62l-.407-1.095h-.01v2.11h-.72V8.828h.002zm2.962 0h.894l.342 1.026h.01l.342-1.026h.894v3.456h-.72v-2.11h-.01l-.407 1.095h-.62l-.407-1.095h-.01v2.11h-.72V8.828h.002z"/>
    </svg>
  );
}

// Navigation items grouped by category
const NAV_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction' },
      { id: 'setup', label: 'Setup & Installation' },
      { id: 'auth-flow', label: 'Authentication' },
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
    <section id={id} className="mb-12 scroll-mt-20">
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

// Tab components for setup section
interface TabGroupProps {
  tabs: { id: string; label: string; icon?: React.ReactNode }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
}

function TabGroup({ tabs, activeTab, onTabChange, children }: TabGroupProps) {
  return (
    <div className="bg-surface-card border border-border-subtle rounded-lg overflow-hidden mb-6">
      <div className="flex border-b border-border-subtle">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-surface-elevated text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
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
  const [setupTab, setSetupTab] = useState<'python' | 'csharp' | 'curl'>('python');
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
    } else {
      // No hash - scroll to top to prevent browser scroll restoration from jumping to wrong section
      window.scrollTo(0, 0);
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

      // Check if at bottom of page - select last section
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const documentHeight = document.documentElement.scrollHeight;
      const maxScroll = documentHeight - viewportHeight;
      const scrollRemaining = maxScroll - scrollTop;

      // If less than 100px of scroll remaining, we're at the bottom
      if (scrollRemaining < 100 && sections.length > 0) {
        const lastSection = sections[sections.length - 1];
        setActiveSection(prev => {
          if (prev !== lastSection.id) {
            window.history.replaceState(null, '', `#${lastSection.id}`);
          }
          return lastSection.id;
        });
        return;
      }

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
          <div className="flex items-center gap-2 text-sm text-text-muted mb-4">
            <a href="/docs" className="hover:text-accent transition-colors">Documentation</a>
            <span>/</span>
            <a href="/docs/api" className="hover:text-accent transition-colors">API Reference</a>
            <span>/</span>
            <span className="text-text-secondary">Cookbook</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-accent">API Cookbook</h1>
            <p className="text-text-secondary mt-1">
              Practical examples for common API workflows with Python, curl, and C#
            </p>
          </div>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar groups={NAV_GROUPS} activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Introduction */}
          <Section id="intro" title="Introduction">
            <p className="text-text-secondary mb-6">
              This cookbook provides practical, copy-paste examples for integrating with the
              FFXIV Raid Planner API. Each example is shown in Python (using httpx), curl,
              and C# (using HttpClient) for maximum flexibility.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Base URL</h4>
                <code className="text-accent text-sm">https://api.xivraidplanner.app/api</code>
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-lg p-4">
                <h4 className="font-medium text-text-primary mb-2">Content Type</h4>
                <code className="text-accent text-sm">application/json</code>
              </div>
            </div>

            <InfoBox type="info" title="Prerequisites">
              You need an API key to use the API. Log in at{' '}
              <a href="https://www.xivraidplanner.app" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">xivraidplanner.app</a>,
              click your avatar in the top-right corner, then go to <strong>API Keys</strong> and
              create a new key. Copy the key — it is only shown once.
            </InfoBox>
          </Section>

          {/* Setup & Installation */}
          <Section id="setup" title="Setup & Installation">
            <TabGroup
              tabs={[
                { id: 'python', label: 'Python', icon: <PythonIcon className="w-4 h-4" /> },
                { id: 'csharp', label: 'C#', icon: <CSharpIcon className="w-4 h-4" /> },
                { id: 'curl', label: 'curl', icon: <Terminal className="w-4 h-4" /> },
              ]}
              activeTab={setupTab}
              onTabChange={(id) => setSetupTab(id as 'python' | 'csharp' | 'curl')}
            >
              {setupTab === 'python' && (
                <>
                  <p className="text-text-secondary mb-4">
                    Install the required Python packages:
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`pip install httpx python-dotenv`}
                  />

                  <p className="text-text-secondary mt-6 mb-4">
                    Create a helper module for API calls:
                  </p>
                  <CodeBlock
                    language="python"
                    title="raid_planner.py"
                    code={`import httpx
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("RAID_PLANNER_URL", "https://api.xivraidplanner.app/api")
API_KEY = os.getenv("RAID_PLANNER_API_KEY", "")

def get_client():
    """Create an authenticated HTTP client."""
    return httpx.Client(
        base_url=BASE_URL,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
        },
        timeout=30.0,
    )

def api_get(path: str):
    """Make an authenticated GET request."""
    with get_client() as client:
        response = client.get(path.lstrip("/"))
        response.raise_for_status()
        return response.json()

def api_post(path: str, data: dict):
    """Make an authenticated POST request."""
    with get_client() as client:
        response = client.post(path.lstrip("/"), json=data)
        response.raise_for_status()
        return response.json()

def api_put(path: str, data: dict):
    """Make an authenticated PUT request."""
    with get_client() as client:
        response = client.put(path.lstrip("/"), json=data)
        response.raise_for_status()
        return response.json()

def api_delete(path: str):
    """Make an authenticated DELETE request."""
    with get_client() as client:
        response = client.delete(path.lstrip("/"))
        response.raise_for_status()
        return response.status_code == 204`}
                  />

                  <p className="text-text-secondary mt-6 mb-4">
                    Create a <code>.env</code> file with your configuration:
                  </p>
                  <CodeBlock
                    language="bash"
                    title=".env"
                    code={`RAID_PLANNER_URL=https://api.xivraidplanner.app/api
RAID_PLANNER_API_KEY=xrp_your_api_key_here`}
                  />
                </>
              )}

              {setupTab === 'csharp' && (
                <>
                  <p className="text-text-secondary mb-4">
                    Create a new .NET project and add required packages:
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`dotnet new console -n RaidPlannerClient
cd RaidPlannerClient
dotnet add package System.Net.Http.Json`}
                  />

                  <p className="text-text-secondary mt-6 mb-4">
                    Create a helper class for API calls:
                  </p>
                  <CodeBlock
                    language="csharp"
                    title="RaidPlannerClient.cs"
                    code={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

public class RaidPlannerClient : IDisposable
{
    private readonly HttpClient _client;
    private readonly string _baseUrl;

    public RaidPlannerClient(string? baseUrl = null, string? apiKey = null)
    {
        _baseUrl = baseUrl ?? Environment.GetEnvironmentVariable("RAID_PLANNER_URL")
                   ?? "https://api.xivraidplanner.app/api";
        var resolvedKey = apiKey ?? Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY") ?? "";

        _client = new HttpClient
        {
            BaseAddress = new Uri(_baseUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };

        _client.DefaultRequestHeaders.Accept.Add(
            new MediaTypeWithQualityHeaderValue("application/json"));

        if (!string.IsNullOrEmpty(resolvedKey))
        {
            _client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", resolvedKey);
        }
    }

    public async Task<JsonDocument> GetAsync(string path)
    {
        var response = await _client.GetAsync(path);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonDocument>()
               ?? throw new Exception("Empty response");
    }

    public async Task<JsonDocument> PostAsync(string path, object data)
    {
        var response = await _client.PostAsJsonAsync(path, data);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonDocument>()
               ?? throw new Exception("Empty response");
    }

    public async Task<JsonDocument> PutAsync(string path, object data)
    {
        var response = await _client.PutAsJsonAsync(path, data);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<JsonDocument>()
               ?? throw new Exception("Empty response");
    }

    public async Task DeleteAsync(string path)
    {
        var response = await _client.DeleteAsync(path);
        response.EnsureSuccessStatusCode();
    }

    public void Dispose()
    {
        _client?.Dispose();
    }
}`}
                  />

                  <p className="text-text-secondary mt-6 mb-4">
                    Set environment variables (Windows PowerShell):
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`$env:RAID_PLANNER_URL = "https://api.xivraidplanner.app/api"
$env:RAID_PLANNER_API_KEY = "xrp_your_api_key_here"`}
                  />

                  <p className="text-text-secondary mt-6 mb-4">
                    Or create a <code>appsettings.json</code> file:
                  </p>
                  <CodeBlock
                    language="json"
                    title="appsettings.json"
                    code={`{
  "RaidPlanner": {
    "BaseUrl": "https://api.xivraidplanner.app/api",
    "ApiKey": "xrp_your_api_key_here"
  }
}`}
                  />
                </>
              )}

              {setupTab === 'curl' && (
                <>
                  <p className="text-text-secondary mb-4">
                    curl is pre-installed on most systems (macOS, Linux, Windows 10+). Verify installation:
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`curl --version`}
                  />

                  <p className="text-text-secondary mt-6 mb-4">
                    For convenience, set environment variables in your shell:
                  </p>

                  <p className="text-text-secondary mb-2">
                    <strong>Bash/Zsh (Linux/macOS):</strong>
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`export RAID_PLANNER_URL="https://api.xivraidplanner.app/api"
export RAID_PLANNER_API_KEY="xrp_your_api_key_here"

# Add to ~/.bashrc or ~/.zshrc to persist across sessions`}
                  />

                  <p className="text-text-secondary mt-4 mb-2">
                    <strong>PowerShell (Windows):</strong>
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`$env:RAID_PLANNER_URL = "https://api.xivraidplanner.app/api"
$env:RAID_PLANNER_API_KEY = "xrp_your_api_key_here"

# Add to $PROFILE to persist across sessions`}
                  />

                  <p className="text-text-secondary mt-4 mb-2">
                    <strong>CMD (Windows):</strong>
                  </p>
                  <CodeBlock
                    language="bash"
                    code={`set RAID_PLANNER_URL=https://api.xivraidplanner.app/api
set RAID_PLANNER_API_KEY=xrp_your_api_key_here`}
                  />

                  <InfoBox type="tip" title="Using curl with environment variables">
                    Throughout this guide, curl examples use <code>$RAID_PLANNER_API_KEY</code> and <code>$STATIC_ID</code>
                    placeholders. Replace them with actual values or set them as environment variables for
                    easy copy-paste.
                  </InfoBox>
                </>
              )}
            </TabGroup>
          </Section>

          {/* Authentication */}
          <Section id="auth-flow" title="Authentication">
            <p className="text-text-secondary mb-6">
              The API uses API keys for authentication. Pass your key in the
              {' '}<code>Authorization</code> header as a Bearer token. API keys don't expire
              by default — no refresh flow needed.
            </p>

            <Subsection title="Verify Your API Key">
              <p className="text-text-secondary mb-4">
                Confirm your API key is valid by calling the <code>/auth/me</code> endpoint:
              </p>
              <TripleCodeBlock
                python={`from raid_planner import api_get

# Verify your API key
me = api_get("/auth/me")

print(f"Logged in as: {me['displayName']}")
print(f"User ID: {me['id']}")`}
                curl={`curl -X GET "https://api.xivraidplanner.app/api/auth/me" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"

# Response:
# {
#   "id": "your-user-uuid",
#   "displayName": "YourName#1234",
#   ...
# }`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");
using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Verify your API key
var response = await client.GetAsync("https://api.xivraidplanner.app/api/auth/me");
response.EnsureSuccessStatusCode();

var me = await response.Content.ReadFromJsonAsync<JsonDocument>();
var displayName = me.RootElement.GetProperty("displayName").GetString();
var id = me.RootElement.GetProperty("id").GetString();

Console.WriteLine($"Logged in as: {displayName}");
Console.WriteLine($"User ID: {id}");`}
              />
            </Subsection>

            <Subsection title="List Your Statics">
              <p className="text-text-secondary mb-4">
                A quick smoke test — list all statics you belong to:
              </p>
              <TripleCodeBlock
                python={`from raid_planner import api_get

# List all your statics
statics = api_get("/static-groups")

for s in statics:
    print(f"{s['name']} (ID: {s['id']}, Role: {s['userRole']})")`}
                curl={`curl -X GET "https://api.xivraidplanner.app/api/static-groups" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");
using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// List all your statics
var response = await client.GetAsync("https://api.xivraidplanner.app/api/static-groups");
response.EnsureSuccessStatusCode();

var statics = await response.Content.ReadFromJsonAsync<JsonDocument>();
foreach (var s in statics.RootElement.EnumerateArray())
{
    var name = s.GetProperty("name").GetString();
    var id = s.GetProperty("id").GetString();
    var role = s.GetProperty("userRole").GetString();
    Console.WriteLine($"{name} (ID: {id}, Role: {role})");
}`}
              />
            </Subsection>
          </Section>

          {/* Create a Static */}
          <Section id="create-static" title="Create a Static">
            <p className="text-text-secondary mb-6">
              Create a new static group where your raid team can track gear and loot.
            </p>

            <TripleCodeBlock
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
              curl={`curl -X POST "https://api.xivraidplanner.app/api/static-groups" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Awesome Static",
    "isPublic": false,
    "settings": {
      "lootPriority": ["melee", "ranged", "caster", "tank", "healer"]
    }
  }'`}
              csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var baseUrl = "https://api.xivraidplanner.app/api";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Create a new static group
var payload = new
{
    name = "My Awesome Static",
    isPublic = false,
    settings = new
    {
        lootPriority = new[] { "melee", "ranged", "caster", "tank", "healer" }
    }
};

var response = await client.PostAsJsonAsync($"{baseUrl}/static-groups", payload);
response.EnsureSuccessStatusCode();

var staticGroup = await response.Content.ReadFromJsonAsync<JsonDocument>();
var id = staticGroup.RootElement.GetProperty("id").GetString();
var shareCode = staticGroup.RootElement.GetProperty("shareCode").GetString();

Console.WriteLine($"Static ID: {id}");
Console.WriteLine($"Share Code: {shareCode}");`}
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

            <TripleCodeBlock
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
              curl={`curl -X POST "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "tierId": "aac-heavyweight",
    "contentType": "savage",
    "isActive": true
  }'`}
              csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Create a new tier snapshot
var payload = new
{
    tierId = "aac-heavyweight",
    contentType = "savage",
    isActive = true
};

var response = await client.PostAsJsonAsync($"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers", payload);
response.EnsureSuccessStatusCode();

var tier = await response.Content.ReadFromJsonAsync<JsonDocument>();
var id = tier.RootElement.GetProperty("id").GetString();
var tierId = tier.RootElement.GetProperty("tierId").GetString();

Console.WriteLine($"Tier Snapshot ID: {id}");
Console.WriteLine($"Tier: {tierId}");`}
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
              <TripleCodeBlock
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
                curl={`curl -X POST "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/players" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Warrior of Light",
    "job": "DRG",
    "role": "melee",
    "position": "M1"
  }'`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Add a new player
var payload = new
{
    name = "Warrior of Light",
    job = "DRG",
    role = "melee",
    position = "M1"
};

var response = await client.PostAsJsonAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/players",
    payload
);
response.EnsureSuccessStatusCode();

var player = await response.Content.ReadFromJsonAsync<JsonDocument>();
var id = player.RootElement.GetProperty("id").GetString();
var job = player.RootElement.GetProperty("job").GetString();

Console.WriteLine($"Player ID: {id}");
Console.WriteLine($"Job: {job}");`}
              />
            </Subsection>

            <Subsection title="Update Player Gear">
              <TripleCodeBlock
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
                curl={`curl -X PUT "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/players/$PLAYER_ID" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "gear": [
      {"slot": "weapon", "bisSource": "raid", "hasItem": true, "isAugmented": false},
      {"slot": "body", "bisSource": "tome", "hasItem": true, "isAugmented": true}
    ]
  }'`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var playerId = "your-player-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Update player's gear status
var payload = new
{
    gear = new[]
    {
        new { slot = "weapon", bisSource = "raid", hasItem = true, isAugmented = false },
        new { slot = "body", bisSource = "tome", hasItem = true, isAugmented = true }
    }
};

var response = await client.PutAsJsonAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/players/{playerId}",
    payload
);
response.EnsureSuccessStatusCode();

Console.WriteLine("Gear updated successfully");`}
              />
            </Subsection>

            <Subsection title="List All Players">
              <TripleCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Get tier with all players
tier = api_get(f"/static-groups/{static_id}/tiers/{tier_id}")

for player in tier['players']:
    bis_count = sum(1 for g in player['gear'] if g.get('hasItem'))
    print(f"{player['name']} ({player['job']}): {bis_count}/11 BiS")`}
                curl={`curl -X GET "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"`}
                csharp={`using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Get tier with all players
var response = await client.GetAsync($"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}");
response.EnsureSuccessStatusCode();

var tier = await response.Content.ReadFromJsonAsync<JsonDocument>();
var players = tier.RootElement.GetProperty("players").EnumerateArray();

foreach (var player in players)
{
    var name = player.GetProperty("name").GetString();
    var job = player.GetProperty("job").GetString();
    var gear = player.GetProperty("gear").EnumerateArray();
    var bisCount = gear.Count(g => g.TryGetProperty("hasItem", out var hasItem) && hasItem.GetBoolean());

    Console.WriteLine($"{name} ({job}): {bisCount}/11 BiS");
}`}
              />
            </Subsection>
          </Section>

          {/* Import BiS */}
          <Section id="import-bis" title="Import BiS">
            <p className="text-text-secondary mb-6">
              Import BiS sets from XIVGear or Etro to automatically populate gear data.
            </p>

            <Subsection title="From XIVGear">
              <TripleCodeBlock
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
curl -X GET "https://api.xivraidplanner.app/api/bis/xivgear/https://xivgear.app/?page=sl|UUID" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"

# Then update the player with the gear data
curl -X PUT "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/players/$PLAYER_ID" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"gear": [...], "bisLink": "..."}'`}
                csharp={`using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var playerId = "your-player-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Fetch BiS data from XIVGear
var xivgearUrl = "https://xivgear.app/?page=sl|12345678-1234-1234-1234-123456789abc";
var bisResponse = await client.GetAsync($"https://api.xivraidplanner.app/api/bis/xivgear/{xivgearUrl}");
bisResponse.EnsureSuccessStatusCode();

var bisData = await bisResponse.Content.ReadFromJsonAsync<JsonDocument>();
var slots = bisData.RootElement.GetProperty("slots").EnumerateArray();

// Convert to gear array format
var gear = slots.Select(slotData => new
{
    slot = slotData.GetProperty("slot").GetString(),
    bisSource = slotData.GetProperty("source").GetString(),
    itemName = slotData.GetProperty("itemName").GetString(),
    itemLevel = slotData.GetProperty("itemLevel").GetInt32(),
    itemIcon = slotData.GetProperty("itemIcon").GetString(),
    hasItem = false,
    isAugmented = false
}).ToArray();

// Update player with BiS data
var updatePayload = new { gear, bisLink = xivgearUrl };
var updateResponse = await client.PutAsJsonAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/players/{playerId}",
    updatePayload
);
updateResponse.EnsureSuccessStatusCode();

Console.WriteLine($"Imported {gear.Length} gear slots from XIVGear");`}
              />
            </Subsection>

            <Subsection title="From Presets">
              <TripleCodeBlock
                python={`from raid_planner import api_get

# Get available presets for a job
presets = api_get("/bis/presets/DRG?category=savage")

print(f"Available presets for DRG:")
for preset in presets['presets']:
    print(f"  - {preset['name']} (GCD: {preset.get('gcd', 'N/A')})")

# Load a preset using the bis|job|tier format (job must be lowercase)
if presets['presets']:
    preset = presets['presets'][0]
    job = "drg"  # lowercase job abbreviation
    tier = preset.get('githubTier', 'current')
    bis_data = api_get(f"/bis/xivgear/bis|{job}|{tier}")
    print(f"Loaded preset: {bis_data['name']}")`}
                curl={`# Get presets for a job
curl -X GET "https://api.xivraidplanner.app/api/bis/presets/DRG?category=savage" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"

# Load preset data using bis|job|tier format
curl -X GET "https://api.xivraidplanner.app/api/bis/xivgear/bis|drg|current" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"`}
                csharp={`using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");
using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Get available presets for a job
var presetsResponse = await client.GetAsync("https://api.xivraidplanner.app/api/bis/presets/DRG?category=savage");
presetsResponse.EnsureSuccessStatusCode();

var presetsData = await presetsResponse.Content.ReadFromJsonAsync<JsonDocument>();
var presets = presetsData.RootElement.GetProperty("presets").EnumerateArray().ToList();

Console.WriteLine("Available presets for DRG:");
foreach (var preset in presets)
{
    var name = preset.GetProperty("name").GetString();
    var gcd = preset.TryGetProperty("gcd", out var gcdProp) ? gcdProp.GetString() : "N/A";
    Console.WriteLine($"  - {name} (GCD: {gcd})");
}

// Load a preset using the bis|job|tier format
if (presets.Any())
{
    var tier = presets[0].TryGetProperty("githubTier", out var tierProp) ? tierProp.GetString() : "current";
    var bisResponse = await client.GetAsync($"https://api.xivraidplanner.app/api/bis/xivgear/bis|drg|{tier}");
    bisResponse.EnsureSuccessStatusCode();

    var bisData = await bisResponse.Content.ReadFromJsonAsync<JsonDocument>();
    var bisName = bisData.RootElement.GetProperty("name").GetString();
    Console.WriteLine($"Loaded preset: {bisName}");
}`}
              />
            </Subsection>
          </Section>

          {/* Log Loot */}
          <Section id="log-loot" title="Log Loot">
            <p className="text-text-secondary mb-6">
              Record loot drops and track who received what items each week.
            </p>

            <Subsection title="Log a Drop">
              <TripleCodeBlock
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
                curl={`curl -X POST "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/loot-log" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "weekNumber": 1,
    "floor": "M9S",
    "itemSlot": "earring",
    "recipientPlayerId": "player-uuid",
    "method": "drop"
  }'`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Log a loot drop
var payload = new
{
    weekNumber = 1,
    floor = "M9S",
    itemSlot = "earring",
    recipientPlayerId = "player-uuid",
    method = "drop"  // or "book", "tome"
};

var response = await client.PostAsJsonAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/loot-log",
    payload
);
response.EnsureSuccessStatusCode();

var lootEntry = await response.Content.ReadFromJsonAsync<JsonDocument>();
var id = lootEntry.RootElement.GetProperty("id").GetString();

Console.WriteLine($"Logged loot entry #{id}");`}
              />
            </Subsection>

            <Subsection title="Get Loot History">
              <TripleCodeBlock
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
                curl={`curl -X GET "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/loot-log" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"

# Filter by week
curl -X GET "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/loot-log?week=1" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"`}
                csharp={`using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Get all loot entries
var response = await client.GetAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/loot-log"
);
response.EnsureSuccessStatusCode();

var lootLog = await response.Content.ReadFromJsonAsync<JsonDocument>();
var entries = lootLog.RootElement.EnumerateArray();

// Group by week
var byWeek = entries.GroupBy(e => e.GetProperty("weekNumber").GetInt32())
                    .OrderBy(g => g.Key);

foreach (var week in byWeek)
{
    Console.WriteLine($"\nWeek {week.Key}:");
    foreach (var entry in week)
    {
        var floor = entry.GetProperty("floor").GetString();
        var itemSlot = entry.GetProperty("itemSlot").GetString();
        var playerName = entry.GetProperty("recipientPlayerName").GetString();
        Console.WriteLine($"  {floor} {itemSlot} -> {playerName}");
    }
}`}
              />
            </Subsection>
          </Section>

          {/* Track Pages */}
          <Section id="track-pages" title="Track Pages">
            <p className="text-text-secondary mb-6">
              Track book/page earnings and spending for the page exchange system.
            </p>

            <Subsection title="Mark Floor Cleared">
              <TripleCodeBlock
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
                curl={`curl -X POST "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/mark-floor-cleared" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "weekNumber": 1,
    "floor": "M9S",
    "playerIds": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5", "uuid6", "uuid7", "uuid8"]
  }'`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Mark a floor as cleared for multiple players
var payload = new
{
    weekNumber = 1,
    floor = "M9S",
    playerIds = new[]
    {
        "player-uuid-1",
        "player-uuid-2",
        "player-uuid-3",
        // ... all 8 players who cleared
    }
};

var response = await client.PostAsJsonAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/mark-floor-cleared",
    payload
);
response.EnsureSuccessStatusCode();

Console.WriteLine("Floor clear marked for all players");`}
              />
            </Subsection>

            <Subsection title="Get Page Balances">
              <TripleCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"
tier_id = "your-tier-uuid"

# Get current book balances for all players
balances = api_get(f"/static-groups/{static_id}/tiers/{tier_id}/page-balances")

print("Book Balances:")
print("-" * 50)
for player in balances:
    print(f"{player['playerName']:20} I:{player['bookI']:2} II:{player['bookII']:2} III:{player['bookIII']:2} IV:{player['bookIV']:2}")`}
                curl={`curl -X GET "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/tiers/$TIER_ID/page-balances" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var tierId = "your-tier-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Get current book balances for all players
var response = await client.GetAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/tiers/{tierId}/page-balances"
);
response.EnsureSuccessStatusCode();

var balances = await response.Content.ReadFromJsonAsync<JsonDocument>();
var players = balances.RootElement.EnumerateArray();

Console.WriteLine("Book Balances:");
Console.WriteLine(new string('-', 50));
foreach (var player in players)
{
    var name = player.GetProperty("playerName").GetString();
    var bookI = player.GetProperty("bookI").GetInt32();
    var bookII = player.GetProperty("bookII").GetInt32();
    var bookIII = player.GetProperty("bookIII").GetInt32();
    var bookIV = player.GetProperty("bookIV").GetInt32();
    Console.WriteLine($"{name,-20} I:{bookI,2} II:{bookII,2} III:{bookIII,2} IV:{bookIV,2}");
}`}
              />
            </Subsection>
          </Section>

          {/* Invitation Links */}
          <Section id="invitations" title="Invitation Links">
            <p className="text-text-secondary mb-6">
              Create invitation links to add members to your static with specific roles.
            </p>

            <Subsection title="Create an Invite">
              <TripleCodeBlock
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
print(f"Invite URL: https://www.xivraidplanner.app/invite/{invite['inviteCode']}")
print(f"Expires: {invite['expiresAt']}")`}
                curl={`curl -X POST "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/invitations" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "member",
    "expiresInDays": 7,
    "maxUses": 10
  }'`}
                csharp={`using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Create an invitation link
var payload = new
{
    role = "member",  // or "lead", "viewer"
    expiresInDays = 7,
    maxUses = 10
};

var response = await client.PostAsJsonAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/invitations",
    payload
);
response.EnsureSuccessStatusCode();

var invite = await response.Content.ReadFromJsonAsync<JsonDocument>();
var inviteCode = invite.RootElement.GetProperty("inviteCode").GetString();
var expiresAt = invite.RootElement.GetProperty("expiresAt").GetString();

Console.WriteLine($"Invite Code: {inviteCode}");
Console.WriteLine($"Invite URL: https://www.xivraidplanner.app/invite/{inviteCode}");
Console.WriteLine($"Expires: {expiresAt}");`}
              />
            </Subsection>

            <Subsection title="List Active Invites">
              <TripleCodeBlock
                python={`from raid_planner import api_get

static_id = "your-static-uuid"

# Get all invitations
invites = api_get(f"/static-groups/{static_id}/invitations")

print("Active Invitations:")
for invite in invites:
    if invite['isValid']:
        print(f"  {invite['inviteCode']} - {invite['role']} ({invite['useCount']}/{invite['maxUses']} uses)")`}
                curl={`curl -X GET "https://api.xivraidplanner.app/api/static-groups/$STATIC_ID/invitations" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY"`}
                csharp={`using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;

var staticId = "your-static-uuid";
var apiKey = Environment.GetEnvironmentVariable("RAID_PLANNER_API_KEY")
    ?? throw new Exception("Set RAID_PLANNER_API_KEY environment variable");

using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

// Get all invitations
var response = await client.GetAsync(
    $"https://api.xivraidplanner.app/api/static-groups/{staticId}/invitations"
);
response.EnsureSuccessStatusCode();

var invites = await response.Content.ReadFromJsonAsync<JsonDocument>();
var inviteList = invites.RootElement.EnumerateArray();

Console.WriteLine("Active Invitations:");
foreach (var invite in inviteList.Where(i => i.GetProperty("isValid").GetBoolean()))
{
    var code = invite.GetProperty("inviteCode").GetString();
    var role = invite.GetProperty("role").GetString();
    var useCount = invite.GetProperty("useCount").GetInt32();
    var maxUses = invite.GetProperty("maxUses").GetInt32();
    Console.WriteLine($"  {code} - {role} ({useCount}/{maxUses} uses)");
}`}
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

            <Subsection title="Error Handling Examples">
              <TripleCodeBlock
                python={`import httpx
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
            print("Authentication failed - check your API key")
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
                curl={`# Example: Handle 404 error
curl -X GET "https://api.xivraidplanner.app/api/static-groups/invalid-id" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -w "\\nHTTP Status: %{http_code}\\n"

# Response:
# HTTP Status: 404
# {
#   "detail": "Static group not found"
# }

# Example: Handle 403 permission denied
curl -X DELETE "https://api.xivraidplanner.app/api/static-groups/{id}" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -w "\\nHTTP Status: %{http_code}\\n"

# Response:
# HTTP Status: 403
# {
#   "detail": "Only the owner can delete this group"
# }

# Example: Handle 429 rate limit
curl -X POST "https://api.xivraidplanner.app/api/static-groups" \\
  -H "Authorization: Bearer $RAID_PLANNER_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Test"}' \\
  -w "\\nHTTP Status: %{http_code}\\nRetry-After: %{header_retry_after}\\n"

# Response:
# HTTP Status: 429
# Retry-After: 60
# {
#   "detail": "Too many requests"
# }`}
                csharp={`using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;

public async Task<T> SafeApiCall<T>(
    HttpClient client,
    HttpMethod method,
    string path,
    object data = null)
{
    try
    {
        var request = new HttpRequestMessage(method, path);

        if (data != null && (method == HttpMethod.Post || method == HttpMethod.Put))
        {
            request.Content = JsonContent.Create(data);
        }

        var response = await client.SendAsync(request);

        // Handle specific status codes
        if (!response.IsSuccessStatusCode)
        {
            switch (response.StatusCode)
            {
                case HttpStatusCode.Unauthorized:
                    Console.WriteLine("Authentication failed - check your API key");
                    break;
                case HttpStatusCode.Forbidden:
                    Console.WriteLine("Permission denied - check your role");
                    break;
                case HttpStatusCode.NotFound:
                    Console.WriteLine("Resource not found");
                    break;
                case (HttpStatusCode)429: // TooManyRequests
                    Console.WriteLine("Rate limited - wait and retry");
                    var retryAfter = response.Headers.RetryAfter?.Delta?.TotalSeconds ?? 60;
                    Console.WriteLine($"Retry after {retryAfter} seconds");
                    break;
                default:
                    var errorBody = await response.Content.ReadAsStringAsync();
                    var errorJson = JsonDocument.Parse(errorBody);
                    var message = errorJson.RootElement.GetProperty("detail").GetString();
                    Console.WriteLine($"API Error: {message}");
                    break;
            }

            return default;
        }

        return await response.Content.ReadFromJsonAsync<T>();
    }
    catch (HttpRequestException ex)
    {
        Console.WriteLine($"Network error: {ex.Message}");
        return default;
    }
}`}
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
                      <td className="py-2 text-text-secondary">Check your API key is valid and active</td>
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
