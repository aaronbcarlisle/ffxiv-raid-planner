/**
 * CodeBlock - Syntax-highlighted code block component for documentation
 *
 * Uses prism-react-renderer for syntax highlighting with a custom dark theme
 * that matches the application's design system.
 */

import { useState } from 'react';
import { Highlight, themes } from 'prism-react-renderer';
import { Copy, Check, Terminal } from 'lucide-react';
import { Tooltip } from '../primitives/Tooltip';

// Import Prism core and language grammars for syntax highlighting
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';

// Language icons (using simple SVG paths for Python and C#)
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

// Custom theme based on the app's dark color palette
const customTheme = {
  ...themes.nightOwl,
  plain: {
    color: '#d4d4d8', // text-primary equivalent
    backgroundColor: 'rgba(6, 6, 8, 1)', // Deep black background with slight blue tint
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

export type CodeLanguage = 'python' | 'bash' | 'json' | 'typescript' | 'javascript' | 'tsx' | 'jsx' | 'csharp' | 'css';

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

  // Map language aliases for Prism
  // All languages are passed through directly; imported grammars handle them
  const prismLanguage = language;

  return (
    <div className="mb-4 group relative">
      {title && (
        <div className="flex items-center mb-1">
          <span className="text-xs text-text-muted">{title}</span>
        </div>
      )}
      <div className="relative">
        <Highlight theme={customTheme} code={code.trim()} language={prismLanguage} prism={Prism}>
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
        {/* Language label - always visible in bottom-right */}
        <span className="absolute bottom-2 right-2 text-[10px] font-mono uppercase text-text-muted/70 select-none">
          {language}
        </span>
        <Tooltip content="Copy to clipboard">
          {/* design-system-ignore: copy button uses custom positioning and opacity */}
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-1.5 rounded bg-surface-card/80 border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity hover:bg-surface-interactive"
          >
            {copied ? (
              <Check className="w-4 h-4 text-status-success" />
            ) : (
              <Copy className="w-4 h-4 text-text-muted" />
            )}
          </button>
        </Tooltip>
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
        {/* design-system-ignore: tab buttons use custom tab styling */}
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

interface TripleCodeBlockProps {
  python: string;
  curl: string;
  csharp: string;
  title?: string;
}

/**
 * TripleCodeBlock - Shows Python, C#, and curl examples with tabs
 */
export function TripleCodeBlock({ python, curl, csharp, title }: TripleCodeBlockProps) {
  const [activeTab, setActiveTab] = useState<'python' | 'csharp' | 'curl'>('python');

  return (
    <div className="mb-6">
      {title && <div className="text-xs text-text-muted mb-2">{title}</div>}
      <div className="bg-surface-card border border-border-subtle rounded-lg overflow-hidden">
        {/* design-system-ignore: tab buttons use custom tab styling */}
        <div className="flex border-b border-border-subtle">
          <button
            onClick={() => setActiveTab('python')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'python'
                ? 'bg-surface-elevated text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <PythonIcon className="w-4 h-4" />
            Python
          </button>
          <button
            onClick={() => setActiveTab('csharp')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'csharp'
                ? 'bg-surface-elevated text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <CSharpIcon className="w-4 h-4" />
            C#
          </button>
          <button
            onClick={() => setActiveTab('curl')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'curl'
                ? 'bg-surface-elevated text-accent border-b-2 border-accent -mb-px'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Terminal className="w-4 h-4" />
            curl
          </button>
        </div>
        <div className="p-0">
          {activeTab === 'python' ? (
            <CodeBlock code={python} language="python" />
          ) : activeTab === 'csharp' ? (
            <CodeBlock code={csharp} language="csharp" />
          ) : (
            <CodeBlock code={curl} language="bash" />
          )}
        </div>
      </div>
    </div>
  );
}
