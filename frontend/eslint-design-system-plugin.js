/**
 * Custom ESLint plugin to enforce design system compliance
 *
 * This prevents raw HTML elements from being used in favor of
 * design system components.
 */

/**
 * Check if a JSX element has a design-system-ignore comment before it.
 * Handles both JavaScript comments and JSX expression comments.
 */
function hasIgnoreComment(node, context) {
  const sourceCode = context.sourceCode;

  // Check for JavaScript comments before the node
  const comments = sourceCode.getCommentsBefore(node);
  if (comments.some(comment => comment.value.includes('design-system-ignore'))) {
    return true;
  }

  // Check for JSX comments by examining the source text on preceding lines
  // JSX comments look like: {/* design-system-ignore: reason */}
  const nodeStart = node.range[0];
  const textBefore = sourceCode.text.slice(Math.max(0, nodeStart - 200), nodeStart);

  // Look for the ignore directive in the preceding text (within a few lines)
  // This handles both {/* comment */} and // comment styles
  if (textBefore.includes('design-system-ignore')) {
    // Make sure it's on a preceding line, not earlier in the file
    const lines = textBefore.split('\n');
    // Check the last few lines (the comment should be close to the element)
    const recentLines = lines.slice(-3).join('\n');
    if (recentLines.includes('design-system-ignore')) {
      return true;
    }
  }

  return false;
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
