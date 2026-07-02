/* eslint-disable design-system/no-raw-button */
/**
 * PluginPage — the static's "Plugin" tab. Dedicated home for Dalamud plugin
 * setup (install steps + API keys), moved out of Gear & Sync so the plugin has
 * its own URL (`?tab=plugin`) and isn't buried under a sync dashboard.
 */
import { Download, Search, KeyRound, Gamepad2 } from 'lucide-react';
import { ApiKeyManager } from '../settings/ApiKeyManager';

const INSTALL_STEPS = [
  {
    icon: Download,
    title: 'Install the Dalamud launcher',
    desc: 'XIVLauncher with Dalamud is required. If you already use Dalamud plugins in FFXIV, you can skip this step.',
  },
  {
    icon: Search,
    title: 'Find XIVRaidPlanner in the plugin list',
    desc: 'Open the Dalamud Plugin Installer in-game (/xlplugins), search for "XIVRaidPlanner", and install it.',
  },
  {
    icon: KeyRound,
    title: 'Generate an API key',
    desc: 'Create a key below. It authenticates the plugin to your account — keep it private.',
  },
  {
    icon: Gamepad2,
    title: 'Connect in FFXIV',
    desc: 'Open the plugin window in-game, paste your API key, and select your static to start syncing.',
  },
] as const;

export function PluginPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
      {/* Installation steps */}
      <div className="space-y-5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-[0.14em]">Installation steps</p>
        {INSTALL_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex gap-3.5">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: 'rgba(20,184,166,0.1)',
                    boxShadow: '0 0 0 1px rgba(20,184,166,0.18)',
                  }}
                >
                  <Icon size={13} className="text-accent" />
                </div>
                {i < INSTALL_STEPS.length - 1 && (
                  <div
                    className="w-px flex-1 mt-1.5"
                    style={{ background: 'linear-gradient(180deg, rgba(20,184,166,0.25) 0%, rgba(20,184,166,0.04) 100%)', minHeight: 16 }}
                  />
                )}
              </div>
              <div className="pb-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className="text-xs font-bold text-accent/60 uppercase tracking-widest flex-shrink-0"
                    style={{ letterSpacing: '0.14em' }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold text-text-primary leading-snug">{step.title}</p>
                </div>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* API keys */}
      <div>
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-[0.14em] mb-4">
          Your API keys
        </p>
        <div
          className="rounded-lg border border-border-subtle p-4"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <ApiKeyManager />
        </div>
      </div>
    </div>
  );
}
