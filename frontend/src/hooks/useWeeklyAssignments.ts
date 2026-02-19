/**
 * Hook for managing weekly loot assignments
 *
 * Provides CRUD operations for pre-planned loot assignments in Manual Planning mode.
 */

import { useState, useCallback, useEffect } from 'react';
import { api, authRequest } from '../services/api';
import { logger } from '../lib/logger';
import type {
  WeeklyAssignment,
  WeeklyAssignmentCreate,
  WeeklyAssignmentUpdate,
  WeeklyAssignmentBulkCreate,
  WeeklyAssignmentBulkDelete,
  WeeklyAssignmentBulkItem,
} from '../types';

const log = logger.scope('WeeklyAssignments');

interface UseWeeklyAssignmentsOptions {
  groupId: string;
  tierId?: string;
  week?: number;
  floor?: string;
}

interface UseWeeklyAssignmentsResult {
  assignments: WeeklyAssignment[];
  isLoading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  create: (data: Omit<WeeklyAssignmentCreate, 'tierId' | 'week'> & { tierId?: string; week?: number }) => Promise<WeeklyAssignment | null>;
  update: (assignmentId: string, data: WeeklyAssignmentUpdate) => Promise<WeeklyAssignment | null>;
  remove: (assignmentId: string) => Promise<boolean>;
  bulkCreate: (assignments: WeeklyAssignmentCreate[]) => Promise<WeeklyAssignment[]>;
  bulkDelete: (options?: { floor?: string; slot?: string }) => Promise<boolean>;
  getAssignment: (floor: string, slot: string) => WeeklyAssignment | undefined;
}

export function useWeeklyAssignments({
  groupId,
  tierId,
  week,
  floor,
}: UseWeeklyAssignmentsOptions): UseWeeklyAssignmentsResult {
  const [assignments, setAssignments] = useState<WeeklyAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query string for filtering
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (tierId) params.append('tier_id', tierId);
    if (week !== undefined) params.append('week', String(week));
    if (floor) params.append('floor', floor);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [tierId, week, floor]);

  // Fetch assignments
  const fetch = useCallback(async () => {
    if (!groupId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.get<WeeklyAssignment[]>(
        `/api/static-groups/${groupId}/weekly-assignments${buildQueryString()}`
      );
      setAssignments(data);
      log.debug('Fetched assignments:', data.length);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch assignments';
      setError(message);
      log.error('Fetch error:', message);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, buildQueryString]);

  // Create single assignment
  const create = useCallback(
    async (
      data: Omit<WeeklyAssignmentCreate, 'tierId' | 'week'> & { tierId?: string; week?: number }
    ): Promise<WeeklyAssignment | null> => {
      setError(null);
      if (!groupId || (!tierId && !data.tierId) || (week === undefined && data.week === undefined)) {
        setError('Missing required tier or week');
        return null;
      }

      const createData: WeeklyAssignmentCreate = {
        tierId: data.tierId || tierId!,
        week: data.week ?? week!,
        floor: data.floor,
        slot: data.slot,
        playerId: data.playerId,
        sortOrder: data.sortOrder,
        didNotDrop: data.didNotDrop,
      };

      try {
        const result = await api.post<WeeklyAssignment>(
          `/api/static-groups/${groupId}/weekly-assignments`,
          createData
        );
        setAssignments((prev) => [...prev, result]);
        log.debug('Created assignment:', result.id);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create assignment';
        setError(message);
        log.error('Create error:', message);
        return null;
      }
    },
    [groupId, tierId, week]
  );

  // Update assignment
  const update = useCallback(
    async (assignmentId: string, data: WeeklyAssignmentUpdate): Promise<WeeklyAssignment | null> => {
      if (!groupId) return null;
      setError(null);

      try {
        const result = await api.put<WeeklyAssignment>(
          `/api/static-groups/${groupId}/weekly-assignments/${assignmentId}`,
          data
        );
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? result : a))
        );
        log.debug('Updated assignment:', assignmentId);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update assignment';
        setError(message);
        log.error('Update error:', message);
        return null;
      }
    },
    [groupId]
  );

  // Remove assignment
  const remove = useCallback(
    async (assignmentId: string): Promise<boolean> => {
      if (!groupId) return false;
      setError(null);

      try {
        await api.delete(`/api/static-groups/${groupId}/weekly-assignments/${assignmentId}`);
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        log.debug('Removed assignment:', assignmentId);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove assignment';
        setError(message);
        log.error('Remove error:', message);
        return false;
      }
    },
    [groupId]
  );

  // Bulk create assignments
  // Accepts items without tierId/week since those are provided by the wrapper
  const bulkCreate = useCallback(
    async (createAssignments: WeeklyAssignmentBulkItem[]): Promise<WeeklyAssignment[]> => {
      setError(null);
      if (!groupId || !tierId || week === undefined) {
        setError('Missing required tier or week');
        return [];
      }

      const bulkData: WeeklyAssignmentBulkCreate = {
        tierId,
        week,
        assignments: createAssignments,
      };

      try {
        const results = await api.post<WeeklyAssignment[]>(
          `/api/static-groups/${groupId}/weekly-assignments/bulk`,
          bulkData
        );
        setAssignments((prev) => [...prev, ...results]);
        log.debug('Bulk created assignments:', results.length);
        return results;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to bulk create assignments';
        setError(message);
        log.error('Bulk create error:', message);
        return [];
      }
    },
    [groupId, tierId, week]
  );

  // Bulk delete assignments
  const bulkDelete = useCallback(
    async (options?: { floor?: string; slot?: string }): Promise<boolean> => {
      setError(null);
      if (!groupId || !tierId || week === undefined) {
        setError('Missing required tier or week');
        return false;
      }

      const deleteData: WeeklyAssignmentBulkDelete = {
        tierId,
        week,
        floor: options?.floor,
        slot: options?.slot,
      };

      try {
        await authRequest(`/api/static-groups/${groupId}/weekly-assignments/bulk`, {
          method: 'DELETE',
          body: JSON.stringify(deleteData),
        });
        // Refetch to update state
        await fetch();
        log.debug('Bulk deleted assignments');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to bulk delete assignments';
        setError(message);
        log.error('Bulk delete error:', message);
        return false;
      }
    },
    [groupId, tierId, week, fetch]
  );

  // Helper to get assignment for a specific floor/slot
  const getAssignment = useCallback(
    (targetFloor: string, slot: string): WeeklyAssignment | undefined => {
      return assignments.find(
        (a) => a.floor === targetFloor && a.slot === slot
      );
    },
    [assignments]
  );

  // Auto-fetch when dependencies change
  useEffect(() => {
    if (groupId && tierId && week !== undefined) {
      fetch();
    }
  }, [groupId, tierId, week, floor, fetch]);

  return {
    assignments,
    isLoading,
    error,
    fetch,
    create,
    update,
    remove,
    bulkCreate,
    bulkDelete,
    getAssignment,
  };
}
