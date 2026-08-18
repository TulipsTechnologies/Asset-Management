/**
 * Shared policy for how narrow a column may be, on drag-resize and on load.
 *
 * Data columns have a hard floor of DEFAULT_MIN_COLUMN_WIDTH: they cannot be
 * dragged below it, and widths read back from storage are raised to it. The
 * narrow structural columns (checkbox / SN / actions and friends, see
 * STRUCTURAL_COLUMN_KEYS) keep the legacy rule instead — they floor at their
 * own defined width, capped at DEFAULT_MIN_COLUMN_WIDTH — so they stay exactly
 * as designed. An explicit `col.minWidth` always wins over both rules.
 * Nothing about this is stored in the database.
 */

/** Hard floor for a normal data column. */
export const DEFAULT_MIN_COLUMN_WIDTH = 200;

/**
 * Rescue floor for structural columns when reading widths back from storage:
 * a genuinely collapsed column is pulled back to something usable without
 * ever widening a deliberately narrow structural column.
 */
export const ABSOLUTE_MIN_COLUMN_WIDTH = 40;

/**
 * Columns exempt from the DEFAULT_MIN_COLUMN_WIDTH floor. Mirrors
 * columnManageUtils.isExcludedStructuralColumn — kept local so this file
 * stays dependency-free and byte-identical across the module repos.
 */
const STRUCTURAL_COLUMN_KEYS = new Set([
  "check",
  "checkbox",
  "selectall",
  "extraactions",
  "actions",
  "actionmenu",
  "sn",
  "drag",
  "drag_handle",
]);

/** True for checkbox / SN / actions-style columns that keep their designed width. */
export function isStructuralColumnKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const normalized = key.trim().toLowerCase();
  return normalized.length > 0 && STRUCTURAL_COLUMN_KEYS.has(normalized);
}

/**
 * Smallest width a column may be dragged to.
 *
 * Data columns (any key not in STRUCTURAL_COLUMN_KEYS) floor at
 * DEFAULT_MIN_COLUMN_WIDTH regardless of how narrow they were defined or
 * previously saved. Structural columns floor at their own design width
 * (capped at DEFAULT_MIN_COLUMN_WIDTH), so they can be grown but not shrunk.
 *
 * @param designWidth The column's defined width. For the CustomTable family
 *   this is the code-defined width from `initialColumns`; for DynamicTable,
 *   whose columns come from the API, it is the column's current width.
 * @param explicitMin Optional per-column override from `col.minWidth`.
 * @param columnKey The column's key/name. Omitting it keeps the legacy
 *   design-width rule (only for call sites that predate this parameter).
 */
export function getColumnMinWidth(
  designWidth: number | null | undefined,
  explicitMin?: number | null,
  columnKey?: string | null
): number {
  if (explicitMin != null && Number.isFinite(explicitMin)) {
    return Math.max(1, Math.round(explicitMin));
  }
  if (columnKey != null && !isStructuralColumnKey(columnKey)) {
    return DEFAULT_MIN_COLUMN_WIDTH;
  }
  if (!designWidth || !Number.isFinite(designWidth) || designWidth <= 0) {
    return DEFAULT_MIN_COLUMN_WIDTH;
  }
  return Math.min(Math.round(designWidth), DEFAULT_MIN_COLUMN_WIDTH);
}

/** Clamp a width to the column's drag floor. */
export function clampColumnWidth(
  width: number | null | undefined,
  designWidth: number | null | undefined,
  explicitMin?: number | null,
  columnKey?: string | null
): number {
  const min = getColumnMinWidth(designWidth, explicitMin, columnKey);
  if (width == null || !Number.isFinite(width)) return min;
  return Math.max(min, Math.round(width));
}

/**
 * Clamp a width read back from storage. Data columns are raised to
 * DEFAULT_MIN_COLUMN_WIDTH so layouts saved by older builds recover without
 * a data migration; structural columns use only the absolute floor so they
 * are never widened on load.
 */
export function clampStoredColumnWidth(
  width: number | null | undefined,
  fallbackWidth?: number | null,
  columnKey?: string | null
): number {
  const floor =
    columnKey != null && !isStructuralColumnKey(columnKey)
      ? DEFAULT_MIN_COLUMN_WIDTH
      : ABSOLUTE_MIN_COLUMN_WIDTH;
  const candidate =
    width != null && Number.isFinite(width) ? width : fallbackWidth;
  if (candidate == null || !Number.isFinite(candidate)) {
    return floor;
  }
  return Math.max(floor, Math.round(candidate));
}
