'use client';

import { Fragment, useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import { useToast } from '@/components/Providers/ToastProvider';
import { IReasonDetail } from '@/interface/IGeneric';
import { ITaxProjection } from '@/interface/ITax';
import {
  calculateTaxRun,
  fetchTaxRun,
  projectTaxYears,
  seedNepalRulePack,
} from '@/services/tax.service';

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

/** The engine sends a fraction. 0.25 is 25% — never multiply it anywhere else. */
const percent = (rate?: number | null) =>
  rate == null
    ? '—'
    : `${(rate * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%`;

/** "2083/84" from 2083 — the same BS convention the server writes. */
const yearCode = (startYear: number) =>
  `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;

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
 * Nepal IRD tax depreciation over a span of years.
 *
 * An asset that has been in service since 2016 cannot be answered one year at a time: the
 * live run refuses until the previous year is posted. So the default here is a RANGE
 * PROJECTION — the server walks the years, feeding each year's closing written-down value
 * into the next, and writes nothing. Saving a year as a real run is the separate action, and
 * only makes sense for a single year.
 *
 * Every figure is the engine's. Nothing here recomputes a rate, a band or a balance.
 */
export default function TaxRunModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { addToast } = useToast();

  const currentBsYear = 2083;

  const [fromYear, setFromYear] = useState(String(currentBsYear - 5));
  const [toYear, setToYear] = useState(String(currentBsYear));
  const [projection, setProjection] = useState<ITaxProjection | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [reasons, setReasons] = useState<IReasonDetail[] | null>(null);
  const [failure, setFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    setFromYear(String(currentBsYear - 5));
    setToYear(String(currentBsYear));
    setProjection(null);
    setExpanded(null);
    setReasons(null);
    setFailure(null);
  }, [open]);

  const from = Number(fromYear);
  const to = Number(toYear);
  const rangeValid =
    Number.isInteger(from) && Number.isInteger(to) && from >= 1900 && to >= from;
  const singleYear = rangeValid && from === to;

  /**
   * The jurisdiction id has no GET endpoint; the rule-pack seed is idempotent and is the only
   * read path. Seeded from the FIRST year of the range, so a range reaching back before the
   * pack's effective date extends it rather than leaving those years uncovered.
   */
  const resolveJurisdiction = async () => {
    const response = await seedNepalRulePack({
      effectiveFromStartYear: from,
      effectiveFromTaxYear: yearCode(from),
    });
    if (!response?.success || !response.data?.id) {
      setFailure({
        code: response?.reasonCode,
        message: response?.message || 'The Nepal tax rules could not be resolved.',
      });
      return null;
    }
    return response.data.id;
  };

  const project = async () => {
    if (busy) return;
    if (!rangeValid) {
      setFailure({
        message: 'Enter Bikram Sambat start years, with the last not before the first.',
      });
      return;
    }

    setBusy(true);
    setFailure(null);
    setReasons(null);
    setProjection(null);
    try {
      const jurisdictionId = await resolveJurisdiction();
      if (!jurisdictionId) return;

      const response = await projectTaxYears({
        taxJurisdictionId: jurisdictionId,
        fromTaxYearStartYear: from,
        toTaxYearStartYear: to,
      });

      if (!response?.success || !response.data) {
        setFailure({
          code: response?.reasonCode,
          message: response?.message || 'Could not project the tax years.',
        });
        return;
      }

      setProjection(response.data);
      // Years with no rule pack, pools with no class — surfaced as warnings beside the
      // figures rather than swallowed.
      if (response.data.reasons?.length) setReasons(response.data.reasons);
    } catch {
      setFailure({ message: 'Could not project the tax years.' });
    } finally {
      setBusy(false);
    }
  };

  /** The one action that persists: a single year, calculated as a real run. */
  const saveSingleYear = async () => {
    if (busy || !singleYear) return;

    setBusy(true);
    setFailure(null);
    try {
      const jurisdictionId = await resolveJurisdiction();
      if (!jurisdictionId) return;

      const response = await calculateTaxRun({
        taxJurisdictionId: jurisdictionId,
        taxYearCode: yearCode(from),
        taxYearStartYear: from,
      });

      if (response?.data?.reasons?.length) setReasons(response.data.reasons);

      if (!response?.success || !response.data?.entityId) {
        setFailure({
          code: response?.reasonCode,
          message: response?.message || 'Could not calculate the tax run.',
        });
        return;
      }

      addToast.success(response.message || 'Tax run saved.');
      const full = await fetchTaxRun(response.data.entityId);
      if (full?.success && full.data)
        addToast.info(
          `${full.data.poolCount} pool(s), ${money(
            full.data.totalAllowedDeduction,
            full.data.currencyId
          )} allowed.`
        );
    } catch {
      setFailure({ message: 'Could not calculate the tax run.' });
    } finally {
      setBusy(false);
    }
  };

  const calculatedYears = projection?.years.filter((y) => y.wasCalculated) ?? [];

  return (
    <Modal isOpen={open} onClose={onClose} size="3xl">
      <div className="p-5">
        <h2 className="mb-1 text-lg font-semibold text-secondaryColor">
          Nepal IRD Tax Depreciation
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          The second book. Pooled diminishing balance under Schedule 2, entirely separate from
          the accounting figures — the two are not expected to agree. Projecting a range
          computes each year in turn, carrying its closing written-down value into the next,
          and saves nothing.
        </p>

        <div className="flex items-end gap-3">
          <Input
            label="From Tax Year"
            type="number"
            required
            value={fromYear}
            onChange={(e) => setFromYear(e.target.value)}
            placeholder="2078"
            helperText="Bikram Sambat start year — 2078 means 2078/79."
            className="flex-1"
          />
          <Input
            label="To Tax Year"
            type="number"
            required
            value={toYear}
            onChange={(e) => setToYear(e.target.value)}
            placeholder="2083"
            helperText="Inclusive."
            className="flex-1"
          />
          <Button onClick={project} disabled={busy || !rangeValid}>
            {busy ? 'Calculating…' : 'Calculate Range'}
          </Button>
        </div>

        {rangeValid && (
          <p className="mt-2 text-xs text-gray-500">
            {yearCode(from)} → {yearCode(to)} · {to - from + 1} year
            {to - from === 0 ? '' : 's'}
          </p>
        )}

        {failure && (
          <ReasonBanner
            className="mt-4"
            code={failure.code}
            message={failure.message}
            severity="error"
          />
        )}

        {reasons && reasons.length > 0 && (
          <ReasonBanner className="mt-4" reasons={reasons} severity="warning" />
        )}

        {projection && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
              <DetailField
                label="Range"
                value={`${yearCode(projection.fromTaxYearStartYear)} → ${yearCode(
                  projection.toTaxYearStartYear
                )}`}
              />
              <DetailField label="Years Calculated" value={calculatedYears.length} />
              <DetailField
                label="Total Tax Depreciation"
                value={money(projection.totalAllowedDeduction, projection.currencyId)}
              />
              <DetailField
                label="Closing WDV"
                value={money(
                  calculatedYears[calculatedYears.length - 1]?.totalClosingWrittenDownValue,
                  projection.currencyId
                )}
              />
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2">Tax Year</th>
                    <th className="px-3 py-2 text-right">Tax Depreciation</th>
                    <th className="px-3 py-2 text-right">Closing WDV</th>
                    <th className="px-3 py-2">Rule Set</th>
                    <th className="px-3 py-2 text-center">Pools</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.years.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                        Nothing to project — no asset is classified for IRD yet.
                      </td>
                    </tr>
                  )}
                  {projection.years.map((year) => (
                    <Fragment key={year.taxYearCode}>
                      <tr
                        className={`border-b border-gray-100 ${
                          year.wasCalculated ? 'cursor-pointer hover:bg-gray-50' : 'opacity-60'
                        }`}
                        onClick={() =>
                          year.wasCalculated &&
                          setExpanded(
                            expanded === year.taxYearStartYear ? null : year.taxYearStartYear
                          )
                        }
                      >
                        <td className="px-3 py-2 font-medium">
                          {year.wasCalculated && (
                            <i
                              className={`icon icon-arrow-down mr-1.5 text-[10px] text-gray-400 transition-transform ${
                                expanded === year.taxYearStartYear ? 'rotate-180' : ''
                              }`}
                            />
                          )}
                          {year.taxYearCode}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {year.wasCalculated
                            ? money(year.totalAllowedDeduction, projection.currencyId)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {year.wasCalculated
                            ? money(year.totalClosingWrittenDownValue, projection.currencyId)
                            : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {year.ruleSetVersion ?? (
                            <span className="text-amber-700">no rule pack covers this year</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {year.pools.length}
                        </td>
                      </tr>

                      {expanded === year.taxYearStartYear &&
                        year.pools.map((pool) => (
                          <tr key={pool.id || `${year.taxYearCode}-${pool.classCode}`} className="bg-gray-50 text-xs">
                            <td colSpan={5} className="px-3 py-2">
                              <div className="mb-1 font-medium text-gray-700">
                                Class {pool.classCode}
                                {pool.assetCode ? ` · ${pool.assetCode}` : ''}
                              </div>
                              <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-gray-600">
                                <span>
                                  Opening WDV:{' '}
                                  {money(pool.openingWrittenDownValue, projection.currencyId)}
                                </span>
                                <span>
                                  Additions:{' '}
                                  {money(pool.eligibleAdditions, projection.currencyId)}
                                </span>
                                <span>
                                  Deferred B/F:{' '}
                                  {money(
                                    pool.deferredAdditionsBroughtForward,
                                    projection.currencyId
                                  )}
                                </span>
                                <span>
                                  Disposals:{' '}
                                  {money(pool.disposalProceeds, projection.currencyId)}
                                </span>
                                <span>
                                  Base: {money(pool.depreciationBase, projection.currencyId)}
                                </span>
                                <span>Rate: {percent(pool.rateApplied)}</span>
                                <span className="font-medium text-gray-800">
                                  Tax depreciation:{' '}
                                  {money(pool.allowedTaxDeduction, projection.currencyId)}
                                </span>
                                <span>
                                  Closing WDV:{' '}
                                  {money(pool.closingWrittenDownValue, projection.currencyId)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500">
              A projection is not a filing: nothing above has been saved. Each year&apos;s
              closing written-down value opens the next, and deferred additions carried forward
              enter the following year&apos;s pool.
            </p>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {/* Saving is per year by design — a run is reviewed, approved and posted one year
              at a time, so a range has nothing to save. */}
          <Button
            variant="secondary"
            onClick={saveSingleYear}
            disabled={busy || !singleYear}
            title={
              singleYear
                ? undefined
                : 'Set From and To to the same year to save it as a run.'
            }
          >
            Save {rangeValid && singleYear ? yearCode(from) : 'a single year'} as a run
          </Button>
        </div>
      </div>
    </Modal>
  );
}
