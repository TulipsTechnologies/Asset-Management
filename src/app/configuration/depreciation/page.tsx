'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import {
  ICapitalizationPolicy,
  IDepreciationAccountMapping,
  IFiscalPeriod,
  IFiscalYear,
  IUpsertFiscalPeriod,
} from '@/interface/IDepreciation';
import { IAssetCategory } from '@/interface/IAssetCategory';
import {
  closePeriod,
  createAccountMapping,
  createCapitalizationPolicy,
  createFiscalYear,
  deleteAccountMapping,
  fetchAccountMappings,
  fetchCapitalizationPolicies,
  fetchFiscalPeriods,
  fetchFiscalYears,
  reopenPeriod,
  updateAccountMapping,
} from '@/services/depreciation.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import {
  FiscalPeriodStatusEnum,
  PERIOD_STATUS_LABELS,
} from '@/enum/depreciationEnums';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

/** Bikram Sambat month names, Shrawan first — the fiscal year's fixed order. */
const BS_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baisakh', 'Jestha', 'Ashadh',
];

type TMappingForm = {
  assetCategoryId: string;
  depreciationExpenseAccount: string;
  accumulatedDepreciationAccount: string;
  assetCostAccount: string;
  disposalProceedsAccount: string;
  disposalGainAccount: string;
  disposalLossAccount: string;
  notes: string;
};

const emptyMappingForm: TMappingForm = {
  assetCategoryId: '',
  depreciationExpenseAccount: '',
  accumulatedDepreciationAccount: '',
  assetCostAccount: '',
  disposalProceedsAccount: '',
  disposalGainAccount: '',
  disposalLossAccount: '',
  notes: '',
};

