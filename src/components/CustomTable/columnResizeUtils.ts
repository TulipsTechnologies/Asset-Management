/**
 * Shared policy for how narrow a column may be, on drag-resize and on load.
 *
 * A data column's floor is its own header content: the header title text plus
 * the sort icon and the cell's padding, measured from the DOM (see
 * `measureHeaderMinWidth`). That way a column can never be dragged narrower
 * than the words in its own header, whatever those words are — short headers
 * are free to shrink, long ones stop before they break. When the header cannot
 * be measured (server render, detached node, empty header) callers fall back to
 * DEFAULT_MIN_COLUMN_WIDTH.
 *
 * The narrow structural columns (checkbox / SN / actions and friends, see
 * STRUCTURAL_COLUMN_KEYS) are exempt and keep the legacy rule — they floor at
 * their own defined width, capped at DEFAULT_MIN_COLUMN_WIDTH — so they stay
 * exactly as designed. An explicit `col.minWidth` always wins over both rules.
 * Nothing about this is stored in the database.
 */

/** Fallback floor for a data column whose header could not be measured. */
export const DEFAULT_MIN_COLUMN_WIDTH = 200;

/**
 * Rescue floor used when reading widths back from storage, and the absolute
 * lower bound for a measured header floor: a genuinely collapsed column is
 * pulled back to something usable without ever widening a deliberately narrow
 * structural column.
 */
export const ABSOLUTE_MIN_COLUMN_WIDTH = 40;

/**
 * Separation held between the header title and the sort icon once a column is
 * squeezed down to its floor. Mirrors the `gap-x-2` the header markup uses.
 */
export const HEADER_CONTENT_GAP = 8;

/**
 * Breathing room added past the measured content so the last glyph never ends
 * up underneath the 5px `.resize-handle` overlay sitting on the cell's edge.
 */
export const HEADER_CONTENT_BUFFER = 4;

/**
 * Marks the element wrapping a header cell's title and sort icon. Set on the
 * header markup in every table component; `measureHeaderMinWidth` falls back to
 * the cell's first element child when it is absent.
 */
export const HEADER_CONTENT_ATTRIBUTE = "data-column-header-content";

/**
 * Carries the column key on each `<th>`, so a whole header row can be measured
 * without threading refs through the markup. Matches the attribute
 * `readRenderedTableColumnWidths` in the common package already looks for.
 */
export const HEADER_COLUMN_KEY_ATTRIBUTE = "data-col-key";

/**
 * Columns exempt from the header-derived floor. Mirrors
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
  "completedtoggle",
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

function parsePx(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Smallest width at which a header cell's content still renders unbroken —
 * title text plus sort icon plus the cell's own padding and borders.
 *
 * The content is measured on a detached clone rather than in place. Reading the
 * live element cannot work: header title spans are sometimes stretched
 * (`w-full`), the cell is already clipped to whatever width the column
 * currently has, and `scrollWidth` does not reliably account for content
 * overflowing an `overflow: visible` box. Cloning sidesteps all of it, and
 * because the real nodes are copied it measures ReactNode labels and icon-font
 * sort glyphs correctly for free.
 *
 * @returns the floor in pixels, or null when there is nothing to measure — the
 *   caller should then fall back to DEFAULT_MIN_COLUMN_WIDTH.
 */
export function measureHeaderMinWidth(
  headerCell: HTMLElement | null | undefined
): number | null {
  if (!headerCell) return null;
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }
  if (!headerCell.isConnected) return null;

  const content =
    headerCell.querySelector<HTMLElement>(`[${HEADER_CONTENT_ATTRIBUTE}]`) ??
    (headerCell.firstElementChild as HTMLElement | null);
  if (!content) return null;

  const cellStyle = window.getComputedStyle(headerCell);
  const cellChrome =
    parsePx(cellStyle.paddingLeft) +
    parsePx(cellStyle.paddingRight) +
    parsePx(cellStyle.borderLeftWidth) +
    parsePx(cellStyle.borderRightWidth);

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:-9999px;top:0;width:max-content;white-space:nowrap;visibility:hidden;pointer-events:none;";
  // The clone leaves the table, so the font it would have inherited has to
  // travel with it — otherwise medium-weight headers measure short.
  if (cellStyle.font) host.style.font = cellStyle.font;
  host.style.letterSpacing = cellStyle.letterSpacing;

  const clone = content.cloneNode(true) as HTMLElement;
  clone.style.width = "max-content";
  clone.style.maxWidth = "none";
  // In place the sort icon is pushed to the far edge by `justify-between`, so
  // the free space between it and the title is not part of the content. Pack
  // the clone tightly and reinstate that separation as an explicit gap.
  clone.style.justifyContent = "flex-start";
  clone.style.columnGap = `${HEADER_CONTENT_GAP}px`;

  // Header markup varies across the table variants: some title spans carry
  // `flex-1`, `min-w-0`, `truncate` or `w-full`, all of which let a cell shrink
  // or clip its own text. Those are display concessions, not the content's
  // natural size, so neutralise them on the clone — otherwise the floor would
  // track the current column width and the column could never be narrowed again.
  clone.querySelectorAll<HTMLElement>("*").forEach((node) => {
    node.style.flex = "0 0 auto";
    node.style.width = "auto";
    node.style.minWidth = "auto";
    node.style.maxWidth = "none";
    node.style.overflow = "visible";
    node.style.textOverflow = "clip";
  });

  host.appendChild(clone);
  document.body.appendChild(host);
  const measured = clone.getBoundingClientRect().width;
  document.body.removeChild(host);

  if (!Number.isFinite(measured) || measured <= 0) return null;

  return Math.max(
    ABSOLUTE_MIN_COLUMN_WIDTH,
    Math.ceil(measured + cellChrome) + HEADER_CONTENT_BUFFER
  );
}

