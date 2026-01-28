/**
 * Privacy & Security Documentation
 *
 * Explains what data we collect, how authentication works,
 * and our security practices.
 *
 * Accessible at: /docs/privacy
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Shield,
  Key,
  Database,
  Lock,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  FileCode,
  Terminal,
  Table,
} from 'lucide-react';
import { NavSidebar, CodeBlock } from '../components/docs';

// Flat list of all section IDs for scroll tracking
const NAV_SECTIONS = [
  'data-collection',
  'whats-not-collected',
  'discord-oauth',
  'session-security',
  'security-measures',
  'your-rights',
  'privacy-changes',
  'verification-evidence',
];

// Navigation items
const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { id: 'data-collection', label: 'Data collection' },
      { id: 'whats-not-collected', label: "What's NOT collected" },
    ],
  },
  {
    label: 'Authentication',
    items: [
      { id: 'discord-oauth', label: 'Discord OAuth' },
      { id: 'session-security', label: 'Session security' },
    ],
  },
  {
    label: 'Security',
    items: [
      { id: 'security-measures', label: 'Security measures' },
      { id: 'your-rights', label: 'Your rights' },
    ],
  },
  {
    label: 'History',
    items: [{ id: 'privacy-changes', label: 'Privacy changes' }],
  },
  {
    label: 'Transparency',
    items: [{ id: 'verification-evidence', label: 'Verification evidence' }],
  },
];

function DataTable() {
  const data = [
    { field: 'Discord ID', collected: true, purpose: 'Unique identifier for your account' },
    { field: 'Discord Username', collected: true, purpose: 'Your @username' },
    { field: 'Discord Display Name', collected: true, purpose: 'Display name shown in the app' },
    { field: 'Discord Avatar', collected: true, purpose: 'Profile picture' },
    { field: 'Discord Discriminator', collected: true, purpose: 'Legacy field (deprecated by Discord, stores "0" for new users)' },
    { field: 'Last Login', collected: true, purpose: 'Timestamp of your most recent login' },
    { field: 'Email Address', collected: false, purpose: 'Not collected (removed in v1.11.1)' },
    { field: 'Game Data (BiS, gear)', collected: true, purpose: 'Core app functionality' },
    { field: 'Static Group Data', collected: true, purpose: 'Core app functionality' },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default">
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Data</th>
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Collected</th>
            <th className="text-left py-3 px-4 text-text-secondary font-medium">Purpose</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.field} className="border-b border-border-subtle">
              <td className="py-3 px-4 text-text-primary font-medium">{row.field}</td>
              <td className="py-3 px-4">
                {row.collected ? (
                  <span className="inline-flex items-center gap-1.5 text-status-success">
                    <CheckCircle2 className="w-4 h-4" />
                    Yes
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-text-muted">
                    <XCircle className="w-4 h-4" />
                    No
                  </span>
                )}
              </td>
              <td className="py-3 px-4 text-text-secondary">{row.purpose}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-text-muted mt-3 italic">
        Internal system fields (id, created_at, updated_at, is_admin) are also stored for app functionality.
      </p>
    </div>
  );
}

export function PrivacyDocs() {
  const location = useLocation();
  const [activeSection, setActiveSection] = useState(() => {
    const hash = window.location.hash;
    if (hash) {
      const id = hash.slice(1);
      if (NAV_SECTIONS.includes(id)) return id;
    }
    return 'data-collection';
  });
  const isScrollingRef = useRef(false);

  const handleNavClick = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    isScrollingRef.current = true;
    window.history.replaceState(null, '', `#${sectionId}`);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.slice(1);
      if (NAV_SECTIONS.includes(sectionId)) {
        setTimeout(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location.hash]);

  useEffect(() => {
    const handleScroll = () => {
      if (isScrollingRef.current) {
        isScrollingRef.current = false;
        return;
      }

      const threshold = 150;
      const sections = NAV_SECTIONS.map((id) => ({
        id,
        element: document.getElementById(id),
      })).filter((s) => s.element);

      for (const section of sections) {
        const rect = section.element!.getBoundingClientRect();
        if (rect.top <= threshold && rect.bottom > threshold) {
          if (activeSection !== section.id) {
            setActiveSection(section.id);
            window.history.replaceState(null, '', `#${section.id}`);
          }
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeSection]);

  return (
    <div className="bg-surface-base min-h-screen">
      {/* Header */}
      <header className="bg-surface-raised border-b border-border-default">
        <div className="max-w-[90rem] mx-auto px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="w-8 h-8 text-accent" />
            <h1 className="text-3xl font-bold text-accent">Privacy & Security</h1>
          </div>
          <p className="text-text-secondary">
            Transparency about how I handle your data
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-[90rem] mx-auto px-6 lg:px-8 py-10">
        <div className="flex gap-10">
          {/* Sidebar */}
          <NavSidebar groups={NAV_GROUPS} activeSection={activeSection} onSectionClick={handleNavClick} />

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-4xl">
            {/* Data Collection */}
            <section id="data-collection" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Database className="w-6 h-6 text-accent" />
                Data Collection
              </h2>
              <p className="text-text-secondary mb-6">
                Here's exactly what data is collected and why:
              </p>
              <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
                <DataTable />
              </div>
            </section>

            {/* What's NOT Collected */}
            <section id="whats-not-collected" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <XCircle className="w-6 h-6 text-status-error" />
                What's NOT Collected
              </h2>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                <ul className="space-y-3">
                  {[
                    'Email addresses (removed in v1.11.1)',
                    'Discord access tokens (used once, then discarded)',
                    'Passwords (there are none - Discord handles auth)',
                    'Payment information (the app is free)',
                    'Your Discord servers or friends list',
                    'Ability to send messages on your behalf',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-text-secondary">
                      <XCircle className="w-5 h-5 text-text-muted shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Discord OAuth */}
            <section id="discord-oauth" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Key className="w-6 h-6 text-accent" />
                Discord OAuth
              </h2>
              <p className="text-text-secondary mb-6">
                I use Discord as an identity provider - similar to "Login with Google" on other sites.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mb-3">How it works</h3>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6 mb-6">
                <ol className="space-y-4">
                  {[
                    { step: 'You click "Login with Discord"', detail: 'You\'re redirected to Discord\'s authorization page' },
                    { step: 'Discord asks for permission', detail: 'You see exactly what\'s being requested (username and avatar only)' },
                    { step: 'You approve', detail: 'Discord sends back a one-time code' },
                    { step: 'Code is exchanged', detail: 'A temporary token is retrieved to fetch your basic profile' },
                    { step: 'Token is discarded', detail: 'The Discord token is used once, then thrown away' },
                    { step: 'You\'re logged in', detail: 'The app creates session tokens stored in secure cookies' },
                  ].map((item, i) => (
                    <li key={i} className="flex gap-4">
                      <span className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-sm font-semibold shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <div className="font-medium text-text-primary">{item.step}</div>
                        <div className="text-sm text-text-secondary">{item.detail}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <h3 className="text-lg font-semibold text-text-primary mb-3">OAuth Scope</h3>
              <p className="text-text-secondary mb-4">
                I request the <strong>minimum required scope</strong> from Discord:
              </p>
              <CodeBlock code="scope=identify" language="bash" title="OAuth scope" />
              <p className="text-text-secondary mt-4">
                This grants access to your Discord user ID, username, and avatar. Nothing else.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-3">Revoking Access</h3>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                <p className="text-text-secondary mb-4">You can revoke access anytime:</p>
                <ol className="list-decimal list-inside space-y-2 text-text-secondary">
                  <li>Go to Discord Settings → Authorized Apps</li>
                  <li>Find "FFXIV Raid Planner"</li>
                  <li>Click "Deauthorize"</li>
                </ol>
              </div>
            </section>

            {/* Session Security */}
            <section id="session-security" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Lock className="w-6 h-6 text-accent" />
                Session Security
              </h2>

              <h3 className="text-lg font-semibold text-text-primary mb-3">httpOnly Cookies</h3>
              <p className="text-text-secondary mb-4">
                Your session tokens are stored in <strong>httpOnly cookies</strong>, which means:
              </p>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6 mb-6">
                <ul className="space-y-3">
                  {[
                    { label: 'XSS Protection', detail: 'JavaScript cannot access them' },
                    { label: 'Automatic', detail: 'Sent automatically with requests (no localStorage exposure)' },
                    { label: 'CSRF Protection', detail: 'SameSite=Lax prevents cross-site attacks' },
                  ].map((item) => (
                    <li key={item.label} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-text-primary">{item.label}:</span>{' '}
                        <span className="text-text-secondary">{item.detail}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <h3 className="text-lg font-semibold text-text-primary mb-3">Token Lifecycle</h3>
              <div className="bg-surface-card border border-border-subtle rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default">
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Token</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Lifetime</th>
                      <th className="text-left py-3 px-4 text-text-secondary font-medium">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border-subtle">
                      <td className="py-3 px-4 text-text-primary font-medium">Access Token</td>
                      <td className="py-3 px-4 text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          15 minutes
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">Short-lived for API requests</td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 text-text-primary font-medium">Refresh Token</td>
                      <td className="py-3 px-4 text-text-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          7 days
                        </span>
                      </td>
                      <td className="py-3 px-4 text-text-secondary">Used to get new access tokens</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Security Measures */}
            <section id="security-measures" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Shield className="w-6 h-6 text-accent" />
                Security Measures
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Infrastructure</h3>
                  <ul className="space-y-3">
                    {[
                      'HTTPS only - all traffic encrypted',
                      'Database encryption at rest',
                      'Secrets via environment variables',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-text-secondary">
                        <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-4">Application</h3>
                  <ul className="space-y-3">
                    {[
                      'httpOnly cookies for sessions',
                      'Input validation via Pydantic schemas',
                      'SQL injection prevention (ORM)',
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3 text-text-secondary">
                        <CheckCircle2 className="w-5 h-5 text-status-success shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Your Rights */}
            <section id="your-rights" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Eye className="w-6 h-6 text-accent" />
                Your Rights
              </h2>

              <div className="space-y-6">
                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Eye className="w-5 h-5 text-accent" />
                    Access Your Data
                  </h3>
                  <p className="text-text-secondary">
                    View all your data by checking your profile, static groups, and player cards in the app.
                    For technical access, use the API endpoint <code className="bg-surface-sunken px-2 py-0.5 rounded text-sm">GET /api/auth/me</code>.
                  </p>
                </div>

                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-status-error" />
                    Delete Your Data
                  </h3>
                  <p className="text-text-secondary mb-3">To delete your data:</p>
                  <ol className="list-decimal list-inside space-y-2 text-text-secondary">
                    <li>Leave all static groups you're a member of</li>
                    <li>Delete static groups you own</li>
                    <li>Contact me to delete your account entirely via the{' '}
                      <a
                        href="https://discord.com/channels/1461997093399957527/1462005841212215549"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        Discord helpdesk
                      </a>
                    </li>
                  </ol>
                </div>

              </div>
            </section>

            {/* Privacy Changes */}
            <section id="privacy-changes" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-accent" />
                Privacy Changes History
              </h2>

              <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-status-success/10 flex items-center justify-center shrink-0">
                    <Shield className="w-6 h-6 text-status-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">v1.11.1 - Email Removal</h3>
                    <p className="text-sm text-text-muted mb-3">January 2026</p>
                    <ul className="space-y-2 text-text-secondary">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-1" />
                        Removed <code className="bg-surface-sunken px-1.5 py-0.5 rounded text-sm">email</code> from Discord OAuth scope
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-1" />
                        Purged all previously stored email addresses
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-1" />
                        Removed email column from database schema
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-status-success shrink-0 mt-1" />
                        API no longer returns email in any response
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* Verification Evidence */}
            <section id="verification-evidence" className="mb-12 scroll-mt-6">
              <h2 className="text-2xl font-bold text-text-primary mb-4 flex items-center gap-2">
                <FileCode className="w-6 h-6 text-accent" />
                Verification Evidence
              </h2>
              <p className="text-text-secondary mb-6">
                There's no way to cryptographically prove data deletion (no web app really can). But here's
                what I can show: the migration code, the deployment logs, and the database schema.
                More importantly, the OAuth scope change is something you can verify yourself without trusting me at all.
              </p>

              {/* User-Verifiable Checks */}
              <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent" />
                Verify It Yourself (No Trust Required)
              </h3>
              <div className="space-y-4 mb-8">
                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h4 className="font-semibold text-text-primary mb-2">Check OAuth Scope</h4>
                  <p className="text-text-secondary text-sm">
                    Log out, then click "Login with Discord". Check the URL - it should contain{' '}
                    <code className="bg-surface-sunken px-1.5 py-0.5 rounded">scope=identify</code> (no email).
                    Discord's permission prompt should only mention username and avatar.
                  </p>
                </div>

                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h4 className="font-semibold text-text-primary mb-2">Check API Response</h4>
                  <p className="text-text-secondary text-sm">
                    Open browser DevTools → Network tab. Find the <code className="bg-surface-sunken px-1.5 py-0.5 rounded">/api/auth/me</code> request.
                    The response should NOT contain an "email" field.
                  </p>
                </div>
              </div>

              {/* Migration Code */}
              <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                <FileCode className="w-5 h-5 text-accent" />
                Migration Code
              </h3>
              <p className="text-text-secondary mb-4">
                This is the actual database migration that dropped the email column:
              </p>
              <div className="mb-8">
                <CodeBlock
                  language="python"
                  title="backend/alembic/versions/i9j0k1l2m3n4_remove_email_column.py"
                  code={`def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = [col["name"] for col in inspector.get_columns("users")]

    if "email" in existing_columns:
        # Audit: Log count of users with emails before purging
        result = bind.execute(
            sa.text("SELECT COUNT(*) FROM users WHERE email IS NOT NULL")
        )
        email_count = result.scalar()
        print(f"[{timestamp}] AUDIT: Purging {email_count} email addresses from users table")

        # Drop the email column using batch_alter_table for SQLite compatibility
        with op.batch_alter_table("users", schema=None) as batch_op:
            batch_op.drop_column("email")
        print(f"[{timestamp}] SUCCESS: email column removed from users table")`}
                />
              </div>

              {/* Deployment Logs */}
              <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-accent" />
                Deployment Logs
              </h3>
              <p className="text-text-secondary mb-4">
                Output from the production deployment showing the migration ran successfully:
              </p>
              <div className="mb-8">
                <CodeBlock
                  language="bash"
                  title="Railway deployment logs (January 28, 2026)"
                  code={`INFO [alembic.runtime.migration] Running upgrade g7h8i9j0k1l2 -> i9j0k1l2m3n4, remove_email_column
[2026-01-28T12:34:13.891745+00:00] AUDIT: Purging 577 email addresses from users table
[2026-01-28T12:34:13.900072+00:00] SUCCESS: email column removed from users table`}
                />
              </div>

              {/* Post-Deployment Verification */}
              <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-status-success" />
                Post-Deployment Verification
              </h3>
              <p className="text-text-secondary mb-4">
                This verification runs automatically on every deployment to confirm compliance:
              </p>
              <div className="mb-8">
                <CodeBlock
                  language="bash"
                  title="Verification output (January 28, 2026)"
                  code={`======================================================================
EMAIL REMOVAL VERIFICATION REPORT
Timestamp: 2026-01-28T12:52:58.206377+00:00
======================================================================
STATUS: PASSED

VERIFICATION RESULTS:
  - Email column exists: NO (removed)
  - Total users in database: 578
  - User columns: created_at, discord_avatar, discord_discriminator, discord_id,
    discord_username, display_name, id, is_admin, last_login_at, updated_at

COMPLIANCE CONFIRMATION:
  - Discord OAuth scope: 'identify' only (no email)
  - Email data collection: DISABLED
  - Existing email data: PURGED (column dropped)
  - API email exposure: REMOVED from UserResponse

This deployment does not collect, store, or expose user emails.
======================================================================`}
                />
              </div>

              {/* Schema Verification */}
              <h3 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Table className="w-5 h-5 text-accent" />
                Schema Verification
              </h3>
              <p className="text-text-secondary mb-4">
                Query result showing the <code className="bg-surface-sunken px-1.5 py-0.5 rounded">users</code> table
                no longer has an email column:
              </p>
              <div className="mb-4">
                <CodeBlock
                  language="bash"
                  title="Database schema query"
                  code={`SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' ORDER BY ordinal_position;`}
                />
              </div>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                <h4 className="font-semibold text-text-primary mb-3">Result:</h4>
                <div className="font-mono text-sm bg-surface-sunken rounded-lg p-4 overflow-x-auto">
                  <table className="text-text-secondary">
                    <thead>
                      <tr>
                        <th className="text-left pr-8 pb-2 text-text-muted">column_name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['id', 'discord_id', 'discord_username', 'discord_discriminator', 'discord_avatar', 'display_name', 'created_at', 'updated_at', 'last_login_at', 'is_admin'].map((col) => (
                        <tr key={col}>
                          <td className="pr-8 py-0.5">{col}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-text-muted text-sm mt-3">
                  Note: No <code className="bg-surface-sunken px-1.5 py-0.5 rounded">email</code> column present.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default PrivacyDocs;
