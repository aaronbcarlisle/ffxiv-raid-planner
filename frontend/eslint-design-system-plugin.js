/**
 * Custom ESLint plugin to enforce design system compliance
 *
 * This prevents raw HTML elements from being used in favor of
 * design system components.
 */

/**
 * Check if a JSX element has a design-system-ignore comment before it.
 * Handles both JavaScript comments and JSX expression comments.
 *
 * The comment must appear within 5 lines of the element to be recognized.
 * Supported formats:
 *   - JSX: {/* design-system-ignore: reason *​/}
 *   - JS:  // design-system-ignore: reason
 *   - JS:  /* design-system-ignore: reason *​/
 */
function hasIgnoreComment(node, context) {
  const sourceCode = context.sourceCode;

  // Check for JavaScript comments before the node (handles // and /* */ outside JSX)
  const comments = sourceCode.getCommentsBefore(node);
  if (comments.some(comment => comment.value.includes('design-system-ignore'))) {
    return true;
  }

  // Check for JSX comments by examining the source text on preceding lines
  // JSX comments look like: {/* design-system-ignore: reason */}
  // We look back up to 500 chars to handle cases with blank lines or longer comments
  const nodeStart = node.range[0];
  const lookbackChars = 500;
  const textBefore = sourceCode.text.slice(Math.max(0, nodeStart - lookbackChars), nodeStart);

  // Quick check: if directive not in lookback range at all, skip detailed analysis
  if (!textBefore.includes('design-system-ignore')) {
    return false;
  }

  // Split into lines and check the last 5 lines (allowing for blank lines between comment and element)
  const lines = textBefore.split('\n');
  const recentLines = lines.slice(-5).join('\n');

  // Match the directive within a comment context to reduce false positives
  // This matches: {/* ... design-system-ignore ... */} or // ... design-system-ignore ...
  const commentPattern = /(?:\/\*[\s\S]*?design-system-ignore[\s\S]*?\*\/|\/\/.*design-system-ignore)/;
  return commentPattern.test(recentLines);
}

/** Static class strings from a className JSXAttribute (string literal + template quasis). */
function getClassNameStrings(attr) {
  const v = attr.value;
  if (!v) return [];
  if (v.type === 'Literal' && typeof v.value === 'string') return [v.value];
  if (v.type === 'JSXExpressionContainer') {
    const e = v.expression;
    if (e.type === 'Literal' && typeof e.value === 'string') return [e.value];
    if (e.type === 'TemplateLiteral') return e.quasis.map(q => (q.value.cooked ?? q.value.raw) || '');
  }
  return [];
}

function findAttr(node, name) {
  return node.attributes.find(a => a.type === 'JSXAttribute' && a.name && a.name.name === name);
}

function elementName(node) {
  return node.name && node.name.type === 'JSXIdentifier' ? node.name.name : null;
}

const NONINTERACTIVE_TAGS = new Set(['div', 'span', 'p', 'li']);
const STYLE_COLOR_PROPS = new Set([
  'color', 'background', 'backgroundColor', 'backgroundImage',
  'borderColor', 'border', 'boxShadow', 'fill', 'stroke', 'outlineColor',
]);

