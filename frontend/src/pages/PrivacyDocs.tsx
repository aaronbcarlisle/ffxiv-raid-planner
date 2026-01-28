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
];

function DataTable() {
  const data = [
    { field: 'Discord ID', collected: true, purpose: 'Unique identifier for your account' },
    { field: 'Discord Username', collected: true, purpose: 'Display name in the app' },
    { field: 'Discord Avatar', collected: true, purpose: 'Profile picture' },
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
            Transparency about how we handle your data
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
                Here's exactly what data we collect and why:
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
                    'Passwords (we don\'t have any - Discord handles auth)',
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
                We use Discord as an identity provider - similar to "Login with Google" on other sites.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mb-3">How it works</h3>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6 mb-6">
                <ol className="space-y-4">
                  {[
                    { step: 'You click "Login with Discord"', detail: 'We redirect you to Discord\'s authorization page' },
                    { step: 'Discord asks for permission', detail: 'You see exactly what we\'re requesting (username and avatar only)' },
                    { step: 'You approve', detail: 'Discord sends us a one-time code' },
                    { step: 'We exchange the code', detail: 'We get a temporary token to fetch your basic profile' },
                    { step: 'Token is discarded', detail: 'The Discord token is used once, then thrown away' },
                    { step: 'You\'re logged in', detail: 'We create our own session tokens stored in secure cookies' },
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
                We request the <strong>minimum required scope</strong> from Discord:
              </p>
              <CodeBlock code="scope=identify" language="bash" title="OAuth scope" />
              <p className="text-text-secondary mt-4">
                This grants access to your Discord user ID, username, and avatar. Nothing else.
              </p>

              <h3 className="text-lg font-semibold text-text-primary mt-6 mb-3">Revoking Access</h3>
              <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                <p className="text-text-secondary mb-4">You can revoke our access anytime:</p>
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
                    <li>Contact us to delete your account entirely</li>
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

            {/* Verification */}
            <section className="mb-12">
              <h2 className="text-2xl font-bold text-text-primary mb-6">Verify Scope</h2>

              <div className="space-y-4">
                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h3 className="font-semibold text-text-primary mb-2">Check OAuth Scope</h3>
                  <p className="text-text-secondary text-sm mb-3">
                    Log out, then click "Login with Discord". Check the URL - it should contain{' '}
                    <code className="bg-surface-sunken px-1.5 py-0.5 rounded">scope=identify</code> (no email).
                  </p>
                </div>

                <div className="bg-surface-card border border-border-subtle rounded-xl p-6">
                  <h3 className="font-semibold text-text-primary mb-2">Check API Response</h3>
                  <p className="text-text-secondary text-sm">
                    Open browser DevTools → Network tab. Find the <code className="bg-surface-sunken px-1.5 py-0.5 rounded">/api/auth/me</code> request.
                    The response should NOT contain an "email" field.
                  </p>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

export default PrivacyDocs;
