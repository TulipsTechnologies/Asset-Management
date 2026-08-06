/**
 * Running one action over a selection, and reporting honestly what happened to each.
 *
 * These masters refuse deletions that would break referential integrity — a category with
 * children or assets, a vendor still supplying something — and each refusal carries its own
 * sentence naming what stands in the way. A bulk action must therefore never report a single
 * verdict: the normal outcome is that some rows go and some do not, and the operator needs to
 * know WHICH and WHY, not just a count.
 *
 * Requests are issued one at a time on purpose. These are writes against rows that reference
 * each other (deleting a parent category and its child in the same sweep), and firing them
 * together makes the result depend on which lands first.
 */

export interface IBulkTarget {
  id: string;
  /** How this row is named back to the operator — a code, not a GUID. */
  label: string;
}

export interface IBulkOutcome extends IBulkTarget {
  ok: boolean;
  message?: string | null;
  reasonCode?: string | null;
}

export interface IBulkResult {
  outcomes: IBulkOutcome[];
  succeeded: IBulkOutcome[];
  refused: IBulkOutcome[];
}

type TActionResponse = {
  success?: boolean;
  message?: string | null;
  reasonCode?: string | null;
} | null | undefined;

export const runBulkAction = async (
  targets: IBulkTarget[],
  action: (id: string) => Promise<TActionResponse>
): Promise<IBulkResult> => {
  const outcomes: IBulkOutcome[] = [];

  for (const target of targets) {
    try {
      const response = await action(target.id);
      outcomes.push({
        ...target,
        ok: !!response?.success,
        message: response?.message ?? null,
        reasonCode: response?.reasonCode ?? null,
      });
    } catch {
      // A thrown request is a refusal like any other as far as the report is concerned —
      // what must not happen is the sweep stopping silently partway through.
      outcomes.push({
        ...target,
        ok: false,
        message: 'The request failed. Nothing was changed for this one.',
      });
    }
  }

  return {
    outcomes,
    succeeded: outcomes.filter((o) => o.ok),
    refused: outcomes.filter((o) => !o.ok),
  };
};

/** One line summarising a completed sweep, for a toast. */
export const summariseBulk = (result: IBulkResult, verb = 'deleted') => {
  const done = result.succeeded.length;
  const refused = result.refused.length;
  if (refused === 0) return `${done} ${verb}.`;
  if (done === 0) return `Nothing was ${verb} — ${refused} refused.`;
  return `${done} ${verb}, ${refused} refused.`;
};
