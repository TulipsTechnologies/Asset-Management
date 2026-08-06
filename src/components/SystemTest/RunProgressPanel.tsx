'use client';

import { useEffect, useRef, useState } from 'react';
import {
  isRunTerminal,
  RUN_STATUS_BADGE,
  RUN_STATUS_LABELS,
} from '@/enum/systemTestEnums';
import { ISystemTestRun } from '@/interface/ISystemTest';
import { fetchSystemTestRun } from '@/services/systemTest.service';

/**
 * Live view of a run: polls GET /runs/{id} until the status is terminal (§12.1 — the
 * work executes synchronously inside the POST, but progress rows are written through a
 * separate DbContext, so this poll sees them mid-run). Percent comes from the step
 * counters; the current step label is the orchestrator's own words.
 */
export default function RunProgressPanel({
  runId,
  onTerminal,
  pollMs = 1500,
}: {
  runId: string;
  /** Called once, with the full run (items included), when polling sees a terminal status. */
  onTerminal?: (run: ISystemTestRun) => void;
  pollMs?: number;
}) {
  const [run, setRun] = useState<ISystemTestRun | null>(null);
  const doneRef = useRef(false);
  const onTerminalRef = useRef(onTerminal);
  onTerminalRef.current = onTerminal;

  useEffect(() => {
    doneRef.current = false;
    setRun(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const res = await fetchSystemTestRun(runId);
        if (cancelled) return;
        if (res?.success && res.data) {
          setRun(res.data);
          if (isRunTerminal(res.data.status)) {
            if (!doneRef.current) {
              doneRef.current = true;
              onTerminalRef.current?.(res.data);
            }
            return; // terminal — stop polling
          }
        }
      } catch {
        // A missed poll is not a failed run — keep going until a terminal status lands.
      }
      if (!cancelled) timer = setTimeout(poll, pollMs);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, pollMs]);

  const total = run?.totalSteps ?? 0;
  const completed = run?.completedSteps ?? 0;
  const percent =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const running = run != null && !isRunTerminal(run.status);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-secondaryColor">
          {running || run == null ? 'Run in progress' : 'Run finished'}
        </h3>
        {run && (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[run.status]}`}
          >
            {RUN_STATUS_LABELS[run.status]}
          </span>
        )}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            run && run.failedCount > 0 ? 'bg-red-500' : 'bg-primarycolor'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span className="min-w-0 truncate">
          {run == null
            ? 'Waiting for the first progress write…'
            : run.currentStep
              ? run.currentStep
              : running
                ? 'Working…'
                : 'Completed'}
        </span>
        <span className="shrink-0">
          {total > 0 ? `${completed} of ${total} steps · ${percent}%` : '…'}
        </span>
      </div>

      {run && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs">
          <span className="text-green-700">Passed: {run.passedCount}</span>
          <span className="text-amber-700">Warnings: {run.warningCount}</span>
          <span className="text-red-700">Failed: {run.failedCount}</span>
        </div>
      )}
    </div>
  );
}
