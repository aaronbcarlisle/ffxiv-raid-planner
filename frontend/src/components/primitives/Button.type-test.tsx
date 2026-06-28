/**
 * Type-level tests for Button's compile-time guarantees. This file is never
 * imported at runtime; `tsc -b` (pnpm build) type-checks it. Each
 * `@ts-expect-error` MUST error — if the guarantee regresses, the unused
 * directive makes the build fail.
 *
 * Variables are exported so `noUnusedLocals` doesn't suppress errors; the
 * `@ts-expect-error` directive itself is intentional and allowed.
 */
import { createElement } from 'react';
import { Button, type ButtonVariant } from './Button';

// Exhaustiveness: a Record over the variant union must list every member.
// Omitting one is a compile error (proving the Record enforces exhaustiveness).
// Exported so noUnusedLocals doesn't mask the @ts-expect-error with a second error.
// @ts-expect-error - 'link' (and others) intentionally omitted -> missing keys
export const _incompleteVariantMap: Record<ButtonVariant, string> = {
  primary: '', secondary: '', ghost: '', danger: '', warning: '', success: '', 'accent-subtle': '',
};

// A non-lexicon trailing value is a type error (decorative arrows unrepresentable).
// @ts-expect-error - 'arrow' is not in the 'chevron' | 'external' lexicon
export const _badTrailing = createElement(Button, { trailing: 'arrow' }, 'x');
// `rightIcon` no longer exists on Button.
// @ts-expect-error - rightIcon was removed in favor of the constrained `trailing`
export const _noRightIcon = createElement(Button, { rightIcon: null }, 'x');
// A Button with no visible label is a type error (use IconButton for icon-only).
// @ts-expect-error - children is required
export const _noLabel = createElement(Button, { leftIcon: null });
