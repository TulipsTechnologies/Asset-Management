'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import TextArea from '@/components/UI/TextArea';
import { useToast } from '@/components/Providers/ToastProvider';
import { IMigrationBatch, IMigrationLineInput } from '@/interface/IDepreciation';
import {
  applyMigrationBatch,
  approveMigrationBatch,
  createMigrationBatch,
  fetchMigrationBatch,
  validateMigrationBatch,
} from '@/services/depreciation.service';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The CSV contract, deliberately explicit. AssetReference is the asset code; dates are ISO;
 * money is plain numbers. Column order is fixed so the parser has no header-guessing to get
 * wrong — the header row itself is required and checked.
 */
const COLUMNS = [
  'assetReference',
  'cost',
  'openingAccumulatedDepreciation',
  'openingNetBookValue',
  'lastDepreciationThroughDate',
  'availableForUseDate',
  'usefulLifeMonths',
  'remainingUsefulLifeMonths',
  'residualValue',
  'depreciationMethodCode',
] as const;

const TEMPLATE = `${COLUMNS.join(',')}
AST-0001,120000,40000,80000,2026-06-30,2016-08-17,240,120,0,StraightLine`;

type TParsed =
  | { ok: true; lines: IMigrationLineInput[] }
  | { ok: false; error: string };

const parseCsv = (raw: string): TParsed => {
  const rows = raw
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rows.length < 2) return { ok: false, error: 'Paste a header row and at least one data row.' };

  const header = rows[0].split(',').map((h) => h.trim());
  if (header.join(',') !== COLUMNS.join(','))
    return {
      ok: false,
      error: `The header must be exactly: ${COLUMNS.join(', ')}`,
    };

  const lines: IMigrationLineInput[] = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i].split(',').map((c) => c.trim());
    if (cells.length !== COLUMNS.length)
      return { ok: false, error: `Row ${i + 1} has ${cells.length} columns; expected ${COLUMNS.length}.` };

    const num = (v: string) => (v === '' ? undefined : Number(v));
    const text = (v: string) => (v === '' ? undefined : v);

    if (!cells[0]) return { ok: false, error: `Row ${i + 1} has no asset reference.` };

    lines.push({
      assetReference: cells[0],
      sourceRowNumber: i + 1,
      cost: num(cells[1]),
      openingAccumulatedDepreciation: num(cells[2]),
      openingNetBookValue: num(cells[3]),
      lastDepreciationThroughDate: text(cells[4]),
      availableForUseDate: text(cells[5]),
      usefulLifeMonths: num(cells[6]),
      remainingUsefulLifeMonths: num(cells[7]),
      residualValue: num(cells[8]),
      depreciationMethodCode: text(cells[9]),
    });
  }
  return { ok: true, lines };
};

/**
 * Bulk opening balances, riding the migration workflow: create → validate → approve → apply.
 *
 * The steps are shown as steps on purpose. Approval is the act that makes the figures
 * authoritative — applied books resume after their through-date and their history is never
 * regenerated — so the operator sees the validation verdict before anything is adopted, and
 * the server's hash check refuses an approval whose data changed after validation.
 */
