'use client';

import { RECOVERY_CASE_STATUS_LABELS, RETURN_OUTCOME_LABELS } from '@/enum/returnEnums';
import { IReturnRecoveryCaseSummary } from '@/interface/IAssetReturn';
import { documentRef, returnDocumentKind } from '@/utils/printDocuments';

/**
 * Asset Return Receipt / Return & Clearance Certificate.
 *
 * ONE component, TWO documents, and the distinction is the entire design:
 *
 *  - BEFORE inspection it is a RECEIPT. It proves custody came back on a date and nothing
 *    more. It says so in a bordered box, because an employee who believes an uninspected
 *    return discharged their liability has been misled by their own paperwork.
 *  - AFTER inspection it is a CLEARANCE CERTIFICATE. It carries the condition found, the
 *    outcome, missing accessories and damage notes — and, where a recovery case was raised,
 *    a block stating plainly that this is NOT a full discharge, with its own acknowledgement
 *    signature.
 *
 * If the two shared a title, someone would wave the wrong one at HR during separation
 * clearance and the company would lose its claim on a damaged laptop. A clearance certificate
 * that hides a live recovery claim is a false document.
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

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

export interface IReturnClearanceProps {
  companyName: string;
  generatedBy: string;
  generatedOn: Date;
  returnId: string;
  assetCode: string;
  assetName: string;
  serialNumber?: string | null;
  assetTag?: string | null;
  returnedByEmployeeName: string;
  returnedByEmployeeCode?: string | null;
  returnDate: string;
  /** Null until the return has been inspected — this is what switches the document. */
  inspectedOn?: string | null;
  conditionAtReturnName?: string | null;
  /** What the asset was graded at when it was issued; the baseline damage is judged against. */
  conditionAtIssueName?: string | null;
  /** True when the baseline could not be loaded — printed as unavailable, never omitted. */
  baselineUnavailable?: boolean;
  outcome?: number | null;
  missingAccessories?: string | null;
  damageNotes?: string | null;
  inspectionNotes?: string | null;
  notes?: string | null;
  recoveryCases: IReturnRecoveryCaseSummary[];
}

