'use client';

import { ICountSheetGroup } from '@/utils/printDocuments';

/**
 * Physical Verification Count Sheet.
 *
 * The one document in this module whose purpose is to leave the building EMPTY and come back
 * FILLED IN. Everything else here is a record of something that already happened; this is a
 * working instrument someone carries around a floor with a pen.
 *
 * That drives every decision on it:
 *  - it is grouped by the location the register EXPECTS each asset in, and ordered by code
 *    inside each group, so the counter walks the building rather than the database;
 *  - four columns are printed EMPTY and ruled, because a sheet you cannot write on is a
 *    printout, not a count sheet;
 *  - it carries a blank continuation block for items found that are NOT on the sheet, which
 *    is precisely what a floor count exists to catch;
 *  - it is landscape, because ten columns in portrait leaves no room to write.
 *
 * The caller is responsible for handing it the WHOLE scope. A count sheet listing one page of
 * twenty-five tells a counter the floor is finished when it is not.
 */

interface ICountRow {
  id: string;
  assetCode?: string | null;
  assetName?: string | null;
  expectedSerialNumber?: string | null;
  expectedCustodianName?: string | null;
  expectedConditionName?: string | null;
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return '—';
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const CountSheet = ({
  companyName,
  generatedBy,
  generatedOn,
  campaignName,
  campaignReference,
  scopeSummary,
  groups,
  totalRows,
}: {
  companyName: string;
  generatedBy: string;
  generatedOn: Date;
  campaignName: string;
  campaignReference?: string | null;
  scopeSummary?: string | null;
  groups: ICountSheetGroup<ICountRow>[];
  /** The campaign's own expected count — printed so the counter can see the sheet is whole. */
  totalRows: number;
}) => (
  <>
    <header className="print-header">
      <div>
        <h1 className="print-company">{companyName || 'Company not set'}</h1>
        <p className="print-title">Physical Verification — Count Sheet</p>
      </div>
      <div className="print-meta">
        <div>
          <strong>{campaignName}</strong>
        </div>
        {campaignReference && <div style={{ fontSize: '6.5pt' }}>{campaignReference}</div>}
        <div>Printed {formatDate(generatedOn)}</div>
        <div>{totalRows.toLocaleString()} items in scope</div>
      </div>
    </header>

    {scopeSummary && (
      <p className="print-note" style={{ marginTop: 0 }}>
        Scope: {scopeSummary}
      </p>
    )}

    <p className="print-terms" style={{ marginTop: '4pt' }}>
      Walk each location in turn. For every line, tick <span className="print-tick" /> found or{' '}
      <span className="print-tick" /> not found, and write what you actually see — condition,
      and the location or custodian if it differs from the expected column. Anything you find
      that is not listed goes in the block at the end.
    </p>

    {groups.map((group) => (
      <section key={group.locationName} className="print-block">
        <h2 className="print-section-title">
          {group.locationName} — {group.rows.length} item
          {group.rows.length === 1 ? '' : 's'}
        </h2>
        <table className="print-table print-table--form">
          <thead>
            <tr>
              <th style={{ width: '4%' }}>#</th>
              <th style={{ width: '12%' }}>Asset code</th>
              <th style={{ width: '20%' }}>Description</th>
              <th style={{ width: '12%' }}>Expected serial</th>
              <th style={{ width: '12%' }}>Expected custodian</th>
              <th style={{ width: '9%' }}>Expected condition</th>
              <th style={{ width: '7%' }}>Found?</th>
              <th style={{ width: '10%' }}>Condition seen</th>
              <th style={{ width: '14%' }}>Actual location / custodian</th>
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, position) => (
              <tr key={row.id}>
                <td className="right">{position + 1}</td>
                <td>{row.assetCode || '—'}</td>
                <td>{row.assetName || '—'}</td>
                <td>{row.expectedSerialNumber || '—'}</td>
                <td>{row.expectedCustodianName || '—'}</td>
                <td>{row.expectedConditionName || '—'}</td>
                {/* The four columns below are the whole point: printed empty, ruled, for a pen. */}
                <td>
                  <span className="print-tick" /> Y <span className="print-tick" /> N
                </td>
                <td />
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    ))}

    <section className="print-block">
      <h2 className="print-section-title">
        Items found that are NOT on this sheet — record and report
      </h2>
      <table className="print-table print-table--form">
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Asset code / tag seen</th>
            <th style={{ width: '28%' }}>Description</th>
            <th style={{ width: '18%' }}>Serial</th>
            <th style={{ width: '18%' }}>Where found</th>
            <th style={{ width: '18%' }}>Condition</th>
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3, 4, 5].map((slot) => (
            <tr key={slot}>
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <div className="print-signatures">
      {['Counted by', 'Witnessed by'].map((role) => (
        <div key={role} className="print-signature">
          <div className="print-signature-line" />
          <p className="print-signature-role">{role}</p>
          <p className="print-signature-meta">Name ______________________</p>
          <p className="print-signature-meta">Date ____ / ____ / ________</p>
        </div>
      ))}
    </div>

    <footer className="print-footer">
      {companyName || 'Company not set'} · {campaignName} · {totalRows.toLocaleString()} items
      · printed {formatDate(generatedOn)} by {generatedBy || '—'} · results must be entered in
      the system; this sheet is the working record
    </footer>
  </>
);

export default CountSheet;
