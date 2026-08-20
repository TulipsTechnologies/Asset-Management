'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import TextArea from '@/components/UI/TextArea';
import { useToast } from '@/components/Providers/ToastProvider';
import { IAssetBook, IConventionChangePreview } from '@/interface/IDepreciation';
import { CONVENTION_LABELS } from '@/enum/depreciationEnums';
import {
  previewBookConvention,
  switchBookConventionToDaily,
} from '@/services/depreciation.service';
import { shortDate } from '@/components/Assets/AssetViewShared';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

const DetailField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
  </div>
);

/**
 * Moving one book from whole months to actual calendar days.
 *
 * Two steps on purpose. Nothing about this is automatic: the operator names a date, sees
 * exactly what the change would do period by period, and only then applies it. Posted
 * periods are never restated — the switch takes effect from the date forward.
 */
export default function ConventionSwitchModal({
  book,
  onClose,
  onApplied,
}: {
  book: IAssetBook | null;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { addToast } = useToast();

  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<IConventionChangePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [failure, setFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!book) return;
    setEffectiveFrom(new Date().toISOString().slice(0, 10));
    setReason('');
    setPreview(null);
    setFailure(null);
  }, [book]);

  const runPreview = useCallback(async () => {
    if (!book || !effectiveFrom) return;
    setLoading(true);
    setFailure(null);
    try {
      const response = await previewBookConvention(book.id, effectiveFrom);
      if (response?.success && response.data) setPreview(response.data);
      else {
        setPreview(null);
        setFailure({
          code: response?.reasonCode,
          message: response?.message || 'Could not preview the change.',
        });
      }
    } catch {
      setFailure({ message: 'Could not preview the change.' });
    } finally {
      setLoading(false);
    }
  }, [book, effectiveFrom]);

  const apply = async () => {
    if (!book || applying) return;
    setApplying(true);
    setFailure(null);
    try {
      const response = await switchBookConventionToDaily(book.id, {
        rowVersion: book.rowVersion,
        effectiveFrom,
        reason: reason || undefined,
      });

      if (response?.success) {
        addToast.success(response.message || 'The book now uses actual calendar days.');
        onApplied();
        onClose();
        return;
      }

      // A refusal still carries the full preview, so the blockers stay readable.
      if (response?.data) setPreview(response.data);
      setFailure({
        code: response?.reasonCode,
        message: response?.message || 'Could not switch the convention.',
      });
    } catch {
      setFailure({ message: 'Could not switch the convention.' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal isOpen={!!book} onClose={onClose} size="3xl">
      <div className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-secondaryColor">
          Switch to Actual Calendar Days — {book?.assetCode}
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Prospective. Periods that have already posted keep the numbers they were posted
          with; only the remaining life is re-measured by actual days.
        </p>

        <div className="grid grid-cols-3 gap-4 rounded bg-gray-50 p-3">
          <DetailField
            label="Current Convention"
            value={
              book ? CONVENTION_LABELS[book.depreciationConvention] ?? '—' : '—'
            }
          />
          <DetailField
            label="Available for Use"
            value={formatDate(book?.availableForUseDate)}
          />
          <DetailField
            label="Charged Through"
            value={formatDate(book?.lastDepreciationThroughDate)}
          />
        </div>

        <div className="mt-4 flex items-end gap-3">
          <Input
            label="Effective From"
            type="date"
            required
            value={effectiveFrom}
            onChange={(e) => setEffectiveFrom(e.target.value)}
            helperText="Pulled forward automatically if it falls inside an already-posted period."
            className="flex-1"
          />
          <Button variant="secondary" onClick={runPreview} disabled={loading || !effectiveFrom}>
            {loading ? 'Previewing…' : 'Preview'}
          </Button>
        </div>

        {failure && (
          <ReasonBanner
            className="mt-4"
            code={failure.code}
            message={failure.message}
            severity="error"
          />
        )}

        {preview && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
              <DetailField
                label="Proposed Convention"
                value={CONVENTION_LABELS[preview.proposedConvention] ?? '—'}
              />
              <DetailField label="Effective From" value={formatDate(preview.effectiveFrom)} />
              <DetailField
                label="Already Posted"
                value={money(preview.postedToDate, book?.currencyId)}
              />
              <DetailField
                label="Projected Difference"
                value={money(preview.projectedDifference, book?.currencyId)}
              />
            </div>

            <p className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-900">
              {money(preview.postedToDate, book?.currencyId)} has already posted and will not
              change. Only the remaining base of{' '}
              {money(preview.remainingBase, book?.currencyId)} is re-measured — the total over
              the asset&apos;s life is the same either way, the timing moves.
            </p>

            {preview.blockers?.length > 0 && (
              <ReasonBanner reasons={preview.blockers} severity="error" />
            )}

            {preview.periods?.length > 0 && (
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2 text-right">Days</th>
                      <th className="px-3 py-2 text-right">Full Month</th>
                      <th className="px-3 py-2 text-right">Actual Days</th>
                      <th className="px-3 py-2 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.periods.map((period) => (
                      <tr
                        key={`${period.fiscalYearCode}-${period.periodOrdinal}`}
                        className="border-b border-gray-100"
                      >
                        <td className="px-3 py-2">
                          {period.fiscalYearCode} · {period.periodOrdinal}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {period.chargedDays ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {money(period.underCurrent, book?.currencyId)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {money(period.underProposed, book?.currencyId)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right ${
                            period.difference === 0
                              ? 'text-gray-400'
                              : period.difference > 0
                                ? 'text-green-700'
                                : 'text-red-700'
                          }`}
                        >
                          {money(period.difference, book?.currencyId)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <TextArea
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why the book is moving to actual days — recorded on the book."
            />
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!preview?.canApply || applying}>
            {applying ? 'Switching…' : 'Switch to Actual Calendar Days'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