const ReturnClearanceSheet = ({
  companyName,
  generatedBy,
  generatedOn,
  returnId,
  assetCode,
  assetName,
  serialNumber,
  assetTag,
  returnedByEmployeeName,
  returnedByEmployeeCode,
  returnDate,
  inspectedOn,
  conditionAtReturnName,
  conditionAtIssueName,
  baselineUnavailable,
  outcome,
  missingAccessories,
  damageNotes,
  inspectionNotes,
  notes,
  recoveryCases,
}: IReturnClearanceProps) => {
  // The decision lives in printDocuments.ts, where a test holds it: which of the two
  // documents this is, and what it is obliged to disclose.
  const kind = returnDocumentKind(inspectedOn, recoveryCases.length);
  const inspected = !kind.showPendingCaveat;
  const hasRecovery = kind.showRecovery;
  const shortRef = documentRef('RET', returnId, returnDate);
  const identity = serialNumber || assetTag || null;

  return (
    <>
      <header className="print-header">
        <div>
          <h1 className="print-company">{companyName || 'Company not set'}</h1>
          <p className="print-title">{kind.title}</p>
        </div>
        <div className="print-meta">
          <div>
            Ref <strong>{shortRef}</strong>
          </div>
          <div style={{ fontSize: '6.5pt' }}>{returnId}</div>
          <div>Returned {formatDate(returnDate)}</div>
          {inspected && <div>Inspected {formatDate(inspectedOn)}</div>}
        </div>
      </header>

      {kind.showPendingCaveat && (
        // The whole reason this state gets its own document.
        <p
          className="print-terms"
          style={{ border: '0.75px solid #333', padding: '4pt 6pt', marginTop: 0 }}
        >
          <strong>Custody transferred on {formatDate(returnDate)}.</strong> This receipt
          confirms the item was handed back on that date. Liability for damage, shortfall or
          missing accessories is <strong>NOT discharged</strong> until the inspection is
          completed and a clearance certificate is issued.
        </p>
      )}

      <section className="print-block">
        <h2 className="print-section-title">Returned by</h2>
        <div className="print-grid">
          <Field label="Custodian" value={returnedByEmployeeName} />
          <Field label="Employee code" value={returnedByEmployeeCode} />
          <Field label="Return date" value={formatDate(returnDate)} />
          <Field label="Received by" value={generatedBy} />
        </div>
      </section>

      <table className="print-table">
        <thead>
          <tr>
            <th>Asset code</th>
            <th>Description</th>
            <th>Serial / Tag</th>
            <th>Condition at issue</th>
            <th>Condition at return</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{assetCode}</td>
            <td>{assetName}</td>
            <td>{identity || <em style={{ color: '#777' }}>no serial recorded</em>}</td>
            <td>
              {/* The baseline is what gives the assessment its force. If it could not be
                  loaded, say so — a blank column quietly stops meaning anything. */}
              {baselineUnavailable ? (
                <em style={{ color: '#777' }}>not available</em>
              ) : (
                conditionAtIssueName || '—'
              )}
            </td>
            <td>{inspected ? conditionAtReturnName || '—' : 'Pending inspection'}</td>
          </tr>
        </tbody>
      </table>

      {inspected && (
        <section className="print-block">
          <h2 className="print-section-title">Inspection result</h2>
          <div className="print-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field
              label="Outcome"
              value={outcome ? RETURN_OUTCOME_LABELS[outcome] ?? String(outcome) : null}
            />
            <Field label="Missing accessories" value={missingAccessories} />
            <Field label="Damage noted" value={damageNotes} />
            <Field label="Inspection notes" value={inspectionNotes} />
          </div>
        </section>
      )}

      {notes && (
        <p className="print-note">
          <strong>Return notes:</strong> {notes}
        </p>
      )}

      {hasRecovery && (
        <section className="print-block" style={{ border: '0.75px solid #333', padding: '5pt 6pt' }}>
          <h2 className="print-section-title" style={{ borderBottom: 'none', marginBottom: '3pt' }}>
            Recovery raised — this return is NOT a full discharge
          </h2>
          <table className="print-table">
            <thead>
              <tr>
                <th>Case reference</th>
                <th>Status</th>
                <th className="right">Estimated amount</th>
              </tr>
            </thead>
            <tbody>
              {recoveryCases.map((recoveryCase) => (
                <tr key={recoveryCase.id}>
                  <td>{documentRef('RC', recoveryCase.id, returnDate)}</td>
                  <td>
                    {RECOVERY_CASE_STATUS_LABELS[recoveryCase.status] ?? recoveryCase.status}
                  </td>
                  <td className="right">
                    {money(recoveryCase.estimatedAmount, recoveryCase.currencyId)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="print-terms">
            The assessment above has been explained to me. I understand that the amount shown is
            an estimate and that settlement is subject to company policy.
          </p>
          <div className="print-signatures" style={{ marginTop: '8pt' }}>
            <div className="print-signature">
              <div className="print-signature-line" />
              <p className="print-signature-role">Acknowledged by — custodian</p>
              <p className="print-signature-name">{returnedByEmployeeName}</p>
              <p className="print-signature-meta">Date ____ / ____ / ________</p>
            </div>
          </div>
        </section>
      )}

      {kind.showClearedStatement && (
        <p className="print-terms">
          <strong>Cleared.</strong> The item above has been returned and inspected, and no
          recovery has been raised against the custodian in respect of it.
        </p>
      )}

      <div className="print-signatures">
        {(inspected
          ? [
              ['Returned by — custodian', returnedByEmployeeName],
              ['Inspected by', ''],
              ['Cleared by', ''],
            ]
          : [
              ['Returned by — custodian', returnedByEmployeeName],
              ['Received by', generatedBy],
            ]
        ).map(([role, name]) => (
          <div key={role} className="print-signature">
            <div className="print-signature-line" />
            <p className="print-signature-role">{role}</p>
            <p className="print-signature-name">{name || ' '}</p>
            <p className="print-signature-meta">Date ____ / ____ / ________</p>
          </div>
        ))}
      </div>

      <footer className="print-footer">
        {companyName || 'Company not set'} · Ref {shortRef} ·{' '}
        {inspected ? 'clearance certificate' : 'receipt — inspection pending'} · printed{' '}
        {formatDate(generatedOn)} by {generatedBy || '—'}
      </footer>
    </>
  );
};

export default ReturnClearanceSheet;
