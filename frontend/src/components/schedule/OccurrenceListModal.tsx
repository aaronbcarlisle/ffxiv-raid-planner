import { useEffect, useState, useCallback } from 'react';
import { CalendarDays, XCircle, RefreshCw, RotateCcw } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../primitives';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useModal } from '../../hooks/useModal';
import { useScheduleStore } from '../../stores/scheduleStore';
import { toast } from '../../stores/toastStore';
import type { OccurrenceResponse, ScheduleException, ScheduleSession } from '../../types';
import { getOccurrenceDateKey, getOccurrenceDateKeysForMatching } from '../../utils/recurrence';

interface OccurrenceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: ScheduleSession;
  groupId: string;
  canManage: boolean;
}

function formatOccurrenceDate(isoDate: string, startTime: string, tz: string): string {
  try {
    const dt = new Date(startTime);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
      timeZoneName: 'short',
    }).format(dt);
  } catch {
    return isoDate;
  }
}

function getDurationMinutes(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function OccurrenceListModal({
  isOpen,
  onClose,
  session,
  groupId,
  canManage,
}: OccurrenceListModalProps) {
  const { fetchOccurrences, fetchExceptions, createException, deleteException } = useScheduleStore();

  const [occurrences, setOccurrences] = useState<OccurrenceResponse[]>([]);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const cancelModal = useModal();
  const restoreModal = useModal();

  const load = useCallback(async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const [occs, excs] = await Promise.all([
        fetchOccurrences(groupId, session.id, 20),
        fetchExceptions(groupId, session.id),
      ]);
      setOccurrences(occs);
      setExceptions(excs);
    } catch {
      toast.error('Failed to load occurrences');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, groupId, session.id, fetchOccurrences, fetchExceptions]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async () => {
    if (!pendingDate) return;
    try {
      await createException(groupId, session.id, {
        occurrenceDate: pendingDate,
        type: 'cancelled',
      });
      toast.success('Occurrence cancelled');
      await load();
    } catch {
      toast.error('Failed to cancel occurrence');
    } finally {
      cancelModal.close();
      setPendingDate(null);
    }
  };

  const handleRestore = async () => {
    if (!pendingDate) return;
    try {
      await deleteException(groupId, session.id, pendingDate);
      toast.success('Occurrence restored');
      await load();
    } catch {
      toast.error('Failed to restore occurrence');
    } finally {
      restoreModal.close();
      setPendingDate(null);
    }
  };

  const openCancel = (date: string) => {
    setPendingDate(date);
    cancelModal.open();
  };

  const openRestore = (date: string) => {
    setPendingDate(date);
    restoreModal.open();
  };

  // All cancelled occurrences (including ones not in upcoming window).
  // Keys are local-timezone dates (YYYY-MM-DD), matching the key used when creating exceptions.
  const cancelledDates = new Set(
    exceptions.filter((e) => e.type === 'cancelled').map((e) => e.occurrenceDate)
  );

  // Local-timezone date key for an occurrence — independent of the backend's occurrenceDate field.
  const occKey = (occ: OccurrenceResponse) => getOccurrenceDateKey(occ.startTime, session.timezone);

  // Combine: upcoming (non-cancelled) + cancelled occurrences from exceptions list.
  // Check both local-date key and legacy UTC-date key so old exceptions still match.
  const cancelledOnlyExceptions = exceptions.filter(
    (e) => e.type === 'cancelled' && !occurrences.find((o) =>
      getOccurrenceDateKeysForMatching(o.startTime, session.timezone).includes(e.occurrenceDate)
    )
  );

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={
          <span className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-accent" />
            Upcoming Occurrences
          </span>
        }
        size="lg"
        footer={
          <div className="flex justify-between items-center">
            <Button variant="secondary" size="sm" onClick={load} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </div>
        }
      >
        <div className="space-y-2">
          {isLoading && (
            <div className="text-center text-text-muted text-sm py-6">Loading…</div>
          )}

          {!isLoading && occurrences.length === 0 && cancelledOnlyExceptions.length === 0 && (
            <div className="text-center text-text-muted text-sm py-6">
              No upcoming occurrences in the next 4 weeks.
            </div>
          )}

          {/* Upcoming (non-cancelled) occurrences */}
          {occurrences.map((occ) => {
            const duration = getDurationMinutes(occ.startTime, occ.endTime);
            const localKey = occKey(occ);
            // Check both new local-date key and legacy UTC-date key for backward compat.
            const isCancelled = getOccurrenceDateKeysForMatching(occ.startTime, session.timezone).some(k => cancelledDates.has(k));
            const isEdited = occ.isException && !isCancelled;

            return (
              <div
                key={localKey}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 gap-2 ${
                  isCancelled
                    ? 'border-border-subtle bg-surface-muted/20 opacity-60'
                    : 'border-border-default bg-surface-raised'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${isCancelled ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                      {occ.title}
                    </span>
                    {isEdited && (
                      <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-medium">
                        EDITED
                      </span>
                    )}
                    {isCancelled && (
                      <span className="text-[10px] bg-red-400/20 text-red-300 px-1.5 py-0.5 rounded font-medium">
                        CANCELLED
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    {formatOccurrenceDate(occ.occurrenceDate, occ.startTime, session.timezone)}
                    <span className="text-text-muted ml-2">({formatDuration(duration)})</span>
                  </div>
                </div>

                {canManage && (
                  <div className="flex gap-1 flex-shrink-0">
                    {isCancelled ? (
                      <Button variant="secondary" size="sm" onClick={() => openRestore(localKey)}>
                        <RotateCcw className="w-3 h-3 mr-1" />
                        Restore
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => openCancel(localKey)}>
                        <XCircle className="w-3 h-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Cancelled occurrences not in the upcoming window */}
          {cancelledOnlyExceptions.length > 0 && (
            <>
              <p className="text-xs text-text-muted pt-2 pb-1">Previously cancelled (outside window)</p>
              {cancelledOnlyExceptions.map((exc) => (
                <div
                  key={exc.occurrenceDate}
                  className="flex items-center justify-between rounded-lg border border-border-subtle bg-surface-muted/20 opacity-60 px-3 py-2.5 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-muted line-through">
                        {exc.occurrenceDate}
                      </span>
                      <span className="text-[10px] bg-red-400/20 text-red-300 px-1.5 py-0.5 rounded font-medium">
                        CANCELLED
                      </span>
                    </div>
                    {exc.cancellationReason && (
                      <p className="text-xs text-text-muted mt-0.5 italic">{exc.cancellationReason}</p>
                    )}
                  </div>
                  {canManage && (
                    <Button variant="secondary" size="sm" onClick={() => openRestore(exc.occurrenceDate)}>
                      <RotateCcw className="w-3 h-3 mr-1" />
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        isOpen={cancelModal.isOpen}
        title="Cancel Occurrence"
        message={`Cancel the occurrence on ${pendingDate ?? ''}? Members will no longer see it in the upcoming schedule.`}
        confirmLabel="Cancel Occurrence"
        variant="danger"
        onConfirm={handleCancel}
        onCancel={() => { cancelModal.close(); setPendingDate(null); }}
      />

      <ConfirmModal
        isOpen={restoreModal.isOpen}
        title="Restore Occurrence"
        message={`Restore the occurrence on ${pendingDate ?? ''} back to the schedule?`}
        confirmLabel="Restore"
        variant="default"
        onConfirm={handleRestore}
        onCancel={() => { restoreModal.close(); setPendingDate(null); }}
      />
    </>
  );
}
