/**
 * CodeBlock - Syntax-highlighted code block component for documentation
 *
 * Uses prism-react-renderer for syntax highlighting with a custom dark theme
 * that matches the application's design system.
 */

import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Copy, Check } from 'lucide-react';

// Custom theme based on the app's dark color palette
const customTheme = {
  ...themes.nightOwl,
  plain: {
    color: '#d4d4d8', // text-primary equivalent
    backgroundColor: '#18181b', // surface-elevated equivalent
  },
  styles: [
    ...themes.nightOwl.styles,
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: { color: '#6b7280', fontStyle: 'italic' as const },
    },
    {
      types: ['punctuation'],
      style: { color: '#a1a1aa' },
    },
    {
      types: ['property', 'tag', 'boolean', 'number', 'constant', 'symbol'],
      style: { color: '#f59e0b' }, // amber
    },
    {
      types: ['selector', 'attr-name', 'string', 'char', 'builtin'],
      style: { color: '#34d399' }, // emerald
    },
    {
      types: ['operator', 'entity', 'url'],
      style: { color: '#14b8a6' }, // teal/accent
    },
    {
      types: ['atrule', 'attr-value', 'keyword'],
      style: { color: '#a78bfa' }, // violet
    },
    {
      types: ['function', 'class-name'],
      style: { color: '#60a5fa' }, // blue
    },
    {
      types: ['regex', 'important', 'variable'],
      style: { color: '#fb7185' }, // rose
    },
  ],
};

export type CodeLanguage = 'python' | 'bash' | 'json' | 'typescript' | 'javascript' | 'tsx' | 'jsx';

interface CodeBlockProps {
  code: string;
  language?: CodeLanguage;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = 'python',
  title,
  showLineNumbers = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Map language aliases
  const prismLanguage = language === 'bash' ? 'bash' : language;

  return (
    <div className="mb-4 group relative">
      {title && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-text-muted">{title}</span>
          <span className="text-[10px] font-mono uppercase text-accent/70">
            {language}
          </span>
        </div>
      )}
      <div className="relative">
        <Highlight theme={customTheme} code={code.trim()} language={prismLanguage}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={`${className} rounded-lg p-4 overflow-x-auto border border-border-subtle`}
              style={style}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {showLineNumbers && (
                    <span className="inline-block w-8 text-right mr-4 text-text-muted/50 select-none">
                      {i + 1}
                    </span>
                  )}
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded bg-surface-card/80 border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-interactive"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check className="w-4 h-4 text-status-success" />
          ) : (
            <Copy className="w-4 h-4 text-text-muted" />
          )}
        </button>
      </div>
    </div>
  );
}

interface DualCodeBlockProps {
  python: string;
  curl: string;
  title?: string;
}

/**
 * DualCodeBlock - Shows Python and curl examples with tabs
 */
export function DualCodeBlock({ python, curl, title }: DualCodeBlockProps) {
  const [activeTab, setActiveTab] = useState<'python' | 'curl'>('python');

  return (
    <div className="mb-6">
      {title && <div className="text-xs text-text-muted mb-2">{title}</div>}
      <div className="bg-surface-card border border-border-subtle rounded-lg overflow-hidden">
        <div className="flex border-b border-border-subtle">
          <button
            onClick={() => setActiveTab('python')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'python'
                ? 'bg-surface-elevated text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Python
          </button>
          <button
            onClick={() => setActiveTab('curl')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'curl'
                ? 'bg-surface-elevated text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            curl
          </button>
        </div>
        <div className="p-0">
          {activeTab === 'python' ? (
            <CodeBlock code={python} language="python" />
          ) : (
            <CodeBlock code={curl} language="bash" />
          )}
        </div>
      </div>
    </div>
  );
}
