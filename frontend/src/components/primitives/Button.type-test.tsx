/**
 * Type-level tests for Button's compile-time guarantees. This file is never
 * imported at runtime; `tsc -b` (pnpm build) type-checks it. Each
 * `@ts-expect-error` MUST error — if the guarantee regresses, the unused
 * directive makes the build fail.
 *
 * eslint-disable is fine here: these are deliberately ill-typed snippets.
 */
import type { ButtonVariant } from './Button';

// Exhaustiveness: a Record over the variant union must list every member.
// Omitting one is a compile error (proving the Record enforces exhaustiveness).
// Exported so noUnusedLocals doesn't mask the @ts-expect-error with a second error.
// @ts-expect-error - 'link' (and others) intentionally omitted -> missing keys
export const _incompleteVariantMap: Record<ButtonVariant, string> = {
  primary: '', secondary: '', ghost: '', danger: '', warning: '', success: '', 'accent-subtle': '',
};
