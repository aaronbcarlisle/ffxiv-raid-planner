/**
 * API Documentation
 *
 * REST API reference for developers integrating with the FFXIV Raid Planner.
 * Documents all endpoints, authentication, and request/response schemas.
 *
 * Accessible at: /docs/api
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { CodeBlock, LinkCard } from '../components/docs';

// Navigation items grouped by category
const NAV_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'overview', label: 'Overview' },
      { id: 'authentication', label: 'Authentication' },
      { id: 'error-handling', label: 'Error Handling' },
    ],
  },
  {
    label: 'Auth Endpoints',
    items: [
      { id: 'auth-discord', label: 'Discord OAuth' },
      { id: 'auth-tokens', label: 'Token Management' },
    ],
  },
  {
    label: 'Static Groups',
    items: [
      { id: 'groups-crud', label: 'CRUD Operations' },
      { id: 'groups-membership', label: 'Membership' },
    ],
  },
  {
    label: 'Tier Snapshots',
    items: [
      { id: 'tiers-crud', label: 'CRUD Operations' },
      { id: 'tiers-rollover', label: 'Tier Rollover' },
    ],
  },
  {
    label: 'Players',
    items: [
      { id: 'players-crud', label: 'CRUD Operations' },
      { id: 'players-claim', label: 'Claim/Release' },
    ],
  },
  {
    label: 'Loot Tracking',
    items: [
      { id: 'loot-log', label: 'Loot Log' },
      { id: 'page-ledger', label: 'Page Ledger' },
      { id: 'material-log', label: 'Material Log' },
    ],
  },
  {
    label: 'BiS Import',
    items: [
      { id: 'bis-presets', label: 'Presets' },
      { id: 'bis-import', label: 'XIVGear/Etro' },
    ],
  },
  {
    label: 'Invitations',
    items: [
      { id: 'invites-manage', label: 'Manage Invites' },
      { id: 'invites-accept', label: 'Accept Invites' },
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

// Endpoint card component
function EndpointCard({
  method,
  path,
  description,
  auth = false,
  requestBody,
  responseBody,
}: {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  auth?: boolean;
  requestBody?: string;
  responseBody?: string;
}) {
  const methodColors = {
    GET: 'bg-status-info/20 text-status-info',
    POST: 'bg-status-success/20 text-status-success',
    PUT: 'bg-status-warning/20 text-status-warning',
    DELETE: 'bg-status-error/20 text-status-error',
  };

  return (
    <div className="bg-surface-card border border-border-subtle rounded-lg p-4 mb-4">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2 py-1 rounded text-xs font-mono font-bold ${methodColors[method]}`}>
          {method}
        </span>
        <code className="text-text-primary font-mono text-sm">{path}</code>
        {auth && (
          <span className="px-2 py-0.5 bg-status-warning/10 text-status-warning text-xs rounded">
            Auth Required
          </span>
        )}
      </div>
      <p className="text-text-secondary text-sm mb-3">{description}</p>
      {requestBody && (
        <div className="mb-3">
          <CodeBlock language="json" title="Request Body" code={requestBody} />
        </div>
      )}
      {responseBody && (
        <div>
          <CodeBlock language="json" title="Response" code={responseBody} />
        </div>
      )}
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
    <nav className="sticky top-16 w-56 shrink-0 hidden lg:block self-start h-fit z-30">
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
          className="p-3 max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin"
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

export default function ApiDocs() {
  const location = useLocation();
  const navigate = useNavigate();
  // Initialize from URL hash if present
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.some(s => s.id === id)) return id;
    }
    return 'overview';
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
        bestSection = sections[0]?.id || 'overview';
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
            <span className="text-text-secondary">API Reference</span>
          </div>
          <h1 className="text-3xl font-bold text-accent">API Reference</h1>
          <p className="text-text-secondary mt-2">
            REST API documentation for developers integrating with FFXIV Raid Planner
          </p>
        </div>
      </header>

      {/* Content with Sidebar */}
      <div className="max-w-[120rem] mx-auto px-6 lg:px-8 py-8 flex gap-8">
        <NavSidebar activeSection={activeSection} onSectionClick={handleNavClick} />

        <main className="flex-1 min-w-0">
          {/* Overview */}
          <Section id="overview" title="Overview">
            <p className="text-text-secondary mb-6">
              The FFXIV Raid Planner API is a RESTful API that uses JSON for request and response bodies.
              All endpoints are prefixed with <code className="text-accent">/api</code>.
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

            <InfoBox type="info" title="OpenAPI Spec">
              FastAPI auto-generates OpenAPI documentation at <code>/docs</code> (Swagger UI)
              and <code>/redoc</code> (ReDoc) on the backend server.
            </InfoBox>

            <LinkCard
              href="/docs/api/cookbook"
              title="API Cookbook"
              description="Practical examples in Python, C#, and curl for common workflows"
            />
          </Section>

          {/* Authentication */}
          <Section id="authentication" title="Authentication">
            <p className="text-text-secondary mb-6">
              The API uses JWT (JSON Web Tokens) for authentication via Discord OAuth.
            </p>

            <Subsection title="Authentication Flow">
              <ol className="list-decimal list-inside space-y-2 text-text-secondary mb-6">
                <li>User clicks "Login with Discord"</li>
                <li>Frontend redirects to <code className="text-accent">/api/auth/discord</code></li>
                <li>Backend returns Discord OAuth URL</li>
                <li>User authorizes on Discord</li>
                <li>Discord redirects to callback with authorization code</li>
                <li>Frontend sends code to <code className="text-accent">/api/auth/discord/callback</code></li>
                <li>Backend exchanges code for tokens, creates/updates user, returns JWT</li>
              </ol>
            </Subsection>

            <Subsection title="Using the Token">
              <p className="text-text-secondary mb-4">
                Include the access token in the Authorization header:
              </p>
              <CodeBlock
                language="bash"
                code={`Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`}
              />
            </Subsection>

            <Subsection title="Token Refresh">
              <p className="text-text-secondary mb-4">
                Access tokens expire after 15 minutes. Use the refresh token to get a new access token:
              </p>
              <CodeBlock
                language="json"
                title="POST /api/auth/refresh"
                code={`{
  "refreshToken": "your-refresh-token"
}`}
              />
            </Subsection>
          </Section>

          {/* Error Handling */}
          <Section id="error-handling" title="Error Handling">
            <p className="text-text-secondary mb-6">
              All errors return a structured JSON response with an error code and message.
            </p>

            <CodeBlock
              language="json"
              title="Error Response Format"
              code={`{
  "error": "error_code",
  "message": "Human-readable error message",
  "detail": "Additional context (optional)"
}`}
            />

            <Subsection title="HTTP Status Codes">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-2 text-text-muted font-medium">Code</th>
                      <th className="text-left py-2 text-text-muted font-medium">Meaning</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    <tr>
                      <td className="py-2 text-accent font-mono">200</td>
                      <td className="py-2 text-text-secondary">Success</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">201</td>
                      <td className="py-2 text-text-secondary">Created</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">204</td>
                      <td className="py-2 text-text-secondary">No Content (successful deletion)</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">400</td>
                      <td className="py-2 text-text-secondary">Bad Request - Invalid input</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">401</td>
                      <td className="py-2 text-text-secondary">Unauthorized - Not authenticated</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">403</td>
                      <td className="py-2 text-text-secondary">Forbidden - Permission denied</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">404</td>
                      <td className="py-2 text-text-secondary">Not Found</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">409</td>
                      <td className="py-2 text-text-secondary">Conflict - Resource already exists</td>
                    </tr>
                    <tr>
                      <td className="py-2 text-accent font-mono">429</td>
                      <td className="py-2 text-text-secondary">Too Many Requests - Rate limited</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Subsection>
          </Section>

          {/* Auth - Discord OAuth */}
          <Section id="auth-discord" title="Discord OAuth">
            <EndpointCard
              method="GET"
              path="/api/auth/discord"
              description="Get the Discord OAuth authorization URL. Redirect the user to this URL to initiate login."
              responseBody={`{
  "url": "https://discord.com/oauth2/authorize?...",
  "state": "random-state-token"
}`}
            />

            <EndpointCard
              method="POST"
              path="/api/auth/discord/callback"
              description="Exchange the Discord authorization code for access and refresh tokens."
              requestBody={`{
  "code": "discord-auth-code",
  "state": "state-from-url"
}`}
              responseBody={`{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "tokenType": "bearer",
  "expiresIn": 900
}`}
            />
          </Section>

          {/* Auth - Token Management */}
          <Section id="auth-tokens" title="Token Management">
            <EndpointCard
              method="POST"
              path="/api/auth/refresh"
              description="Refresh an expired access token using a valid refresh token."
              requestBody={`{
  "refreshToken": "your-refresh-token"
}`}
              responseBody={`{
  "accessToken": "new-jwt-access-token",
  "refreshToken": "new-jwt-refresh-token",
  "tokenType": "bearer",
  "expiresIn": 900
}`}
            />

            <EndpointCard
              method="POST"
              path="/api/auth/logout"
              description="Invalidate the current session."
              auth={true}
              responseBody={`{
  "message": "Logged out successfully"
}`}
            />

            <EndpointCard
              method="GET"
              path="/api/auth/me"
              description="Get the currently authenticated user's information."
              auth={true}
              responseBody={`{
  "id": "uuid",
  "discordId": "123456789",
  "discordUsername": "Player",
  "discordAvatar": "abc123",
  "avatarUrl": "https://cdn.discordapp.com/...",
  "createdAt": "2024-01-01T00:00:00Z"
}`}
            />
          </Section>

          {/* Static Groups - CRUD */}
          <Section id="groups-crud" title="Static Groups - CRUD">
            <EndpointCard
              method="GET"
              path="/api/static-groups"
              description="List all static groups the user is a member of."
              auth={true}
              responseBody={`[
  {
    "id": "uuid",
    "name": "My Static",
    "shareCode": "ABC12345",
    "isPublic": false,
    "ownerId": "uuid",
    "memberCount": 8,
    "userRole": "owner",
    "createdAt": "2024-01-01T00:00:00Z"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups"
              description="Create a new static group. The creator becomes the owner."
              auth={true}
              requestBody={`{
  "name": "My New Static",
  "isPublic": false,
  "settings": {
    "lootPriority": ["melee", "ranged", "caster", "tank", "healer"]
  }
}`}
              responseBody={`{
  "id": "uuid",
  "name": "My New Static",
  "shareCode": "XYZ98765",
  ...
}`}
            />

            <EndpointCard
              method="GET"
              path="/api/static-groups/by-code/{shareCode}"
              description="Get a static group by its share code. Returns the group if public or user is a member."
              responseBody={`{
  "id": "uuid",
  "name": "My Static",
  "shareCode": "ABC12345",
  "isPublic": false,
  "ownerId": "uuid",
  "owner": {
    "id": "uuid",
    "discordUsername": "Owner",
    "avatarUrl": "..."
  },
  "members": [...],
  "userRole": "member",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}"
              description="Get a static group by ID. Public groups allow anonymous access."
              responseBody={`{
  "id": "uuid",
  "name": "My Static",
  "shareCode": "ABC12345",
  "isPublic": false,
  "ownerId": "uuid",
  "owner": {
    "id": "uuid",
    "discordUsername": "Owner",
    "avatarUrl": "..."
  },
  "members": [...],
  "settings": {
    "lootPriority": ["melee", "ranged", "caster", "tank", "healer"]
  },
  "userRole": "member",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="PUT"
              path="/api/static-groups/{id}"
              description="Update a static group. Name/settings require Lead+. Visibility requires Owner."
              auth={true}
              requestBody={`{
  "name": "Updated Name",
  "isPublic": true,
  "settings": {
    "lootPriority": ["tank", "healer", "melee", "ranged", "caster"]
  }
}`}
              responseBody={`{
  "id": "uuid",
  "name": "Updated Name",
  "shareCode": "ABC12345",
  "isPublic": true,
  "ownerId": "uuid",
  "memberCount": 8,
  "userRole": "owner",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}"
              description="Delete a static group and all associated data (tiers, players, loot logs). Requires Owner role."
              auth={true}
              responseBody="204 No Content"
            />
          </Section>

          {/* Static Groups - Membership */}
          <Section id="groups-membership" title="Static Groups - Membership">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/members"
              description="List all members of a static group."
              auth={true}
              responseBody={`[
  {
    "id": "uuid",
    "userId": "uuid",
    "role": "owner",
    "joinedAt": "2024-01-01T00:00:00Z",
    "user": {
      "discordUsername": "Player",
      "avatarUrl": "..."
    }
  }
]`}
            />

            <EndpointCard
              method="PUT"
              path="/api/static-groups/{id}/members/{userId}"
              description="Update a member's role. Requires Lead or Owner role. Leads can only manage members/viewers, not other leads."
              auth={true}
              requestBody={`{
  "role": "lead"
}`}
              responseBody={`{
  "id": "uuid",
  "userId": "uuid",
  "staticGroupId": "uuid",
  "role": "lead",
  "joinedAt": "2024-01-01T00:00:00Z",
  "user": {
    "id": "uuid",
    "discordUsername": "Player",
    "avatarUrl": "..."
  }
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/members/{userId}"
              description="Remove a member from the group. Requires Lead+ or self-removal. Owner cannot leave without transferring ownership first."
              auth={true}
              responseBody="204 No Content"
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/transfer-ownership"
              description="Transfer group ownership to another member. Current owner is demoted to Lead. Requires Owner role."
              auth={true}
              requestBody={`{
  "newOwnerId": "uuid"
}`}
              responseBody={`{
  "id": "uuid",
  "name": "My Static",
  "shareCode": "ABC12345",
  "isPublic": false,
  "ownerId": "new-uuid",
  "memberCount": 8,
  "userRole": "lead",
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />
          </Section>

          {/* Tiers - CRUD */}
          <Section id="tiers-crud" title="Tier Snapshots - CRUD">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers"
              description="List all tier snapshots for a static group."
              responseBody={`[
  {
    "id": "uuid",
    "tierId": "aac-heavyweight",
    "contentType": "savage",
    "isActive": true,
    "playerCount": 8,
    "createdAt": "2024-01-01T00:00:00Z"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers"
              description="Create a new tier snapshot with 8 template player slots. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "tierId": "aac-cruiserweight",
  "contentType": "savage",
  "isActive": true
}`}
              responseBody={`{
  "id": "uuid",
  "staticGroupId": "uuid",
  "tierId": "aac-cruiserweight",
  "contentType": "savage",
  "isActive": true,
  "players": [
    {
      "id": "uuid",
      "name": "",
      "job": "",
      "role": "",
      "position": "T1",
      "tankRole": "MT",
      "configured": false,
      "sortOrder": 0,
      "gear": [...],
      ...
    }
  ],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}"
              description="Get a tier snapshot with all players."
              responseBody={`{
  "id": "uuid",
  "tierId": "aac-heavyweight",
  "players": [
    {
      "id": "uuid",
      "name": "Player Name",
      "job": "DRG",
      "role": "melee",
      "gear": [...],
      ...
    }
  ]
}`}
            />

            <EndpointCard
              method="PUT"
              path="/api/static-groups/{id}/tiers/{tierId}"
              description="Update tier settings (e.g., set as active). Setting a tier as active deactivates all other tiers. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "isActive": true
}`}
              responseBody={`{
  "id": "uuid",
  "staticGroupId": "uuid",
  "tierId": "aac-heavyweight",
  "contentType": "savage",
  "isActive": true,
  "playerCount": 8,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/tiers/{tierId}"
              description="Delete a tier snapshot and all associated data (players, loot logs, page ledger entries). Requires Lead or Owner role."
              auth={true}
              responseBody="204 No Content"
            />
          </Section>

          {/* Tiers - Rollover */}
          <Section id="tiers-rollover" title="Tier Rollover">
            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/rollover"
              description="Copy the roster from one tier to a new tier. Useful when a new raid tier releases."
              auth={true}
              requestBody={`{
  "targetTierId": "new-tier-id",
  "resetGear": true
}`}
              responseBody={`{
  "sourceSnapshot": {...},
  "targetSnapshot": {...},
  "playersCopied": 8
}`}
            />

            <InfoBox type="tip" title="Roster Preservation">
              Rollover copies all players, their jobs, positions, and weapon priorities.
              Set <code>resetGear: true</code> to clear gear progress for the new tier.
            </InfoBox>
          </Section>

          {/* Players - CRUD */}
          <Section id="players-crud" title="Players - CRUD">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}/players"
              description="List all players in a tier snapshot."
              responseBody={`[
  {
    "id": "uuid",
    "tierSnapshotId": "uuid",
    "userId": "uuid",
    "linkedUser": {
      "id": "uuid",
      "discordUsername": "Player",
      "membershipRole": "member"
    },
    "name": "Player Name",
    "job": "DRG",
    "role": "melee",
    "position": "M1",
    "configured": true,
    "sortOrder": 0,
    "isSubstitute": false,
    "gear": [...],
    "tomeWeapon": {...},
    "weaponPriorities": [],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/players"
              description="Add a new player to the tier. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "name": "New Player",
  "job": "WHM",
  "role": "healer",
  "position": "H1",
  "tankRole": null,
  "configured": true,
  "sortOrder": 8,
  "isSubstitute": false
}`}
              responseBody={`{
  "id": "uuid",
  "tierSnapshotId": "uuid",
  "userId": null,
  "linkedUser": null,
  "name": "New Player",
  "job": "WHM",
  "role": "healer",
  "position": "H1",
  "configured": true,
  "sortOrder": 8,
  "isSubstitute": false,
  "gear": [...],
  "tomeWeapon": {...},
  "weaponPriorities": [],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="PUT"
              path="/api/static-groups/{id}/tiers/{tierId}/players/{playerId}"
              description="Update a player's information. Requires Lead+, Owner, or ownership of the player card. Members can only update their own player."
              auth={true}
              requestBody={`{
  "name": "Updated Name",
  "job": "AST",
  "bisLink": "https://xivgear.app/?page=...",
  "gear": [
    {
      "slot": "weapon",
      "bisSource": "raid",
      "currentSource": "savage",
      "hasItem": true,
      "isAugmented": false,
      "itemName": "Skyruin Staff",
      "itemLevel": 735
    }
  ]
}`}
              responseBody={`{
  "id": "uuid",
  "tierSnapshotId": "uuid",
  "userId": "uuid",
  "linkedUser": {...},
  "name": "Updated Name",
  "job": "AST",
  "role": "healer",
  "position": "H1",
  "bisLink": "https://xivgear.app/?page=...",
  "gear": [...],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/tiers/{tierId}/players/{playerId}"
              description="Remove a player from the tier. Requires Lead or Owner role."
              auth={true}
              responseBody="204 No Content"
            />
          </Section>

          {/* Players - Claim */}
          <Section id="players-claim" title="Players - Claim/Release">
            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/players/{playerId}/claim"
              description="Link your user account to a player card. Allows you to edit the player. Must be a group member."
              auth={true}
              responseBody={`{
  "id": "uuid",
  "tierSnapshotId": "uuid",
  "userId": "uuid",
  "linkedUser": {
    "id": "uuid",
    "discordId": "123456789",
    "discordUsername": "Player",
    "discordAvatar": "abc123",
    "avatarUrl": "https://cdn.discordapp.com/...",
    "displayName": "Player",
    "membershipRole": "member"
  },
  "name": "Player Name",
  "job": "DRG",
  "role": "melee",
  "position": "M1",
  "configured": true,
  "sortOrder": 0,
  "isSubstitute": false,
  "gear": [...],
  "tomeWeapon": {...},
  "weaponPriorities": [],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/tiers/{tierId}/players/{playerId}/claim"
              description="Unlink your user account from a player card. You can release yourself, or Owner can release anyone."
              auth={true}
              responseBody={`{
  "id": "uuid",
  "tierSnapshotId": "uuid",
  "userId": null,
  "linkedUser": null,
  "name": "Player Name",
  "job": "DRG",
  "role": "melee",
  "configured": true,
  "gear": [...],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}`}
            />

            <InfoBox type="info" title="Permissions">
              Once you claim a player card, you can edit that player's gear, BiS, and settings
              even if you only have "Member" role in the static.
            </InfoBox>
          </Section>

          {/* Loot Log */}
          <Section id="loot-log" title="Loot Log">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}/loot-log"
              description="Get loot log entries. Optionally filter by week using ?week=N query parameter."
              responseBody={`[
  {
    "id": 1,
    "tierSnapshotId": "uuid",
    "weekNumber": 1,
    "floor": "M9S",
    "itemSlot": "earring",
    "recipientPlayerId": "uuid",
    "recipientPlayerName": "Player",
    "method": "drop",
    "notes": "Optional notes",
    "weaponJob": "DRG",
    "isExtra": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "createdByUserId": "uuid",
    "createdByUsername": "User"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/loot-log"
              description="Log a loot drop. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "weekNumber": 1,
  "floor": "M9S",
  "itemSlot": "earring",
  "recipientPlayerId": "uuid",
  "method": "drop",
  "notes": "Optional notes",
  "weaponJob": "DRG",
  "isExtra": false
}`}
              responseBody={`{
  "id": 1,
  "tierSnapshotId": "uuid",
  "weekNumber": 1,
  "floor": "M9S",
  "itemSlot": "earring",
  "recipientPlayerId": "uuid",
  "recipientPlayerName": "Player",
  "method": "drop",
  "notes": "Optional notes",
  "weaponJob": "DRG",
  "isExtra": false,
  "createdAt": "2024-01-01T00:00:00Z",
  "createdByUserId": "uuid",
  "createdByUsername": "User"
}`}
            />

            <EndpointCard
              method="PUT"
              path="/api/static-groups/{id}/tiers/{tierId}/loot-log/{entryId}"
              description="Update a loot log entry. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "weekNumber": 2,
  "floor": "M10S",
  "itemSlot": "weapon",
  "recipientPlayerId": "new-uuid",
  "method": "book",
  "notes": "Updated notes",
  "weaponJob": "WHM",
  "isExtra": true
}`}
              responseBody={`{
  "id": 1,
  "tierSnapshotId": "uuid",
  "weekNumber": 2,
  "floor": "M10S",
  "itemSlot": "weapon",
  "recipientPlayerId": "new-uuid",
  "recipientPlayerName": "Player",
  "method": "book",
  "notes": "Updated notes",
  "weaponJob": "WHM",
  "isExtra": true,
  "createdAt": "2024-01-01T00:00:00Z",
  "createdByUserId": "uuid",
  "createdByUsername": "User"
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/tiers/{tierId}/loot-log/{entryId}"
              description="Delete a loot log entry. Requires Lead or Owner role."
              auth={true}
              responseBody="204 No Content"
            />
          </Section>

          {/* Page Ledger */}
          <Section id="page-ledger" title="Page Ledger">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}/page-ledger"
              description="Get page ledger entries for book tracking. Optionally filter by week using ?week=N query parameter."
              responseBody={`[
  {
    "id": 1,
    "tierSnapshotId": "uuid",
    "playerId": "uuid",
    "playerName": "Player",
    "weekNumber": 1,
    "floor": "M9S",
    "bookType": "I",
    "transactionType": "earned",
    "quantity": 1,
    "notes": "Optional notes",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdByUserId": "uuid",
    "createdByUsername": "User"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/page-ledger"
              description="Create a page ledger entry. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "playerId": "uuid",
  "weekNumber": 1,
  "floor": "M9S",
  "bookType": "I",
  "transactionType": "earned",
  "quantity": 1,
  "notes": "Optional notes"
}`}
              responseBody={`{
  "id": 1,
  "tierSnapshotId": "uuid",
  "playerId": "uuid",
  "playerName": "Player",
  "weekNumber": 1,
  "floor": "M9S",
  "bookType": "I",
  "transactionType": "earned",
  "quantity": 1,
  "notes": "Optional notes",
  "createdAt": "2024-01-01T00:00:00Z",
  "createdByUserId": "uuid",
  "createdByUsername": "User"
}`}
            />

            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}/page-balances"
              description="Get current book balances for all players."
              responseBody={`[
  {
    "playerId": "uuid",
    "playerName": "Player",
    "bookI": 3,
    "bookII": 2,
    "bookIII": 1,
    "bookIV": 0
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/mark-floor-cleared"
              description="Batch add 'earned' entries for multiple players clearing a floor. Automatically determines book type from floor. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "weekNumber": 1,
  "floor": "M9S",
  "playerIds": ["uuid1", "uuid2", ...],
  "notes": "Optional notes"
}`}
              responseBody={`{
  "message": "Marked 8 players as having cleared M9S"
}`}
            />
          </Section>

          {/* Material Log */}
          <Section id="material-log" title="Material Log">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}/material-log"
              description="Get material log entries (Twine, Glaze, Solvent, Universal Tomestone). Optionally filter by week using ?week=N query parameter."
              responseBody={`[
  {
    "id": 1,
    "tierSnapshotId": "uuid",
    "weekNumber": 1,
    "floor": "M11S",
    "materialType": "twine",
    "recipientPlayerId": "uuid",
    "recipientPlayerName": "Player",
    "notes": "Optional notes",
    "createdAt": "2024-01-01T00:00:00Z",
    "createdByUserId": "uuid",
    "createdByUsername": "User"
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/tiers/{tierId}/material-log"
              description="Log a material drop. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "weekNumber": 1,
  "floor": "M11S",
  "materialType": "twine",
  "recipientPlayerId": "uuid",
  "notes": "Optional notes"
}`}
              responseBody={`{
  "id": 1,
  "tierSnapshotId": "uuid",
  "weekNumber": 1,
  "floor": "M11S",
  "materialType": "twine",
  "recipientPlayerId": "uuid",
  "recipientPlayerName": "Player",
  "notes": "Optional notes",
  "createdAt": "2024-01-01T00:00:00Z",
  "createdByUserId": "uuid",
  "createdByUsername": "User"
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/tiers/{tierId}/material-log/{entryId}"
              description="Delete a material log entry. Requires Lead or Owner role."
              auth={true}
              responseBody="204 No Content"
            />

            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/tiers/{tierId}/material-balances"
              description="Get material counts per player."
              responseBody={`[
  {
    "playerId": "uuid",
    "playerName": "Player",
    "twine": 1,
    "glaze": 0,
    "solvent": 0
  }
]`}
            />
          </Section>

          {/* BiS Presets */}
          <Section id="bis-presets" title="BiS Presets">
            <EndpointCard
              method="GET"
              path="/api/bis/presets/{job}"
              description="Get BiS presets for a specific job. These are curated sets from the community."
              responseBody={`{
  "job": "DRG",
  "presets": [
    {
      "name": "2.50 GCD BiS",
      "uuid": "xivgear-uuid",
      "category": "savage",
      "gcd": "2.50"
    }
  ]
}`}
            />

            <InfoBox type="info" title="Preset Sources">
              Presets are sourced from The Balance Discord and other community resources.
              They're regularly updated when new gear becomes available.
            </InfoBox>
          </Section>

          {/* BiS Import */}
          <Section id="bis-import" title="XIVGear/Etro Import">
            <EndpointCard
              method="GET"
              path="/api/bis/xivgear/{uuidOrUrl}"
              description="Fetch a BiS set from XIVGear. Returns slot data with item names and icons."
              responseBody={`{
  "name": "DRG 2.50 BiS",
  "job": "DRG",
  "slots": [
    {
      "slot": "weapon",
      "source": "raid",
      "itemName": "Skyruin Lance",
      "itemLevel": 735,
      "itemIcon": "https://xivapi.com/..."
    }
  ]
}`}
            />

            <EndpointCard
              method="GET"
              path="/api/bis/etro/{uuidOrUrl}"
              description="Fetch a BiS set from Etro. Same response format as XIVGear."
            />

            <InfoBox type="tip" title="URL Support">
              Both endpoints accept either a UUID or a full URL. The backend will extract
              the UUID automatically.
            </InfoBox>
          </Section>

          {/* Invitations - Manage */}
          <Section id="invites-manage" title="Manage Invitations">
            <EndpointCard
              method="GET"
              path="/api/static-groups/{id}/invitations"
              description="List all invitations for a static group."
              auth={true}
              responseBody={`[
  {
    "id": "uuid",
    "inviteCode": "ABC12345",
    "role": "member",
    "expiresAt": "2024-01-08T00:00:00Z",
    "maxUses": 5,
    "useCount": 2,
    "isValid": true
  }
]`}
            />

            <EndpointCard
              method="POST"
              path="/api/static-groups/{id}/invitations"
              description="Create a new invitation link. Requires Lead or Owner role."
              auth={true}
              requestBody={`{
  "role": "member",
  "expiresInDays": 7,
  "maxUses": 10
}`}
            />

            <EndpointCard
              method="DELETE"
              path="/api/static-groups/{id}/invitations/{inviteId}"
              description="Revoke (deactivate) an invitation. Soft delete - sets is_active to false. Requires Lead or Owner role."
              auth={true}
              responseBody="204 No Content"
            />
          </Section>

          {/* Invitations - Accept */}
          <Section id="invites-accept" title="Accept Invitations">
            <EndpointCard
              method="GET"
              path="/api/invitations/{inviteCode}"
              description="Preview an invitation without accepting it."
              responseBody={`{
  "inviteCode": "ABC12345",
  "staticGroupName": "My Static",
  "role": "member",
  "isValid": true,
  "alreadyMember": false
}`}
            />

            <EndpointCard
              method="POST"
              path="/api/invitations/{inviteCode}/accept"
              description="Accept an invitation and join the static group."
              auth={true}
              responseBody={`{
  "success": true,
  "message": "Joined successfully",
  "staticGroupId": "uuid",
  "shareCode": "XYZ98765",
  "role": "member"
}`}
            />
          </Section>
        </main>
      </div>
    </div>
  );
}
