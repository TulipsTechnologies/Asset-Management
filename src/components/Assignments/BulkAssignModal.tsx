'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import { IEmployee } from '@/interface/IEmployee';
import {
  BulkAssignOutcomeEnum,
  IAssignableAsset,
  IBulkAssignOutcome,
  IBulkAssignResult,
} from '@/interface/IAssetAssignment';
import {
  bulkAssignAssets,
  fetchAssignableAssets,
} from '@/services/assetAssignment.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { ASSET_CONDITIONS } from '@/enum/assetEnums';
import useDebounce from '@/hooks/useDebounce';

/**
 * Issue a whole kit in one pass: pick the person, tick the assets, hand over.
 *
 * The commit is deliberately not all-or-nothing, and the result view is built around
 * that: an assignment records a handover that has already happened at the desk, so
 * refusing four true handovers because a fifth asset was quarantined would make the
 * register less accurate rather than more. What the operator gets back is a per-asset
 * report, failures first, with the option to retry only what did not go through.
 */

const PAGE_SIZE = 25;

type TStage = 'pick' | 'result';

interface IProps {
  isOpen: boolean;
  onClose: () => void;
  employees: IEmployee[];
  /** Preselected recipient — e.g. opening this from an employee's page. */
  initialEmployeeId?: string;
  /** Raised after anything was written, so the caller can reload its list. */
  onAssigned: () => void;
}

const OUTCOME_STYLES: Record<BulkAssignOutcomeEnum, { label: string; chip: string; row: string }> = {
  [BulkAssignOutcomeEnum.Assigned]: {
    label: 'Assigned',
    chip: 'bg-green-100 text-green-700',
    row: 'border-green-100',
  },
  [BulkAssignOutcomeEnum.AlreadyAssigned]: {
    label: 'Already held',
    chip: 'bg-sky-100 text-sky-700',
    row: 'border-sky-100',
  },
  [BulkAssignOutcomeEnum.Blocked]: {
    label: 'Not issued',
    chip: 'bg-amber-100 text-amber-700',
    row: 'border-amber-100',
  },
  [BulkAssignOutcomeEnum.NotFound]: {
    label: 'Not found',
    chip: 'bg-gray-200 text-gray-700',
    row: 'border-gray-200',
  },
  [BulkAssignOutcomeEnum.Conflict]: {
    label: 'Conflict',
    chip: 'bg-rose-100 text-rose-700',
    row: 'border-rose-100',
  },
};

const isFailure = (outcome: BulkAssignOutcomeEnum) =>
  outcome === BulkAssignOutcomeEnum.Blocked ||
  outcome === BulkAssignOutcomeEnum.NotFound ||
  outcome === BulkAssignOutcomeEnum.Conflict;

