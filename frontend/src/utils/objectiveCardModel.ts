/**
 * The Objectives card's rows (S2a-5a·C2a, R-M-3, O-3, C-1).
 *
 * `objectiveGoalStore` is unkeyed, so the list can belong to another static; each row carries its
 * `staticGroupId`, and only this static's rows pass. Not Doing is hidden, as on V1's Home. Order is
 * Required, Preferred, Optional, then an unknown priority; the API's `created_at` order holds within
 * each (a stable sort over a copy, so the store's list is never reordered).
 */
import { OBJECTIVE_CATEGORY_OPTIONS } from '../data/goalObjectiveCategories';
import type { StaticObjectiveGoal } from '../stores/objectiveGoalStore';

export interface ObjectiveCardRow {
  id: string;
  title: string;
  description: string | null;
  /** "{category label} · {priority label}" */
  meta: string;
}

// Arrays searched with `.find`, never plain-object lookups: `constructor` and `toString` are keys there.
const PRIORITIES: { value: string; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'preferred', label: 'Preferred' },
  { value: 'optional', label: 'Optional' },
];

function priorityRank(priority: string): number {
  const rank = PRIORITIES.findIndex((p) => p.value === priority);
  return rank === -1 ? PRIORITIES.length : rank;
}

function categoryLabel(category: string): string {
  return OBJECTIVE_CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}

function priorityLabel(priority: string): string {
  return PRIORITIES.find((p) => p.value === priority)?.label ?? priority.replace(/_/g, ' ');
}

export function objectiveCardRows(objectives: StaticObjectiveGoal[], groupId: string): ObjectiveCardRow[] {
  return objectives
    .filter((o) => o.staticGroupId === groupId && o.priority !== 'not_doing')
    .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    .map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description?.trim() ? o.description : null,
      meta: `${categoryLabel(o.category)} · ${priorityLabel(o.priority)}`,
    }));
}
