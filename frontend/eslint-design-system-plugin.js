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
  },
};