/**
 * Smallest width a column may be dragged to.
 *
 * Data columns (any key not in STRUCTURAL_COLUMN_KEYS) floor at their measured
 * header content width, or at DEFAULT_MIN_COLUMN_WIDTH when no measurement was
 * taken. Structural columns floor at their own design width (capped at
 * DEFAULT_MIN_COLUMN_WIDTH), so they can be grown but not shrunk.
 *
 * @param designWidth The column's defined width. For the CustomTable family
 *   this is the code-defined width from `initialColumns`; for DynamicTable,
 *   whose columns come from the API, it is the column's current width.
 * @param explicitMin Optional per-column override from `col.minWidth`.
 * @param columnKey The column's key/name. Omitting it keeps the legacy
 *   design-width rule (only for call sites that predate this parameter).
 * @param measuredHeaderWidth Header floor from `measureHeaderMinWidth`,
 *   resolved once at the start of a drag. Omitting it keeps the legacy
 *   DEFAULT_MIN_COLUMN_WIDTH floor.
 */
export function getColumnMinWidth(
  designWidth: number | null | undefined,
  explicitMin?: number | null,
  columnKey?: string | null,
  measuredHeaderWidth?: number | null
): number {
  if (explicitMin != null && Number.isFinite(explicitMin)) {
    return Math.max(1, Math.round(explicitMin));
  }
  if (columnKey != null && !isStructuralColumnKey(columnKey)) {
    if (measuredHeaderWidth != null && Number.isFinite(measuredHeaderWidth)) {
      return Math.max(
        ABSOLUTE_MIN_COLUMN_WIDTH,
        Math.round(measuredHeaderWidth)
      );
    }
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
  columnKey?: string | null,
  measuredHeaderWidth?: number | null
): number {
  const min = getColumnMinWidth(
    designWidth,
    explicitMin,
    columnKey,
    measuredHeaderWidth
  );
  if (width == null || !Number.isFinite(width)) return min;
  return Math.max(min, Math.round(width));
}

/**
 * Clamp a width read back from storage. Storage is read before the table is on
 * screen, so no header can be measured yet — only the absolute floor applies
 * here, and `applyHeaderMinWidths` corrects anything too narrow once the header
 * row has rendered.
 */
export function clampStoredColumnWidth(
  width: number | null | undefined,
  fallbackWidth?: number | null,
  columnKey?: string | null,
  explicitMin?: number | null
): number {
  // An explicit `col.minWidth` is a hard contract rather than a policy default,
  // so it still applies before anything has rendered.
  const floor =
    explicitMin != null && Number.isFinite(explicitMin)
      ? Math.max(ABSOLUTE_MIN_COLUMN_WIDTH, Math.round(explicitMin))
      : ABSOLUTE_MIN_COLUMN_WIDTH;
  const candidate =
    width != null && Number.isFinite(width) ? width : fallbackWidth;
  if (candidate == null || !Number.isFinite(candidate)) {
    return floor;
  }
  return Math.max(floor, Math.round(candidate));
}

/**
 * Widen any column currently narrower than its own header content, measured
 * from the rendered header row. Run from a layout effect after the columns
 * change: widths restored from storage predate this rule, and a header long
 * enough to break at its saved width has to be rescued.
 *
 * Only ever grows a column, and returns null when every column already fits, so
 * the follow-up pass it triggers is a no-op and it cannot loop.
 *
 * @param tableEl The rendered `<table>` (or any ancestor of the header row).
 * @param columns The current column list.
 * @param keyOf Reads a column's key — `col.key` or `col.name` by component.
 * @param explicitMinOf Optional reader for a per-column `minWidth` override.
 */
export function applyHeaderMinWidths<T extends { width: number | null }>(
  tableEl: HTMLElement | null | undefined,
  columns: readonly T[],
  keyOf: (col: T) => string | null | undefined,
  explicitMinOf?: (col: T) => number | null | undefined
): T[] | null {
  if (!tableEl || columns.length === 0) return null;

  // One query for the whole header row: column keys come from the API in some
  // tables, so looking each one up by attribute selector would mean escaping
  // arbitrary strings.
  const headerCells = new Map<string, HTMLElement>();
  tableEl
    .querySelectorAll<HTMLElement>(`thead th[${HEADER_COLUMN_KEY_ATTRIBUTE}]`)
    .forEach((cell) => {
      const key = cell.getAttribute(HEADER_COLUMN_KEY_ATTRIBUTE);
      if (key && !headerCells.has(key)) headerCells.set(key, cell);
    });
  if (headerCells.size === 0) return null;

  let changed = false;
  const next = columns.map((col) => {
    const key = keyOf(col);
    if (!key || isStructuralColumnKey(key)) return col;

    const measured = measureHeaderMinWidth(headerCells.get(key));
    if (measured == null) return col;

    const min = getColumnMinWidth(
      col.width,
      explicitMinOf?.(col),
      key,
      measured
    );
    if (col.width != null && Number.isFinite(col.width) && col.width >= min) {
      return col;
    }

    changed = true;
    return { ...col, width: min };
  });

  return changed ? next : null;
}