export default function DepreciationConfigurationPage() {
  const { addToast } = useToast();

  const [policies, setPolicies] = useState<ICapitalizationPolicy[]>([]);
  const [years, setYears] = useState<IFiscalYear[]>([]);
  const [periods, setPeriods] = useState<IFiscalPeriod[]>([]);
  const [selectedYearId, setSelectedYearId] = useState('');
  const [mappings, setMappings] = useState<IDepreciationAccountMapping[]>([]);
  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [saving, setSaving] = useState(false);

  // Policy modal
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    capitalizationThreshold: '',
    currencyId: 'NPR',
    effectiveFrom: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  // Fiscal year modal
  const [yearOpen, setYearOpen] = useState(false);
  const [yearForm, setYearForm] = useState({ code: '', startDate: '' });
  const [periodDrafts, setPeriodDrafts] = useState<IUpsertFiscalPeriod[]>([]);

  // Mapping modal + delete confirm
  const [mappingOpen, setMappingOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<IDepreciationAccountMapping | null>(null);
  const [mappingForm, setMappingForm] = useState<TMappingForm>(emptyMappingForm);
  const [deletingMapping, setDeletingMapping] = useState<IDepreciationAccountMapping | null>(null);

  // Period close/reopen
  const [closing, setClosing] = useState<IFiscalPeriod | null>(null);
  const [reopening, setReopening] = useState<IFiscalPeriod | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [policyResponse, yearResponse, mappingResponse, categoryResponse] = await Promise.all([
        fetchCapitalizationPolicies(),
        fetchFiscalYears(),
        fetchAccountMappings(),
        fetchAssetCategories({ pageNumber: 1, pageSize: 200 }),
      ]);
      setPolicies(policyResponse?.data ?? []);
      setYears(yearResponse?.data ?? []);
      setMappings(mappingResponse?.data ?? []);
      setCategories(unwrapPaged<IAssetCategory>(categoryResponse).items);
    } catch {
      addToast.error('Could not load depreciation configuration.');
    }
  }, [addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPeriods = useCallback(async (yearId: string) => {
    if (!yearId) {
      setPeriods([]);
      return;
    }
    try {
      const response = await fetchFiscalPeriods({ pageNumber: 1, pageSize: 20, fiscalYearId: yearId });
      setPeriods(
        unwrapPaged<IFiscalPeriod>(response).items.sort((a, b) => a.periodOrdinal - b.periodOrdinal)
      );
    } catch {
      addToast.error('Could not load the periods.');
    }
  }, [addToast]);

  useEffect(() => {
    loadPeriods(selectedYearId);
  }, [selectedYearId, loadPeriods]);

  // ---------------------------------------------------------------- actions

  const submitPolicy = async () => {
    setSaving(true);
    try {
      const response = await createCapitalizationPolicy({
        capitalizationThreshold: Number(policyForm.capitalizationThreshold || 0),
        currencyId: policyForm.currencyId.trim().toUpperCase(),
        effectiveFrom: policyForm.effectiveFrom,
        notes: policyForm.notes || undefined,
      });
      if (response?.success) addToast.success(response.message || 'Policy set.');
      else addToast.error(response?.message || 'Could not save the policy.');
    } catch {
      addToast.error('Could not save the policy.');
    } finally {
      setSaving(false);
      setPolicyOpen(false);
      load();
    }
  };

  const openYearModal = () => {
    setYearForm({ code: '', startDate: '' });
    setPeriodDrafts([]);
    setYearOpen(true);
  };

  /**
   * Pre-fills 12 period drafts from the year start using 30/31-day alternation as a
   * STARTING POINT ONLY — real Bikram Sambat month lengths (29–32 days) come from the
   * published patro, which is why every date stays editable. The backend never generates
   * periods for the same reason.
   */
  const draftPeriods = () => {
    if (!yearForm.startDate) {
      addToast.error('Pick the fiscal year start date first.');
      return;
    }
    const drafts: IUpsertFiscalPeriod[] = [];
    let cursor = new Date(yearForm.startDate);
    for (let i = 0; i < 12; i++) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setDate(end.getDate() + (i % 2 === 0 ? 31 : 30) - 1);
      drafts.push({
        periodOrdinal: i + 1,
        monthName: BS_MONTHS[i],
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      });
      cursor = new Date(end);
      cursor.setDate(cursor.getDate() + 1);
    }
    setPeriodDrafts(drafts);
  };

  const submitYear = async () => {
    if (!yearForm.code || periodDrafts.length !== 12) {
      addToast.error('A year code and all 12 periods are required.');
      return;
    }
    setSaving(true);
    try {
      const response = await createFiscalYear({
        code: yearForm.code.trim(),
        startDate: periodDrafts[0].startDate,
        endDate: periodDrafts[11].endDate,
        isActive: true,
        periods: periodDrafts,
      });
      if (response?.success) addToast.success(response.message || 'Fiscal year created.');
      else addToast.error(response?.message || 'Could not create the fiscal year.');
    } catch {
      addToast.error('Could not create the fiscal year.');
    } finally {
      setSaving(false);
      setYearOpen(false);
      load();
    }
  };

  const openMappingModal = (mapping?: IDepreciationAccountMapping) => {
    setEditingMapping(mapping ?? null);
    setMappingForm(
      mapping
        ? {
            assetCategoryId: mapping.assetCategoryId ?? '',
            depreciationExpenseAccount: mapping.depreciationExpenseAccount,
            accumulatedDepreciationAccount: mapping.accumulatedDepreciationAccount,
            assetCostAccount: mapping.assetCostAccount ?? '',
            disposalProceedsAccount: mapping.disposalProceedsAccount ?? '',
            disposalGainAccount: mapping.disposalGainAccount ?? '',
            disposalLossAccount: mapping.disposalLossAccount ?? '',
            notes: mapping.notes ?? '',
          }
        : emptyMappingForm
    );
    setMappingOpen(true);
  };

  const submitMapping = async () => {
    if (!mappingForm.depreciationExpenseAccount || !mappingForm.accumulatedDepreciationAccount) {
      addToast.error('The expense and accumulated depreciation accounts are required.');
      return;
    }
    setSaving(true);
    const payload = {
      assetCategoryId: mappingForm.assetCategoryId || null,
      depreciationExpenseAccount: mappingForm.depreciationExpenseAccount.trim(),
      accumulatedDepreciationAccount: mappingForm.accumulatedDepreciationAccount.trim(),
      assetCostAccount: mappingForm.assetCostAccount.trim() || undefined,
      disposalProceedsAccount: mappingForm.disposalProceedsAccount.trim() || undefined,
      disposalGainAccount: mappingForm.disposalGainAccount.trim() || undefined,
      disposalLossAccount: mappingForm.disposalLossAccount.trim() || undefined,
      notes: mappingForm.notes || undefined,
    };
    try {
      const response = editingMapping
        ? await updateAccountMapping(editingMapping.id, { ...payload, rowVersion: editingMapping.rowVersion })
        : await createAccountMapping(payload);
      if (response?.success) addToast.success(response.message || 'Mapping saved.');
      else addToast.error(response?.message || 'Could not save the mapping.');
    } catch {
      addToast.error('Could not save the mapping.');
    } finally {
      setSaving(false);
      setMappingOpen(false);
      load();
    }
  };

  const submitDeleteMapping = async () => {
    if (!deletingMapping) return;
    setSaving(true);
    try {
      const response = await deleteAccountMapping(deletingMapping.id);
      if (response?.success) addToast.success(response.message || 'Mapping deleted.');
      else addToast.error(response?.message || 'Could not delete the mapping.');
    } catch {
      addToast.error('Could not delete the mapping.');
    } finally {
      setSaving(false);
      setDeletingMapping(null);
      load();
    }
  };

  const submitClose = async () => {
    if (!closing) return;
    setSaving(true);
    try {
      const response = await closePeriod(closing.id, closing.rowVersion);
      if (response?.success) addToast.success(response.message || 'Period closed.');
      else addToast.error(response?.message || 'Could not close the period.');
    } catch {
      addToast.error('Could not close the period.');
    } finally {
      setSaving(false);
      setClosing(null);
      loadPeriods(selectedYearId);
    }
  };

  const submitReopen = async () => {
    if (!reopening) return;
    if (!reopenReason.trim()) {
      addToast.error('A reason is required to reopen a period.');
      return;
    }
    setSaving(true);
    try {
      const response = await reopenPeriod(reopening.id, reopening.rowVersion, reopenReason.trim());
      if (response?.success) addToast.success(response.message || 'Period reopened.');
      else addToast.error(response?.message || 'Could not reopen the period.');
    } catch {
      addToast.error('Could not reopen the period.');
    } finally {
      setSaving(false);
      setReopening(null);
      setReopenReason('');
      loadPeriods(selectedYearId);
    }
  };

  const updateDraft = (index: number, field: 'startDate' | 'endDate' | 'monthName', value: string) =>
    setPeriodDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, [field]: value } : d)));

  // ---------------------------------------------------------------- render

  const effectivePolicy = policies[0];

  return (
    <div className="p-4 max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold text-gray-800">Depreciation Settings</h1>
      <p className="mb-5 text-sm text-gray-500">
        The fiscal calendar, capitalization policy and GL account mappings that depreciation
        runs and disposal journals depend on.
      </p>

      {/* ------------------------------------------------ policy */}
      <section className="mb-6 rounded border border-gray-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Capitalization Policy</h2>
          <Button onClick={() => setPolicyOpen(true)}>Set Policy</Button>
        </div>
        {effectivePolicy ? (
          <p className="text-sm text-gray-600">
            Threshold{' '}
            <strong>
              {effectivePolicy.capitalizationThreshold.toLocaleString()} {effectivePolicy.currencyId.trim()}
            </strong>{' '}
            · base currency <strong>{effectivePolicy.currencyId.trim()}</strong> · effective{' '}
            {formatDate(effectivePolicy.effectiveFrom)}. Assets at or above the threshold
            default to capital; the currency pins every asset book.
          </p>
        ) : (
          <p className="text-sm text-amber-700">
            No policy configured — capitalization is refused until the threshold and base
            currency are set.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ fiscal years */}
      <section className="mb-6 rounded border border-gray-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">Fiscal Calendar</h2>
          <Button onClick={openYearModal}>New Fiscal Year</Button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Bikram Sambat months run 29–32 days and cannot be generated — each year is seeded
          from the published patro. Seeding a new year automatically extends every book&apos;s
          depreciation schedule into it.
        </p>

        {years.length === 0 && (
          <p className="text-sm text-amber-700">
            No fiscal year seeded — capitalization and depreciation runs are blocked until one is.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {years.map((year) => (
            <button
              key={year.id}
              type="button"
              onClick={() => setSelectedYearId(year.id === selectedYearId ? '' : year.id)}
              className={`rounded border px-3 py-1.5 text-sm ${
                selectedYearId === year.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {year.code}
              <span className="ml-2 text-xs text-gray-500">
                {year.openPeriodCount}/{year.periodCount} open
              </span>
              {year.isMirrored && (
                <span className="ml-2 rounded bg-blue-50 px-1.5 text-[10px] text-blue-700">HRM</span>
              )}
            </button>
          ))}
        </div>

        {selectedYearId && periods.length > 0 && (
          <table className="mt-4 w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-500">{period.periodOrdinal}</td>
                  <td className="px-3 py-2 font-medium">{period.monthName}</td>
                  <td className="px-3 py-2">{formatDate(period.startDate)}</td>
                  <td className="px-3 py-2">{formatDate(period.endDate)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        period.status === FiscalPeriodStatusEnum.Open
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {PERIOD_STATUS_LABELS[period.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {period.status === FiscalPeriodStatusEnum.Open ? (
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setClosing(period)}
                      >
                        Close
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-amber-700 hover:underline"
                        onClick={() => {
                          setReopening(period);
                          setReopenReason('');
                        }}
                      >
                        Reopen
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------------------------------------ account mappings */}
      <section className="mb-6 rounded border border-gray-200 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">GL Account Mappings</h2>
          <Button onClick={() => openMappingModal()}>New Mapping</Button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          A run cannot be approved until every asset&apos;s category resolves to a mapping
          (its own, or the company default). Disposal journals additionally need the cost,
          proceeds and gain/loss accounts.
        </p>

        {mappings.length === 0 && (
          <p className="text-sm text-amber-700">No mappings — depreciation runs cannot be approved.</p>
        )}

        {mappings.length > 0 && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">Scope</th>
                <th className="px-3 py-2">Expense</th>
                <th className="px-3 py-2">Accumulated</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Proceeds</th>
                <th className="px-3 py-2">Gain / Loss</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium">
                    {mapping.assetCategoryName ?? 'Company default'}
                  </td>
                  <td className="px-3 py-2">{mapping.depreciationExpenseAccount}</td>
                  <td className="px-3 py-2">{mapping.accumulatedDepreciationAccount}</td>
                  <td className="px-3 py-2">{mapping.assetCostAccount ?? '—'}</td>
                  <td className="px-3 py-2">{mapping.disposalProceedsAccount ?? '—'}</td>
                  <td className="px-3 py-2">
                    {mapping.disposalGainAccount ?? '—'} / {mapping.disposalLossAccount ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      className="mr-3 text-xs text-primary hover:underline"
                      onClick={() => openMappingModal(mapping)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setDeletingMapping(mapping)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ------------------------------------------------ policy modal */}
      <Modal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} size="lg">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Capitalization Policy</h2>
          <p className="mb-4 text-xs text-gray-500">
            The previous policy is retired, not overwritten. The currency cannot change while
            capitalized assets are on the register.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Threshold"
              type="number"
              required
              value={policyForm.capitalizationThreshold}
              onChange={(e) =>
                setPolicyForm((prev) => ({ ...prev, capitalizationThreshold: e.target.value }))
              }
            />
            <Input
              label="Base Currency"
              required
              value={policyForm.currencyId}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, currencyId: e.target.value }))}
            />
            <Input
              label="Effective From"
              type="date"
              required
              value={policyForm.effectiveFrom}
              onChange={(e) => setPolicyForm((prev) => ({ ...prev, effectiveFrom: e.target.value }))}
            />
          </div>
          <TextArea
            label="Notes"
            value={policyForm.notes}
            onChange={(e) => setPolicyForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="mt-4"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPolicyOpen(false)}>Cancel</Button>
            <Button onClick={submitPolicy} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------ fiscal year modal */}
      <Modal isOpen={yearOpen} onClose={() => setYearOpen(false)} size="3xl">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">New Fiscal Year</h2>
          <p className="mb-4 text-xs text-gray-500">
            Dates prefill with a 30/31-day alternation as a starting point — correct each
            month against the published patro before saving. Month lengths of 29–32 days are
            all legitimate.
          </p>
          <div className="grid grid-cols-3 items-end gap-4">
            <Input
              label="Year Code"
              placeholder="2084/85"
              required
              value={yearForm.code}
              onChange={(e) => setYearForm((prev) => ({ ...prev, code: e.target.value }))}
            />
            <Input
              label="Shrawan 1 (start date)"
              type="date"
              required
              value={yearForm.startDate}
              onChange={(e) => setYearForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
            <Button variant="secondary" onClick={draftPeriods}>Prefill 12 Months</Button>
          </div>

          {periodDrafts.length > 0 && (
            <div className="mt-4 max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                  <tr>
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Month</th>
                    <th className="px-2 py-2">From</th>
                    <th className="px-2 py-2">To</th>
                  </tr>
                </thead>
                <tbody>
                  {periodDrafts.map((draft, index) => (
                    <tr key={draft.periodOrdinal} className="border-b border-gray-100">
                      <td className="px-2 py-1 text-gray-500">{draft.periodOrdinal}</td>
                      <td className="px-2 py-1">
                        <Input
                          value={draft.monthName}
                          onChange={(e) => updateDraft(index, 'monthName', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="date"
                          value={draft.startDate}
                          onChange={(e) => updateDraft(index, 'startDate', e.target.value)}
                        />
                      </td>
                      <td className="px-2 py-1">
                        <Input
                          type="date"
                          value={draft.endDate}
                          onChange={(e) => updateDraft(index, 'endDate', e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setYearOpen(false)}>Cancel</Button>
            <Button onClick={submitYear} disabled={saving || periodDrafts.length !== 12}>
              {saving ? 'Creating…' : 'Create Year'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------ mapping modal */}
      <Modal isOpen={mappingOpen} onClose={() => setMappingOpen(false)} size="2xl">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">
            {editingMapping ? 'Edit Mapping' : 'New Mapping'}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Proceeds must have their own account — debiting them against the cost account
            would leave part of a disposed asset&apos;s cost on the balance sheet.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Scope"
              value={mappingForm.assetCategoryId}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, assetCategoryId: e.target.value }))
              }
              options={[
                { label: 'Company default', value: '' },
                ...categories.map((c) => ({ label: c.name, value: c.id })),
              ]}
              disabled={!!editingMapping}
            />
            <div />
            <Input
              label="Depreciation Expense Account"
              required
              value={mappingForm.depreciationExpenseAccount}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, depreciationExpenseAccount: e.target.value }))
              }
            />
            <Input
              label="Accumulated Depreciation Account"
              required
              value={mappingForm.accumulatedDepreciationAccount}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, accumulatedDepreciationAccount: e.target.value }))
              }
            />
            <Input
              label="Asset Cost Account"
              value={mappingForm.assetCostAccount}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, assetCostAccount: e.target.value }))
              }
              helperText="Needed for disposal derecognition."
            />
            <Input
              label="Disposal Proceeds Account"
              value={mappingForm.disposalProceedsAccount}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, disposalProceedsAccount: e.target.value }))
              }
              helperText="Cash/receivable clearing — required when disposals record proceeds."
            />
            <Input
              label="Disposal Gain Account"
              value={mappingForm.disposalGainAccount}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, disposalGainAccount: e.target.value }))
              }
            />
            <Input
              label="Disposal Loss Account"
              value={mappingForm.disposalLossAccount}
              onChange={(e) =>
                setMappingForm((prev) => ({ ...prev, disposalLossAccount: e.target.value }))
              }
            />
          </div>
          <TextArea
            label="Notes"
            value={mappingForm.notes}
            onChange={(e) => setMappingForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="mt-4"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMappingOpen(false)}>Cancel</Button>
            <Button onClick={submitMapping} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------ reopen modal */}
      <Modal isOpen={!!reopening} onClose={() => setReopening(null)} size="lg">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">
            Reopen {reopening?.fiscalYearCode} · {reopening?.monthName}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Reopening is an escape hatch for a run posted minutes ago — only the most
            recently closed period qualifies, and never after its proposals have gone to
            Finance. Backdated corrections belong in the current open period as catch-up.
          </p>
          <TextArea
            label="Reason"
            required
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReopening(null)}>Cancel</Button>
            <Button onClick={submitReopen} disabled={saving}>{saving ? 'Reopening…' : 'Reopen'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmationModal
        isOpen={!!closing}
        message={`Close ${closing?.fiscalYearCode} · ${closing?.monthName}? Depreciation can no longer post into it, and every depreciating book must already have a schedule row for it.`}
        loading={saving}
        onConfirm={submitClose}
        onClose={() => setClosing(null)}
      />

      <ConfirmationModal
        isOpen={!!deletingMapping}
        message={`Delete the ${deletingMapping?.assetCategoryName ?? 'company default'} mapping? Runs cannot be approved while a category has no resolvable mapping.`}
        loading={saving}
        onConfirm={submitDeleteMapping}
        onClose={() => setDeletingMapping(null)}
      />
    </div>
  );
}
