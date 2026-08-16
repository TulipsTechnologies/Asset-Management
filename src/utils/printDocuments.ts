/**
 * Pure helpers behind the printed documents.
 *
 * Everything here is deliberately free of React and the DOM so it can be tested in the
 * project's node test environment. The sheets themselves are markup; the decisions that can
 * actually be WRONG — which rows reach a signed page, what order a counter walks in — live
 * here where a test can hold them.
 */

/**
 * A human-readable document reference.
 *
 * Every identifier in this module is a GUID, and a receipt whose reference is
 * `a3f8e2c1-…` cannot be read back over a phone or written on a whiteboard. This derives a
 * short one from the id the record already has, so paper and system reconcile without a
 * backend change: prefix + issue date + the first six hex digits.
 *
 * STOPGAP, deliberately: a real per-tenant document sequence belongs in the backend. The
 * full GUID is printed beneath this in small type so the two can always be matched up.
 */
export const documentRef = (
  prefix: string,
  id: string | null | undefined,
  date: string | Date | null | undefined
): string => {
  const stamp = (() => {
    if (!date) return '';
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}${String(parsed.getMonth() + 1).padStart(2, '0')}${String(
      parsed.getDate()
    ).padStart(2, '0')}`;
  })();
  const tail = (id ?? '').replace(/-/g, '').slice(0, 6).toUpperCase();
  return [prefix, stamp, tail].filter(Boolean).join('-');
};

/* ------------------------------------------------------------------ issue receipt */

/** One line on a handover receipt — an item the custodian is signing for. */
export interface IReceiptLine {
  assetId: string;
  assetCode: string;
  assetName: string;
  assetCategoryName?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  conditionName?: string | null;
  accessories?: string | null;
}

interface IOutcomeLike {
  assetId: string;
  /** BulkAssignOutcomeEnum — only the Assigned member may reach paper. */
  outcome: number;
}

interface IAssignableLike {
  id: string;
  assetCode: string;
  assetName: string;
  assetCategoryName?: string | null;
  serialNumber?: string | null;
  assetTag?: string | null;
  conditionName?: string | null;
}

/**
 * The lines of a receipt for a bulk handover, joined from the basket the operator chose and
 * the per-asset outcomes the server returned.
 *
 * ONLY successfully-assigned rows survive. A bulk assign partially succeeds all the time —
 * an asset gets blocked, is already assigned, or is not found — and printing a blocked row
 * would have an employee sign for something they never received. That is the single failure
 * this function exists to prevent.
 */
export const buildIssueReceiptLines = (
  basket: IAssignableLike[],
  outcomes: IOutcomeLike[],
  assignedOutcome: number
): IReceiptLine[] => {
  const assigned = new Set(
    outcomes.filter((o) => o.outcome === assignedOutcome).map((o) => o.assetId)
  );
  return basket
    .filter((asset) => assigned.has(asset.id))
    .map((asset) => ({
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.assetName,
      assetCategoryName: asset.assetCategoryName,
      serialNumber: asset.serialNumber,
      assetTag: asset.assetTag,
      conditionName: asset.conditionName,
    }));
};

/* --------------------------------------------------------- return receipt / clearance */

export interface IReturnDocumentKind {
  title: string;
  /** True only before inspection — the sheet must then disclaim that liability is open. */
  showPendingCaveat: boolean;
  /** True when a recovery case exists — the sheet must say this is NOT a full discharge. */
  showRecovery: boolean;
  /** True only when inspected AND nothing is owed. The one place "cleared" may be claimed. */
  showClearedStatement: boolean;
}

/**
 * Which of the two return documents this record produces, and what it must disclose.
 *
 * This is the highest-consequence decision in the printed set, so it lives here where a test
 * can hold it rather than inside JSX. Two ways to get it wrong, both silent:
 *
 *  - Calling an UNINSPECTED return a "clearance certificate" tells an employee their
 *    liability is discharged when the asset has not even been looked at. Someone waves it at
 *    HR during separation and the company loses its claim on a damaged laptop.
 *  - Printing "no recovery has been raised" while a recovery case is open makes the document
 *    false on its face — which is worse than not printing one at all.
 */
export const returnDocumentKind = (
  inspectedOn: string | null | undefined,
  recoveryCaseCount: number
): IReturnDocumentKind => {
  const inspected = !!inspectedOn;
  const hasRecovery = recoveryCaseCount > 0;
  return {
    title: inspected ? 'Asset Return & Clearance Certificate' : 'Asset Return Receipt',
    showPendingCaveat: !inspected,
    showRecovery: hasRecovery,
    // Never on an uninspected return, and never while anything is owed.
    showClearedStatement: inspected && !hasRecovery,
  };
};

/* ------------------------------------------------------------- verification count sheet */

interface ICountRowLike {
  /** Where the register says the asset should be; null for assets with no location. */
  expectedAssetLocationName?: string | null;
  assetCode?: string | null;
}

export interface ICountSheetGroup<T> {
  locationName: string;
  rows: T[];
}

/** The bucket unlocated assets fall into, sorted last so the walk ends with the strays. */
export const UNLOCATED_GROUP = 'No location recorded';

/**
 * Walk order for a count sheet: grouped by the location the register EXPECTS the asset in,
 * then by asset code inside each group.
 *
 * The server cannot produce this order — it sorts by `VerifiedOn ?? CreatedOn` descending
 * (newest activity first) and cannot order by a navigation property's name at all. That order
 * sends a counter zig-zagging across a building. Grouping happens here instead.
 *
 * Codes sort with numeric awareness so `AST-2` precedes `AST-10` even where the register
 * does not zero-pad.
 */
export const groupForCountSheet = <T extends ICountRowLike>(
  rows: T[]
): ICountSheetGroup<T>[] => {
  const byLocation = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = row.expectedAssetLocationName?.trim() || UNLOCATED_GROUP;
    const bucket = byLocation.get(key);
    if (bucket) bucket.push(row);
    else byLocation.set(key, [row]);
  });

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  return [...byLocation.entries()]
    .map(([locationName, groupRows]) => ({
      locationName,
      rows: [...groupRows].sort((a, b) =>
        collator.compare(a.assetCode ?? '', b.assetCode ?? '')
      ),
    }))
    .sort((a, b) => {
      // The strays go last: a counter works the rooms, then deals with what has no room.
      if (a.locationName === UNLOCATED_GROUP) return 1;
      if (b.locationName === UNLOCATED_GROUP) return -1;
      return collator.compare(a.locationName, b.locationName);
    });
};