export default function OpeningBalanceImportModal({
  open,
  onClose,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { addToast } = useToast();

  const [csv, setCsv] = useState('');
  const [cutoverDate, setCutoverDate] = useState(today());
  const [batch, setBatch] = useState<IMigrationBatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

  const parsed = useMemo(() => (csv.trim() ? parseCsv(csv) : null), [csv]);

  const reset = () => {
    setCsv('');
    setBatch(null);
    setFailure(null);
    setCutoverDate(today());
  };

  const validate = async () => {
    if (busy || !parsed?.ok) return;
    setBusy(true);
    setFailure(null);
    try {
      const created = await createMigrationBatch({
        batchReference: `OB-${today()}-${String(Math.abs(csv.length * 31 + parsed.lines.length)).slice(0, 4)}`,
        cutoverDate,
        notes: 'Opening balance import from the depreciation screen.',
        lines: parsed.lines,
      });
      if (!created?.success || !created.data) {
        setFailure({ code: created?.reasonCode, message: created?.message });
        return;
      }

      const validated = await validateMigrationBatch(created.data.id);
      if (!validated?.success || !validated.data) {
        setFailure({ code: validated?.reasonCode, message: validated?.message });
        return;
      }
      setBatch(validated.data);
    } catch {
      setFailure({ message: 'Could not validate the import.' });
    } finally {
      setBusy(false);
    }
  };

  const approveAndApply = async () => {
    if (busy || !batch?.rowVersion || !batch.validationSnapshotHash) return;
    setBusy(true);
    setFailure(null);
    try {
      // Approval quotes the validation hash: if any line changed since validation the
      // server refuses, rather than adopting figures nobody reviewed.
      const approved = await approveMigrationBatch(
        batch.id,
        batch.rowVersion,
        batch.validationSnapshotHash
      );
      if (!approved?.success) {
        setFailure({ code: approved?.reasonCode, message: approved?.message });
        return;
      }

      const fresh = await fetchMigrationBatch(batch.id);
      const rowVersion = fresh?.data?.rowVersion;
      if (!rowVersion) {
        setFailure({ message: 'The batch was approved but could not be re-read for apply.' });
        return;
      }

      const applied = await applyMigrationBatch(batch.id, rowVersion);
      if (!applied?.success) {
        setFailure({ code: applied?.reasonCode, message: applied?.message });
        return;
      }

      addToast.success(
        `${batch.lineCount} opening balance(s) applied. The books resume after their through-dates; their history is never regenerated.`
      );
      onApplied();
      reset();
      onClose();
    } catch {
      setFailure({ message: 'Could not approve and apply the import.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={() => { reset(); onClose(); }} size="3xl">
      <div className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-secondaryColor">Opening Balance Import</h2>
        <p className="mb-4 text-xs text-gray-500">
          Adopts the previous system&apos;s figures for many assets at once. Validation shows
          every problem before anything is adopted; approval makes the figures authoritative
          and they are never recomputed.
        </p>

        {!batch ? (
          <>
            <Input
              label="Cutover Date"
              type="date"
              required
              value={cutoverDate}
              onChange={(e) => setCutoverDate(e.target.value)}
              helperText="The date this register takes over from the previous system."
            />

            <div className="mt-4">
              <TextArea
                label="CSV rows"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder={TEMPLATE}
                textAreaClassName="font-mono text-xs min-h-[180px]"
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  Header row required, ISO dates, plain numbers.
                </p>
                <button
                  type="button"
                  className="text-xs text-primarycolor hover:underline"
                  onClick={() => setCsv(TEMPLATE)}
                >
                  Insert template
                </button>
              </div>
            </div>

            {parsed && !parsed.ok && (
              <p className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
                {parsed.error}
              </p>
            )}
            {parsed?.ok && (
              <p className="mt-3 text-xs text-gray-500">
                {parsed.lines.length} row(s) ready to validate.
              </p>
            )}
          </>
        ) : (
          <>
            <div className="mb-3 flex items-baseline justify-between text-sm">
              <span className="font-medium text-gray-800">
                {batch.batchReference} · {batch.lineCount} line(s)
              </span>
              <span className={batch.problemCount > 0 ? 'text-red-600' : 'text-primarycolor'}>
                {batch.problemCount > 0
                  ? `${batch.problemCount} problem(s) — fix the sheet and re-validate`
                  : 'Everything reconciles'}
              </span>
            </div>

            <div className="max-h-72 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2 text-right">Cost</th>
                    <th className="px-3 py-2 text-right">Opening Accum.</th>
                    <th className="px-3 py-2 text-right">Opening NBV</th>
                    <th className="px-3 py-2">Through</th>
                    <th className="px-3 py-2 text-center">Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.lines.map((line) => (
                    <tr key={line.id} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-500">{line.sourceRowNumber}</td>
                      <td className="px-3 py-2 font-medium">{line.assetReference}</td>
                      <td className="px-3 py-2 text-right">{line.cost?.toLocaleString() ?? '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {line.openingAccumulatedDepreciation?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {line.openingNetBookValue?.toLocaleString() ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {line.lastDepreciationThroughDate?.slice(0, 10) ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {line.isValid ? (
                          <span className="text-primarycolor">✓</span>
                        ) : (
                          <span className="text-red-500">✕</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className="mt-3 text-xs text-gray-500 hover:text-primarycolor"
              onClick={() => setBatch(null)}
            >
              ← Back to the sheet
            </button>
          </>
        )}

        {failure && (
          <ReasonBanner
            className="mt-4"
            code={failure.code}
            message={failure.message}
            severity="error"
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          {!batch ? (
            <Button onClick={validate} disabled={busy || !parsed?.ok}>
              {busy ? 'Validating…' : 'Validate'}
            </Button>
          ) : (
            <Button
              onClick={approveAndApply}
              disabled={busy || batch.problemCount > 0}
              title={
                batch.problemCount > 0
                  ? 'Every line must validate before the batch can be approved.'
                  : undefined
              }
            >
              {busy ? 'Applying…' : 'Approve & Apply'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