const BulkAssignModal = ({
  isOpen,
  onClose,
  employees,
  initialEmployeeId,
  onAssigned,
}: IProps) => {
  const [stage, setStage] = useState<TStage>('pick');

  const [employeeId, setEmployeeId] = useState(initialEmployeeId ?? '');
  const [assignmentDate, setAssignmentDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [conditionAtIssueId, setConditionAtIssueId] = useState('');
  const [accessories, setAccessories] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [showDetails, setShowDetails] = useState(false);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [showBlocked, setShowBlocked] = useState(false);
  const [rehydrateIds, setRehydrateIds] = useState<string[]>([]);

  const [assets, setAssets] = useState<IAssignableAsset[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [loadError, setLoadError] = useState('');

  /**
   * Keyed by id rather than a list of ids: the picker is paged and searchable, so a
   * selected asset routinely scrolls out of the loaded page, and the result view still
   * has to name it. Holding the whole row keeps the basket readable without refetching.
   */
  const [basket, setBasket] = useState<Map<string, IAssignableAsset>>(new Map());

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [indeterminate, setIndeterminate] = useState(false);
  const [result, setResult] = useState<IBulkAssignResult | null>(null);

  const resetAll = useCallback(() => {
    setStage('pick');
    setEmployeeId(initialEmployeeId ?? '');
    setAssignmentDate('');
    setExpectedReturnDate('');
    setConditionAtIssueId('');
    setAccessories('');
    setHandoverNotes('');
    setShowDetails(false);
    setSearch('');
    setShowBlocked(false);
    setRehydrateIds([]);
    setBasket(new Map());
    setFormError('');
    setLoadError('');
    setIndeterminate(false);
    setResult(null);
  }, [initialEmployeeId]);

  useEffect(() => {
    if (isOpen) resetAll();
  }, [isOpen, resetAll]);

  /**
   * A generation token, not an id comparison: the search box fires a request per
   * keystroke burst and a slow earlier response would otherwise land after a faster
   * later one and repaint the list with stale rows.
   */
  const loadGenerationRef = useRef(0);

  const loadAssets = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoadingAssets(true);
    try {
      const response = await fetchAssignableAssets({
        pageNumber: 1,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        includeIneligible: showBlocked || rehydrateIds.length > 0,
        assetIds: rehydrateIds.length > 0 ? rehydrateIds : undefined,
      });
      if (generation !== loadGenerationRef.current) return;

      /*
       * The envelope has to be checked. unwrapPaged coerces any non-array payload to an
       * empty page, so without this a 403, a 500 or a dropped connection all rendered as
       * "No assets are ready to be issued" — telling the operator their register is empty
       * when the truth is we never heard back.
       */
      if (!response?.success) {
        setAssets([]);
        setRowCount(0);
        setLoadError(response?.message || 'The list of assets could not be loaded.');
        return;
      }

      const { items, rowCount: count } = unwrapPaged(response);
      setAssets(items);
      setRowCount(count);
      setLoadError('');
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setAssets([]);
      setRowCount(0);
      setLoadError('The list of assets could not be loaded.');
    } finally {
      if (generation === loadGenerationRef.current) setLoadingAssets(false);
    }
  }, [debouncedSearch, showBlocked, rehydrateIds]);

  useEffect(() => {
    if (isOpen && stage === 'pick') loadAssets();
  }, [isOpen, stage, loadAssets]);

  const toggle = (asset: IAssignableAsset) => {
    setBasket((current) => {
      const next = new Map(current);
      if (next.has(asset.id)) next.delete(asset.id);
      else next.set(asset.id, asset);
      return next;
    });
  };

  const selectedCount = basket.size;
  const eligibleOnPage = useMemo(() => assets.filter((x) => x.eligible), [assets]);
  const allPageSelected =
    eligibleOnPage.length > 0 && eligibleOnPage.every((x) => basket.has(x.id));

  const togglePage = () => {
    setBasket((current) => {
      const next = new Map(current);
      if (allPageSelected) eligibleOnPage.forEach((x) => next.delete(x.id));
      else eligibleOnPage.forEach((x) => next.set(x.id, x));
      return next;
    });
  };

  const submit = async () => {
    setFormError('');
    setIndeterminate(false);

    if (!employeeId) {
      setFormError('Choose who is receiving these assets.');
      return;
    }
    if (selectedCount === 0) {
      setFormError('Select at least one asset to assign.');
      return;
    }

    setSaving(true);
    try {
      const response = await bulkAssignAssets({
        employeeId,
        assignmentDate: assignmentDate || undefined,
        expectedReturnDate: expectedReturnDate || undefined,
        conditionAtIssueId: conditionAtIssueId || undefined,
        accessories: accessories.trim() || undefined,
        handoverNotes: handoverNotes.trim() || undefined,
        items: [...basket.keys()].map((assetId) => ({ assetId })),
      });

      /*
       * A per-asset report is the ONLY evidence of what happened. Everything else —
       * a 500, a proxy timeout, a dropped connection — leaves the batch genuinely
       * unknown, because the server commits each asset separately and may have
       * committed several before the response was lost. Treating those as a plain
       * failure would tell the operator nothing was written when some of it was.
       */
      if (response?.data && Array.isArray(response.data.outcomes)) {
        setResult(response.data);
        setStage('result');
        onAssigned();
        return;
      }

      if (response?.statusCode === 400 || response?.statusCode === 403) {
        setFormError(response.message || 'The batch was refused.');
        return;
      }

      setIndeterminate(true);
      onAssigned();
    } catch {
      setIndeterminate(true);
      onAssigned();
    } finally {
      setSaving(false);
    }
  };

  /** Rebuild the basket from what did not go through and go back to the picker. */
  const retryFailed = () => {
    if (!result) return;
    const failedIds = result.outcomes.filter((x) => isFailure(x.outcome)).map((x) => x.assetId);
    const kept = new Map<string, IAssignableAsset>();
    failedIds.forEach((id) => {
      const row = basket.get(id);
      if (row) kept.set(id, row);
    });
    setBasket(kept);
    setResult(null);
    setSearch('');
    // Ask for these ids specifically, blocked ones included, so an asset that is still
    // unissuable is shown with its reason instead of quietly vanishing from the retry.
    setRehydrateIds(failedIds);
    setStage('pick');
  };

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.id,
        label: employee.employeeCode
          ? `${employee.fullName} (${employee.employeeCode})`
          : employee.fullName,
      })),
    [employees]
  );

  /** Failures lead: the point of the report is what still needs doing. */
  const orderedOutcomes = useMemo(() => {
    if (!result) return [];
    return [...result.outcomes].sort(
      (a, b) => Number(isFailure(b.outcome)) - Number(isFailure(a.outcome))
    );
  }, [result]);

  const labelFor = (outcome: IBulkAssignOutcome) =>
    // The server withholds the code on NotFound so a cross-tenant id cannot be probed;
    // the client still has the row it picked, so the operator sees a name either way.
    outcome.assetCode || basket.get(outcome.assetId)?.assetCode || '—';

  return (
    <Modal
      isOpen={isOpen}
      /*
       * Escape, the backdrop and the X all route here. While a batch is committing the
       * report is the only record of which assets were issued, so dismissing mid-flight
       * would destroy it — the assets stay assigned and the operator never learns which.
       */
      onClose={saving ? () => undefined : onClose}
      showCloseBtn={!saving}
      size="5xl"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-secondaryColor">
              {stage === 'pick' ? 'Assign Assets' : 'Handover Report'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {stage === 'pick'
                ? 'Issue any number of assets to one person in a single handover.'
                : `${result?.employeeName ?? ''} — ${result?.requested ?? 0} asset(s) submitted.`}
            </p>
          </div>
          {stage === 'pick' && selectedCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primarycolor/10 px-3 py-1 text-sm font-semibold text-primarycolor">
              {selectedCount} selected
              <button
                type="button"
                className="text-xs font-medium underline"
                onClick={() => setBasket(new Map())}
              >
                clear
              </button>
            </span>
          )}
        </div>

        {indeterminate && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              We could not confirm what happened.
            </p>
            <p className="text-xs text-amber-700/80 mt-0.5">
              The request did not come back with a report. Assets are issued one at a time,
              so some of this batch may already be assigned — close this and check the list
              before submitting it again.
            </p>
          </div>
        )}

        {stage === 'pick' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Assign to"
                required
                options={employeeOptions}
                placeholder="Select an employee"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
              <Input
                label="Assignment date"
                type="date"
                value={assignmentDate}
                onChange={(e) => setAssignmentDate(e.target.value)}
                helperText="Defaults to today"
              />
            </div>

            <button
              type="button"
              className="mt-3 text-xs font-medium text-primarycolor hover:underline"
              onClick={() => setShowDetails((v) => !v)}
            >
              {showDetails ? 'Hide handover details' : 'Add handover details (optional)'}
            </button>

            {showDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 rounded-2xl bg-gray-50 p-4">
                <Input
                  label="Expected return date"
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                />
                <Select
                  label="Condition at issue"
                  options={ASSET_CONDITIONS.map((c) => ({ value: c.id, label: c.name }))}
                  placeholder="Keep each asset's own condition"
                  value={conditionAtIssueId}
                  onChange={(e) => setConditionAtIssueId(e.target.value)}
                />
                <Input
                  label="Accessories"
                  placeholder="Charger, bag, cable"
                  value={accessories}
                  onChange={(e) => setAccessories(e.target.value)}
                />
                <TextArea
                  label="Handover notes"
                  rows={2}
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                />
                <p className="sm:col-span-2 text-[11px] text-gray-500 -mt-1">
                  These apply to every asset in this handover.
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-5 mb-2">
              <div className="flex-1 min-w-[220px]">
                <Input
                  placeholder="Search by code, name, serial or tag…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-4 accent-primarycolor"
                  checked={showBlocked}
                  onChange={(e) => setShowBlocked(e.target.checked)}
                />
                Show assets that cannot be issued
              </label>
              {rehydrateIds.length > 0 && (
                <button
                  type="button"
                  className="text-xs font-medium text-primarycolor hover:underline"
                  onClick={() => setRehydrateIds([])}
                >
                  Back to all assets
                </button>
              )}
            </div>

            <div className="rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 border-b border-gray-100">
                <input
                  type="checkbox"
                  className="size-4 accent-primarycolor"
                  checked={allPageSelected}
                  onChange={togglePage}
                  disabled={eligibleOnPage.length === 0}
                  aria-label="Select all assets on this page"
                />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Asset
                </span>
                <span className="ml-auto text-[11px] text-gray-400 tabular-nums">
                  {loadingAssets ? 'Loading…' : `${assets.length} of ${rowCount}`}
                </span>
              </div>

              <div className="max-h-[280px] overflow-y-auto divide-y divide-gray-50">
                {!loadingAssets && assets.length === 0 && loadError && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-semibold text-amber-800">{loadError}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      This is not the same as having no assets — we could not read the list.
                    </p>
                    <button
                      type="button"
                      className="text-xs font-medium text-primarycolor hover:underline mt-2"
                      onClick={loadAssets}
                    >
                      Try again
                    </button>
                  </div>
                )}

                {!loadingAssets && assets.length === 0 && !loadError && (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm text-gray-500">
                      {search
                        ? 'No assets match that search.'
                        : 'No assets are ready to be issued.'}
                    </p>
                    {!showBlocked && (
                      <button
                        type="button"
                        className="text-xs font-medium text-primarycolor hover:underline mt-2"
                        onClick={() => setShowBlocked(true)}
                      >
                        Show assets that cannot be issued, and why →
                      </button>
                    )}
                  </div>
                )}

                {assets.map((asset) => {
                  const checked = basket.has(asset.id);
                  return (
                    <label
                      key={asset.id}
                      className={`flex items-center gap-3 px-4 py-2.5 ${
                        asset.eligible
                          ? 'cursor-pointer hover:bg-hoverColor'
                          : 'cursor-not-allowed bg-gray-50/60'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primarycolor shrink-0"
                        checked={checked}
                        disabled={!asset.eligible}
                        onChange={() => toggle(asset)}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-semibold truncate ${
                            asset.eligible ? 'text-secondaryColor' : 'text-gray-400'
                          }`}
                        >
                          {asset.assetCode} · {asset.assetName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {asset.assetCategoryName}
                          {asset.serialNumber ? ` · ${asset.serialNumber}` : ''}
                          {asset.assetLocationName ? ` · ${asset.assetLocationName}` : ''}
                        </p>
                        {!asset.eligible && asset.blockedReason && (
                          <p className="text-xs text-amber-700 mt-0.5">{asset.blockedReason}</p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {asset.conditionName}
                      </span>
                    </label>
                  );
                })}
              </div>

              {rowCount > assets.length && (
                <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
                  Showing the first {assets.length}. Search to narrow the list — your
                  selection is kept as you search.
                </p>
              )}
            </div>

            {formError && <p className="text-sm text-red-600 mt-3">{formError}</p>}

            <div className="flex justify-end gap-3 mt-5">
              <Button variant="secondary" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving || selectedCount === 0}>
                {saving
                  ? 'Assigning…'
                  : `Assign ${selectedCount || ''} asset${selectedCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-green-50 px-3 py-2.5 text-center">
                <p className="text-2xl font-bold leading-none text-green-700 tabular-nums">
                  {result?.assigned ?? 0}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Assigned</p>
              </div>
              <div className="rounded-xl bg-sky-50 px-3 py-2.5 text-center">
                <p className="text-2xl font-bold leading-none text-sky-700 tabular-nums">
                  {result?.alreadyAssigned ?? 0}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Already held</p>
              </div>
              <div
                className={`rounded-xl px-3 py-2.5 text-center ${
                  (result?.failed ?? 0) > 0 ? 'bg-amber-50' : 'bg-gray-50'
                }`}
              >
                <p
                  className={`text-2xl font-bold leading-none tabular-nums ${
                    (result?.failed ?? 0) > 0 ? 'text-amber-700' : 'text-gray-300'
                  }`}
                >
                  {result?.failed ?? 0}
                </p>
                <p className="text-[11px] text-gray-500 mt-1">Not issued</p>
              </div>
            </div>

            <ul className="max-h-[320px] overflow-y-auto space-y-2">
              {orderedOutcomes.map((outcome) => {
                const style = OUTCOME_STYLES[outcome.outcome];
                return (
                  <li
                    key={outcome.assetId}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${style.row}`}
                  >
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.chip}`}
                    >
                      {style.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-secondaryColor truncate">
                        {labelFor(outcome)}
                      </p>
                      <p className="text-xs text-gray-500">{outcome.message}</p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex justify-end gap-3 mt-5">
              {(result?.failed ?? 0) > 0 && (
                <Button variant="outline" onClick={retryFailed}>
                  Review the {result?.failed} not issued
                </Button>
              )}
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default BulkAssignModal;
