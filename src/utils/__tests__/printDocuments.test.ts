import { describe, expect, it } from 'vitest';
import {
  buildIssueReceiptLines,
  documentRef,
  groupForCountSheet,
  returnDocumentKind,
  UNLOCATED_GROUP,
} from '../printDocuments';

/**
 * The two decisions on a printed document that can actually be wrong.
 *
 * Everything else about a sheet is markup — if it is ugly you can see that. These two are
 * invisible when wrong: a receipt that lists an item the employee never received, and a count
 * sheet ordered so a counter cannot walk it.
 */

/** Mirrors BulkAssignOutcomeEnum.Assigned; the enum's other members must never reach paper. */
const ASSIGNED = 1;
const BLOCKED = 2;
const ALREADY_ASSIGNED = 3;

const asset = (id: string, code: string, serial?: string | null) => ({
  id,
  assetCode: code,
  assetName: `Asset ${code}`,
  assetCategoryName: 'Furniture',
  serialNumber: serial ?? null,
  assetTag: null,
  conditionName: 'Good',
});

describe('issue receipt lines', () => {
  it('lists every asset that was actually assigned', () => {
    const basket = [asset('a', 'AST-1'), asset('b', 'AST-2')];
    const outcomes = [
      { assetId: 'a', outcome: ASSIGNED },
      { assetId: 'b', outcome: ASSIGNED },
    ];

    const lines = buildIssueReceiptLines(basket, outcomes, ASSIGNED);

    expect(lines.map((l) => l.assetCode)).toEqual(['AST-1', 'AST-2']);
  });

  it('drops rows the server refused, so nobody signs for what they did not receive', () => {
    const basket = [asset('a', 'AST-1'), asset('b', 'AST-2'), asset('c', 'AST-3')];
    const outcomes = [
      { assetId: 'a', outcome: ASSIGNED },
      { assetId: 'b', outcome: BLOCKED },
      { assetId: 'c', outcome: ALREADY_ASSIGNED },
    ];

    const lines = buildIssueReceiptLines(basket, outcomes, ASSIGNED);

    // A partial batch is the normal case, not the edge case.
    expect(lines).toHaveLength(1);
    expect(lines[0].assetCode).toBe('AST-1');
  });

  it('returns nothing when the whole batch was refused', () => {
    const basket = [asset('a', 'AST-1')];
    const outcomes = [{ assetId: 'a', outcome: BLOCKED }];

    // The caller uses this to decide the print button does not render at all — a receipt
    // for zero items is a signable document listing nothing.
    expect(buildIssueReceiptLines(basket, outcomes, ASSIGNED)).toEqual([]);
  });

  it('ignores an outcome for an asset that is not in the basket', () => {
    const lines = buildIssueReceiptLines(
      [asset('a', 'AST-1')],
      [
        { assetId: 'a', outcome: ASSIGNED },
        { assetId: 'ghost', outcome: ASSIGNED },
      ],
      ASSIGNED
    );

    expect(lines).toHaveLength(1);
  });

  it('carries the serial through, and leaves it null rather than inventing one', () => {
    const lines = buildIssueReceiptLines(
      [asset('a', 'AST-1', 'SN-9988'), asset('b', 'AST-2', null)],
      [
        { assetId: 'a', outcome: ASSIGNED },
        { assetId: 'b', outcome: ASSIGNED },
      ],
      ASSIGNED
    );

    expect(lines[0].serialNumber).toBe('SN-9988');
    expect(lines[1].serialNumber).toBeNull();
  });
});

describe('count sheet walk order', () => {
  const row = (code: string, location: string | null) => ({
    assetCode: code,
    expectedAssetLocationName: location,
  });

  it('groups by expected location and orders codes numerically inside each', () => {
    // Arrives in the server's order — newest activity first, locations interleaved.
    const groups = groupForCountSheet([
      row('AST-10', 'Reception'),
      row('AST-2', 'Reception'),
      row('AST-3', 'Admin Office'),
    ]);

    expect(groups.map((g) => g.locationName)).toEqual(['Admin Office', 'Reception']);
    // AST-2 before AST-10: a plain string sort would put AST-10 first.
    expect(groups[1].rows.map((r) => r.assetCode)).toEqual(['AST-2', 'AST-10']);
  });

  it('puts unlocated assets in their own group, last', () => {
    const groups = groupForCountSheet([
      row('AST-1', null),
      row('AST-2', 'Reception'),
      row('AST-3', '   '),
    ]);

    expect(groups[groups.length - 1].locationName).toBe(UNLOCATED_GROUP);
    // Blank-but-present is the same thing as absent for a counter walking a building.
    expect(groups[groups.length - 1].rows).toHaveLength(2);
  });

  it('handles an empty campaign without inventing a group', () => {
    expect(groupForCountSheet([])).toEqual([]);
  });

  it('does not mutate the caller’s array', () => {
    const rows = [row('AST-9', 'Reception'), row('AST-1', 'Reception')];
    groupForCountSheet(rows);

    expect(rows.map((r) => r.assetCode)).toEqual(['AST-9', 'AST-1']);
  });
});

describe('return document kind', () => {
  it('is a RECEIPT before inspection, and says liability is still open', () => {
    const kind = returnDocumentKind(null, 0);

    expect(kind.title).toBe('Asset Return Receipt');
    expect(kind.showPendingCaveat).toBe(true);
    // The trap: an uninspected return must never claim to have cleared anything.
    expect(kind.showClearedStatement).toBe(false);
  });

  it('is a CLEARANCE CERTIFICATE once inspected, and drops the caveat', () => {
    const kind = returnDocumentKind('2026-08-16', 0);

    expect(kind.title).toBe('Asset Return & Clearance Certificate');
    expect(kind.showPendingCaveat).toBe(false);
    expect(kind.showClearedStatement).toBe(true);
  });

  it('never claims "cleared" while a recovery case is open', () => {
    const kind = returnDocumentKind('2026-08-16', 1);

    expect(kind.showRecovery).toBe(true);
    // A clearance certificate that hides a live claim is false on its face.
    expect(kind.showClearedStatement).toBe(false);
  });

  it('discloses recovery even on an uninspected return', () => {
    const kind = returnDocumentKind(null, 2);

    expect(kind.showRecovery).toBe(true);
    expect(kind.showClearedStatement).toBe(false);
  });
});

describe('document reference', () => {
  it('is readable aloud and traceable back to the record', () => {
    expect(documentRef('ISS', 'a3f8e2c1-1111-2222-3333-444455556666', '2026-08-16')).toBe(
      'ISS-20260816-A3F8E2'
    );
  });

  it('degrades rather than printing the word undefined', () => {
    expect(documentRef('ISS', null, null)).toBe('ISS');
    expect(documentRef('ISS', 'a3f8e2c1', 'not a date')).toBe('ISS-A3F8E2');
  });
});
