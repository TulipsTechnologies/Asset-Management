'use client';

import { IReceiptLine, documentRef } from '@/utils/printDocuments';

/**
 * Asset Issue & Handover Receipt.
 *
 * This module can open a recovery case that charges a named employee money for a missing or
 * damaged asset. Until now nothing in it produced the piece of paper that makes such a claim
 * defensible: a signed acknowledgement that the person received specific items, in a stated
 * condition, on a date. That is what this document is — a control, not a formatted screen.
 *
 * Three things on it are load-bearing and should not be "tidied away":
 *  - the CONDITION AT ISSUE column, because without a stated baseline a later damage
 *    assessment has nothing to compare against and is unarguable;
 *  - the per-line INITIALS column, because a custodian who signs once at the bottom of a
 *    sixty-item list can later say they received fifty-eight of them;
 *  - the two COPIES, because a two-party acknowledgement is only worth anything if both
 *    parties hold one. The second copy is a page break, not decoration.
 */

const Field = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="print-field">
    <span className="print-field-label">{label}</span>
    <span className="print-field-value">{value || '—'}</span>
  </div>
);

const formatDate = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export interface IIssueReceiptProps {
  companyName: string;
  generatedBy: string;
  generatedOn: Date;
  /** The custodian accepting the items. */
  employeeName: string;
  employeeCode?: string | null;
  assignmentDate?: string | null;
  expectedReturnDate?: string | null;
  accessories?: string | null;
  handoverNotes?: string | null;
  /** Anchors the human-readable reference to a real record. */
  referenceId?: string | null;
  lines: IReceiptLine[];
}

const COPIES = ['Custodian copy', 'Office copy'] as const;

const UNDERTAKING = [
  'I have received the item(s) listed above in the condition stated, with the accessories noted.',
  'I will keep them in my custody, use them for company purposes, and take reasonable care of them.',
  'I will report loss, theft or damage on the day it occurs.',
  'I will not transfer, lend, modify or dispose of any item without written authorisation.',
  'I will return them by the date shown, on demand, or on separation — whichever is earliest.',
  'I understand that loss or damage beyond fair wear and tear may be recovered under company policy.',
];

const IssueReceiptSheet = ({
  companyName,
  generatedBy,
  generatedOn,
  employeeName,
  employeeCode,
  assignmentDate,
  expectedReturnDate,
  accessories,
  handoverNotes,
  referenceId,
  lines,
}: IIssueReceiptProps) => {
  const shortRef = documentRef('ISS', referenceId, assignmentDate ?? generatedOn);
  const issuedOn = formatDate(assignmentDate) ?? formatDate(generatedOn) ?? '—';
  const dueBack = formatDate(expectedReturnDate) ?? 'Open — until recalled';

  return (
    <>
      {COPIES.map((copy, index) => (
        <section key={copy} className={index > 0 ? 'print-break-before' : undefined}>
          <header className="print-header">
            <div>
              <h1 className="print-company">{companyName || 'Company not set'}</h1>
              <p className="print-title">Asset Issue &amp; Handover Receipt</p>
            </div>
            <div className="print-meta">
              <div>
                Ref <strong>{shortRef}</strong>
              </div>
              {referenceId && <div style={{ fontSize: '6.5pt' }}>{referenceId}</div>}
              <div>Issued {issuedOn}</div>
              <div className="print-chip">{copy}</div>
            </div>
          </header>

          <section className="print-block">
            <h2 className="print-section-title">Parties</h2>
            <div className="print-grid">
              <Field label="Issued to — custodian" value={employeeName} />
              <Field label="Employee code" value={employeeCode} />
              <Field label="Issued by" value={generatedBy} />
              <Field label="Return due" value={dueBack} />
            </div>
          </section>

          <table className="print-table print-table--form">
            <thead>
              <tr>
                <th>#</th>
                <th>Asset code</th>
                <th>Description</th>
                <th>Serial / Tag</th>
                <th>Condition at issue</th>
                <th>Custodian initials</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, position) => (
                <tr key={line.assetId}>
                  <td className="right">{position + 1}</td>
                  <td>{line.assetCode}</td>
                  <td>
                    {line.assetName}
                    {line.assetCategoryName && (
                      <span style={{ color: '#666' }}> · {line.assetCategoryName}</span>
                    )}
                  </td>
                  <td>
                    {line.serialNumber || line.assetTag || (
                      // Never a blank cell: an empty box on a signed form can be filled
                      // in by anyone afterwards.
                      <em style={{ color: '#777' }}>no serial recorded</em>
                    )}
                  </td>
                  <td>{line.conditionName || '—'}</td>
                  {/* Deliberately empty — the pen goes here. */}
                  <td />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Total items issued</td>
                <td className="right">{lines.length}</td>
              </tr>
            </tfoot>
          </table>

          {(accessories || handoverNotes) && (
            <section className="print-block">
              <h2 className="print-section-title">Accessories &amp; notes</h2>
              <div className="print-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <Field label="Accessories issued" value={accessories} />
                <Field label="Handover notes" value={handoverNotes} />
              </div>
            </section>
          )}

          <div className="print-terms">
            <h2 className="print-section-title">Custodian&apos;s undertaking</h2>
            <ol style={{ margin: '4pt 0 0 14pt', padding: 0 }}>
              {UNDERTAKING.map((clause) => (
                <li key={clause} style={{ marginBottom: '1.5pt' }}>
                  {clause}
                </li>
              ))}
            </ol>
          </div>

          <div className="print-signatures">
            {[
              ['Received by — custodian', employeeName],
              ['Issued by — asset custodian', generatedBy],
            ].map(([role, name]) => (
              <div key={role} className="print-signature">
                <div className="print-signature-line" />
                <p className="print-signature-role">{role}</p>
                <p className="print-signature-name">{name || ' '}</p>
                <p className="print-signature-meta">Date ____ / ____ / ________</p>
              </div>
            ))}
          </div>

          <footer className="print-footer">
            {companyName || 'Company not set'} · Ref {shortRef} · generated{' '}
            {formatDate(generatedOn)} by {generatedBy || '—'} · system copy — retain the
            signed original
          </footer>
        </section>
      ))}
    </>
  );
};

export default IssueReceiptSheet;
