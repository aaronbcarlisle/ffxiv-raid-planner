/**
 * Custom ESLint plugin to enforce design system compliance
 *
 * This prevents raw HTML elements from being used in favor of
 * design system components.
 */

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
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'button') {
              // Check for design-system-ignore comment
              const sourceCode = context.getSourceCode();
              const comments = sourceCode.getCommentsBefore(node);
              const hasIgnore = comments.some(comment =>
                comment.value.includes('design-system-ignore')
              );

              if (!hasIgnore) {
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
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'input') {
              const sourceCode = context.getSourceCode();
              const comments = sourceCode.getCommentsBefore(node);
              const hasIgnore = comments.some(comment =>
                comment.value.includes('design-system-ignore')
              );

              if (!hasIgnore) {
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
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'select') {
              const sourceCode = context.getSourceCode();
              const comments = sourceCode.getCommentsBefore(node);
              const hasIgnore = comments.some(comment =>
                comment.value.includes('design-system-ignore')
              );

              if (!hasIgnore) {
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
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'label') {
              const sourceCode = context.getSourceCode();
              const comments = sourceCode.getCommentsBefore(node);
              const hasIgnore = comments.some(comment =>
                comment.value.includes('design-system-ignore')
              );

              if (!hasIgnore) {
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
      },
      create(context) {
        return {
          JSXOpeningElement(node) {
            if (node.name.name === 'textarea') {
              const sourceCode = context.getSourceCode();
              const comments = sourceCode.getCommentsBefore(node);
              const hasIgnore = comments.some(comment =>
                comment.value.includes('design-system-ignore')
              );

              if (!hasIgnore) {
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
