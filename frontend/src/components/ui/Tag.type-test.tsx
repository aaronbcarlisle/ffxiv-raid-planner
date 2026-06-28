/**
 * Type-level tests for Tag's and LinkText's compile-time guarantees. This file
 * is never imported at runtime; `tsc -b` (pnpm build) type-checks it. Each
 * `@ts-expect-error` MUST error — if the guarantee regresses, the unused
 * directive makes the build fail.
 *
 * Variables are exported so `noUnusedLocals` doesn't suppress errors; the
 * `@ts-expect-error` directive itself is intentional and allowed.
 */
import { createElement } from 'react';
import { Tag } from './Tag';
import { LinkText } from './LinkText';

// A label tag cannot be clickable.
// @ts-expect-error - onClick is `never` on variant="label", so () => void is not assignable
export const _labelClick = createElement(Tag, { variant: 'label', onClick: () => {}, children: 'x' });
// A nav tag must have a destination.
// @ts-expect-error - variant="nav" requires href or onNavigate; omitting both fails the union
export const _navNoDest = createElement(Tag, { variant: 'nav', children: 'x' });
// LinkText cannot receive both href and onClick simultaneously.
// @ts-expect-error - Destination union forbids href+onClick together (each branch marks the other as `never`)
export const _bothLink = createElement(LinkText, { href: '/x', onClick: () => {}, children: 'x' });
