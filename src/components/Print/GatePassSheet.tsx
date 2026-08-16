'use client';

import { documentRef } from '@/utils/printDocuments';

/**
 * Transfer Gate Pass.
 *
 * The one document here whose reader has no access to the app: a security officer deciding
 * whether an asset may leave the building. Everything on it is shaped by that.
 *
 *  - It is printed only for an APPROVED or DISPATCHED transfer. A pass for a merely requested
 *    move would authorise an unapproved asset out of the gate, and someone would use it that
 *    way. That gate lives at the call site, where the status is known.
 *  - The reference is large, because it is the one string a guard reads at arm's length in bad
 *    light and radios back.
 *  - Nothing that resolves to a bare id reaches the paper. The transfer record carries
 *    branch and department as raw GUIDs with no name anywhere, so they are simply not printed
 *    — a document a human must read has no business showing a GUID.
 *  - Signature captions are printed with EMPTY rules. The record holds no approver or
 *    dispatcher name, and inventing one on a security document is worse than a blank line.
 *  - A counterfoil sits below a tear line: the guard keeps it, the pass travels with the goods.
 *    That is what a gate pass physically is.
 *
 * Single asset by construction — a transfer moves one asset, so moving six monitors prints
 * six passes. That is more rigorous, not less: each carries its own condition at dispatch and
 * its own receipt signature.
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

export interface IGatePassProps {
  companyName: string;
  generatedBy: string;
  generatedOn: Date;
  transferId: string;
  assetCode: string;
  assetName: string;
  serialNumber?: string | null;
  assetTag?: string | null;
  conditionAtDispatchName?: string | null;
  fromEmployeeName?: string | null;
  fromAssetLocationName?: string | null;
  toEmployeeName?: string | null;
  toAssetLocationName?: string | null;
  reason?: string | null;
  notes?: string | null;
  approvedOn?: string | null;
  dispatchedOn?: string | null;
}

const GatePassSheet = ({
  companyName,
  generatedBy,
  generatedOn,
  transferId,
  assetCode,
  assetName,
  serialNumber,
  assetTag,
  conditionAtDispatchName,
  fromEmployeeName,
  fromAssetLocationName,
  toEmployeeName,
  toAssetLocationName,
  reason,
  notes,
  approvedOn,
  dispatchedOn,
}: IGatePassProps) => {
  const shortRef = documentRef('GP', transferId, dispatchedOn ?? approvedOn ?? generatedOn);
  const validOn = formatDate(dispatchedOn) ?? formatDate(approvedOn) ?? formatDate(generatedOn);
  const identity = serialNumber || assetTag || null;

  // An employee-to-employee move records no locations at all. Two blank boxes would read as
  // missing data; saying so explicitly is the honest form.
  const destination =
    toAssetLocationName || toEmployeeName
      ? [toEmployeeName, toAssetLocationName].filter(Boolean).join(' · ')
      : 'Not recorded';
  const origin =
    fromAssetLocationName || fromEmployeeName
      ? [fromEmployeeName, fromAssetLocationName].filter(Boolean).join(' · ')
      : 'Not recorded';

  return (
    <>
      <header className="print-header">
        <div>
          <h1 className="print-company">{companyName || 'Company not set'}</h1>
          <p className="print-title">Gate Pass — Asset Movement</p>
        </div>
        <div className="print-meta">
          {/* The number a guard reads across a barrier. */}
          <div style={{ fontSize: '14pt', fontWeight: 700, color: '#111' }}>{shortRef}</div>
          <div style={{ fontSize: '6.5pt' }}>{transferId}</div>
          <div>Valid {validOn}</div>
        </div>
      </header>

      <p
        className="print-terms"
        style={{ border: '0.75px solid #333', padding: '4pt 6pt', marginTop: 0 }}
      >
        <strong>Valid for ONE exit on {validOn}.</strong> The goods presented must match the
        description below. Present with photo identification. This pass is void if altered.
      </p>

      <section className="print-block">
        <h2 className="print-section-title">Movement</h2>
        <div className="print-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="From — custodian / location" value={origin} />
          <Field label="To — custodian / location" value={destination} />
          <Field label="Reason for movement" value={reason} />
          <Field label="Authorised on" value={formatDate(approvedOn)} />
        </div>
      </section>

      <table className="print-table">
        <thead>
          <tr>
            <th>Asset code</th>
            <th>Description</th>
            <th>Serial / Tag</th>
            <th>Condition at dispatch</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{assetCode}</td>
            <td>{assetName}</td>
            <td>
              {identity || <em style={{ color: '#777' }}>no serial recorded</em>}
            </td>
            <td>{conditionAtDispatchName || '—'}</td>
          </tr>
        </tbody>
      </table>

      {notes && (
        <p className="print-note">
          <strong>Notes:</strong> {notes}
        </p>
      )}

      <section className="print-block">
        <h2 className="print-section-title">Security check — completed at the gate</h2>
        <div className="print-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="print-field">
            <span className="print-field-value">
              <span className="print-tick" /> Goods verified against this pass
            </span>
          </div>
          <div className="print-field">
            <span className="print-field-value">
              <span className="print-tick" /> Photo identification seen
            </span>
          </div>
          <div className="print-field">
            <span className="print-field-label">Time out</span>
            <span className="print-write-in" />
          </div>
          <div className="print-field">
            <span className="print-field-label">Vehicle / carrier</span>
            <span className="print-write-in" />
          </div>
        </div>
      </section>

      {/* Four roles, none pre-filled: the record holds no approver or dispatcher name. */}
      <div className="print-signatures" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {['Dispatched by', 'Authorised by', 'Security officer', 'Received by — destination'].map(
          (role) => (
            <div key={role} className="print-signature">
              <div className="print-signature-line" />
              <p className="print-signature-role">{role}</p>
              <p className="print-signature-meta">Name ________________</p>
              <p className="print-signature-meta">Date ____ / ____ / ______</p>
            </div>
          )
        )}
      </div>

      <p className="print-note">
        Condition on receipt (write in, then record it in the system):{' '}
        <span className="print-write-in" style={{ minWidth: '60mm' }} />
      </p>

      {/* ---- tear line + counterfoil: the guard keeps this half ---- */}
      <div
        style={{
          borderTop: '1px dashed #666',
          marginTop: '10pt',
          paddingTop: '3pt',
          fontSize: '7pt',
          color: '#666',
        }}
      >
        SECURITY COUNTERFOIL — retain at the gate
      </div>
      <section className="print-block" style={{ marginTop: '4pt' }}>
        <div className="print-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <Field label="Pass reference" value={shortRef} />
          <Field label="Asset" value={`${assetCode} · ${assetName}`} />
          <Field label="Serial / Tag" value={identity} />
          <Field label="Destination" value={destination} />
          <Field label="Valid on" value={validOn} />
          <div className="print-field">
            <span className="print-field-label">Time out</span>
            <span className="print-write-in" />
          </div>
        </div>
        <div className="print-signatures" style={{ marginTop: '8pt' }}>
          <div className="print-signature">
            <div className="print-signature-line" />
            <p className="print-signature-role">Security officer</p>
          </div>
        </div>
      </section>

      <footer className="print-footer">
        {companyName || 'Company not set'} · Gate pass {shortRef} · printed{' '}
        {formatDate(generatedOn)} by {generatedBy || '—'} · a reprint supersedes nothing —
        check the reference against the system
      </footer>
    </>
  );
};

export default GatePassSheet;