export default {
  rules: {
    'no-raw-button': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw <button> elements, use Button or IconButton instead',
          category: 'Design System',
        },
        messages: {
          rawButton: 'Use <Button> or <IconButton> instead of raw <button>. See docs/UI_COMPONENTS.md',
        },
        fixable: null,
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'button') {
              if (!hasIgnoreComment(node, context)) {
                context.report({
                  node,
                  messageId: 'rawButton',
                });
              }
            }
          },
        };
      },
    },
    'no-raw-input': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw <input> elements, use Input/Checkbox/NumberInput instead',
          category: 'Design System',
        },
        messages: {
          rawInput: 'Use <Input>, <Checkbox>, or <NumberInput> instead of raw <input>. See docs/UI_COMPONENTS.md',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'input') {
              if (!hasIgnoreComment(node, context)) {
                context.report({
                  node,
                  messageId: 'rawInput',
                });
              }
            }
          },
        };
      },
    },
    'no-raw-select': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw <select> elements, use Select or SearchableSelect instead',
          category: 'Design System',
        },
        messages: {
          rawSelect: 'Use <Select> or <SearchableSelect> instead of raw <select>. See docs/UI_COMPONENTS.md',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'select') {
              if (!hasIgnoreComment(node, context)) {
                context.report({
                  node,
                  messageId: 'rawSelect',
                });
              }
            }
          },
        };
      },
    },
    'no-raw-label': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw <label> elements, use Label component instead',
          category: 'Design System',
        },
        messages: {
          rawLabel: 'Use <Label> instead of raw <label>. See docs/UI_COMPONENTS.md',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'label') {
              if (!hasIgnoreComment(node, context)) {
                context.report({
                  node,
                  messageId: 'rawLabel',
                });
              }
            }
          },
        };
      },
    },
    'no-raw-textarea': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow raw <textarea> elements, use TextArea component instead',
          category: 'Design System',
        },
        messages: {
          rawTextarea: 'Use <TextArea> instead of raw <textarea>. See docs/UI_COMPONENTS.md',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'textarea') {
              if (!hasIgnoreComment(node, context)) {
                context.report({
                  node,
                  messageId: 'rawTextarea',
                });
              }
            }
          },
        };
      },
    },
    // ── Color: no arbitrary hex/rgb in className or inline style (use tokens) ──
    'no-arbitrary-color': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow hardcoded hex/rgb colors; use semantic theme tokens', category: 'Design System' },
        messages: {
          arbitraryColor: 'Hardcoded color — use a semantic token (text-accent, var(--color-*), or color-mix). See DESIGN_SYSTEM_SUMMARY.md.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (!node.name) return;
            const name = node.name.name;
            if (name === 'className') {
              for (const s of getClassNameStrings(node)) {
                if (/-\[(?:#[0-9a-fA-F]{3,8}|rgba?\()/.test(s)) {
                  if (!hasIgnoreComment(node, context)) context.report({ node, messageId: 'arbitraryColor' });
                  break;
                }
              }
            } else if (name === 'style') {
              const v = node.value;
              if (v && v.type === 'JSXExpressionContainer' && v.expression.type === 'ObjectExpression') {
                for (const prop of v.expression.properties) {
                  if (prop.type !== 'Property' || !prop.key) continue;
                  const key = prop.key.name ?? prop.key.value;
                  if (!STYLE_COLOR_PROPS.has(key)) continue;
                  if (prop.value.type === 'Literal' && typeof prop.value.value === 'string'
                    && /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(prop.value.value)) {
                    if (!hasIgnoreComment(node, context)) context.report({ node, messageId: 'arbitraryColor' });
                    break;
                  }
                }
              }
            }
          },
        };
      },
    },
    // ── Typography: no sub-12px arbitrary text sizes (floor is text-xs) ──
    'no-tiny-text': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow arbitrary text sizes below the readable floor (text-xs / 12px)', category: 'Design System' },
        messages: {
          tinyText: 'Text size {{size}}px is below the readable floor — use text-xs (12px). Badge counts may use text-[9px]. See DESIGN_SYSTEM_SUMMARY.md.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXAttribute(node) {
            if (!node.name || node.name.name !== 'className') return;
            for (const s of getClassNameStrings(node)) {
              const m = s.match(/text-\[(\d+(?:\.\d+)?)px\]/);
              if (m && parseFloat(m[1]) < 12) {
                if (!hasIgnoreComment(node, context)) context.report({ node, messageId: 'tinyText', data: { size: m[1] } });
                break;
              }
            }
          },
        };
      },
    },
    // ── Interaction semantics: a clickable bare element must declare a role ──
    'no-noninteractive-onclick': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow onClick/onKeyDown on bare div/span/p without a role (use Button/LinkText/NavRow or add role)', category: 'Design System' },
        messages: {
          noninteractiveHandler: 'Interactive <{{tag}}> needs a role (or use Button/LinkText/NavRow). Appearance must match behavior. See docs/audits/enforcement.md.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            const tag = elementName(node);
            if (!NONINTERACTIVE_TAGS.has(tag)) return;
            const hasHandler = findAttr(node, 'onClick') || findAttr(node, 'onKeyDown');
            if (hasHandler && !findAttr(node, 'role') && !hasIgnoreComment(node, context)) {
              context.report({ node, messageId: 'noninteractiveHandler', data: { tag } });
            }
          },
        };
      },
    },
    // ── cursor-pointer implies interactivity: require a role on bare elements ──
    'no-cursor-pointer-without-role': {
      meta: {
        type: 'suggestion',
        docs: { description: 'Disallow cursor-pointer on bare div/span/p without an interactive role', category: 'Design System' },
        messages: {
          cursorPointer: 'cursor-pointer on a non-interactive <{{tag}}> — add a role or use an interactive primitive. See docs/audits/enforcement.md.',
        },
        schema: [],
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            const tag = elementName(node);
            if (!NONINTERACTIVE_TAGS.has(tag)) return;
            if (findAttr(node, 'role')) return;
            const classAttr = findAttr(node, 'className');
            if (!classAttr) return;
            if (getClassNameStrings(classAttr).some(s => /\bcursor-pointer\b/.test(s)) && !hasIgnoreComment(node, context)) {
              context.report({ node, messageId: 'cursorPointer', data: { tag } });
            }
          },
        };
      },
    },
  },
};
