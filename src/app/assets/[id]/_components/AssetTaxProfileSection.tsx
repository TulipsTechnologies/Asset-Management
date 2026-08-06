'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/UI/Button';
import InfoCard, { InfoField } from '@/components/UI/InfoCard';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import Select from '@/components/UI/Select';
import { useToast } from '@/components/Providers/ToastProvider';
import {
  IAssetTaxProfile,
  NEPAL_CLASS_RATES,
  NEPAL_TAX_CLASSES,
  TAX_ENTRY_PERIODS,
  TAX_TREATMENT_LABELS,
  TaxTreatmentEnum,
  taxEntryPeriodLabel,
} from '@/interface/ITax';
import {
  assignAssetTaxClass,
  fetchAssetTaxProfile,
  seedNepalRulePack,
} from '@/services/tax.service';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : null;

const money = (amount?: number | null) =>
  amount == null
    ? null
    : amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/**
 * The Nepal IRD tax book for this asset — a second, independent book.
 *
 * Every figure here comes from the tax engine. Nothing on this screen recomputes a rate, a
 * band or a written-down value; where the API does not expose a per-asset figure, the field
 * says so rather than deriving something that would look authoritative and be wrong.
 */
export default function AssetTaxProfileSection({ assetId }: { assetId: string }) {
  const { addToast } = useToast();

  const [profile, setProfile] = useState<IAssetTaxProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    classCode: '',
    taxYearCode: '',
    periodOrdinal: '1',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAssetTaxProfile(assetId);
      // A refusal here is the ordinary "not classified" state, not an error worth a toast.
      setProfile(response?.success ? response.data : null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  const openEditor = () => {
    setForm({
      classCode: profile?.classCode ?? '',
      taxYearCode: profile?.entryTaxYearCode ?? '',
      periodOrdinal: String(profile?.entryPeriodOrdinal ?? 1),
    });
    setFailure(null);
    setEditing(true);
  };

  const submit = async () => {
    if (saving) return;
    if (!form.classCode || !form.taxYearCode) {
      setFailure({ message: 'Pick an IRD class and a tax entry year.' });
      return;
    }

    const startYear = Number(form.taxYearCode.trim().slice(0, 4));
    if (!Number.isFinite(startYear) || startYear < 2000) {
      setFailure({
        message: 'The tax entry year must be a Bikram Sambat year such as 2083/84.',
      });
      return;
    }

    setSaving(true);
    setFailure(null);
    try {
      // The jurisdiction id has no GET endpoint; the rule-pack seed is idempotent and is
      // the only read path. When the pack exists — the normal case — nothing is created.
      const jurisdiction = await seedNepalRulePack({
        effectiveFromStartYear: startYear,
        effectiveFromTaxYear: form.taxYearCode.trim(),
      });

      if (!jurisdiction?.success || !jurisdiction.data?.id) {
        setFailure({
          code: jurisdiction?.reasonCode,
          message:
            jurisdiction?.message || 'The Nepal tax rules could not be resolved.',
        });
        return;
      }

      const response = await assignAssetTaxClass(assetId, {
        taxJurisdictionId: jurisdiction.data.id,
        taxTreatment: TaxTreatmentEnum.Pooled,
        classCode: form.classCode,
        entryTaxYearCode: form.taxYearCode.trim(),
        entryTaxStartYear: startYear,
        entryPeriodOrdinal: Number(form.periodOrdinal || 1),
        rowVersion: profile?.rowVersion ?? undefined,
      });

      if (response?.success) {
        addToast.success(response.message || 'IRD classification saved.');
        setEditing(false);
        load();
        return;
      }

      setFailure({ code: response?.reasonCode, message: response?.message });
    } catch {
      setFailure({ message: 'Could not save the IRD classification.' });
    } finally {
      setSaving(false);
    }
  };

  const action = (
    <Button variant="secondary" size="small" onClick={openEditor}>
      {profile ? 'Update' : 'Assign'}
    </Button>
  );

  return (
    <>
      <InfoCard title="Nepal IRD Tax Depreciation" icon="file" action={action}>
        {loading ? (
          <InfoField label="Tax profile" value={null} emptyText="Loading…" />
        ) : !profile ? (
          <InfoField
            label="Tax profile"
            icon="info"
            value={null}
            emptyText="This asset has no IRD classification."
          />
        ) : (
          <>
            <InfoField label="IRD Class" icon="modules" value={profile.classCode} />
            <InfoField
              label="Pool Rate"
              icon="chart"
              value={
                profile.classCode ? NEPAL_CLASS_RATES[profile.classCode] ?? null : null
              }
              emptyText="No class assigned"
            />
            <InfoField
              label="Treatment"
              icon="setting"
              value={TAX_TREATMENT_LABELS[profile.taxTreatment] ?? null}
            />
            <InfoField
              label="Tax Entry Year"
              icon="calendar"
              value={profile.entryTaxYearCode}
            />
            <InfoField
              label="Tax Entry Period"
              icon="calendar"
              value={taxEntryPeriodLabel(profile.entryPeriodOrdinal)}
            />
            <InfoField
              label="Eligible Cost"
              icon="card"
              value={money(profile.taxCostBasis)}
            />
            <InfoField
              label="Put to Use"
              icon="clock"
              value={
                formatDate(profile.putToUseDateAd) ??
                formatDate(profile.availableForUseDateAd)
              }
            />
            <InfoField
              label="Assigned Pool"
              icon="modules"
              value={
                profile.taxPoolId
                  ? profile.poolIsPerAsset
                    ? `Per-asset pool (class ${profile.classCode})`
                    : `Class ${profile.classCode} pool`
                  : null
              }
              emptyText="Not pooled yet"
            />
            <InfoField
              label="Written-Down Value"
              icon="wallet"
              value={null}
              // The API carries WDV per POOL per tax year, never per asset. Deriving an
              // asset-level figure from a pooled balance is not something the statute
              // supports, so it is named as a pool-level figure instead of invented here.
              emptyText="Pooled — see the tax run for this class"
            />
          </>
        )}
      </InfoCard>

      <Modal isOpen={editing} onClose={() => setEditing(false)} size="lg">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">
            {profile ? 'Update IRD Classification' : 'Assign IRD Classification'}
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Places the asset in a Nepal Schedule 2 pool. The class rate, the acquisition band
            and every resulting figure are the tax engine&apos;s.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="IRD Class"
              required
              value={form.classCode}
              onChange={(e) => setForm((prev) => ({ ...prev, classCode: e.target.value }))}
              options={NEPAL_TAX_CLASSES}
              placeholder="Select a class"
            />
            <Input
              label="Tax Entry Year"
              required
              value={form.taxYearCode}
              onChange={(e) => setForm((prev) => ({ ...prev, taxYearCode: e.target.value }))}
              placeholder="2083/84"
              helperText="Bikram Sambat, as 2083/84."
            />
            <Select
              label="Tax Entry Period"
              required
              value={form.periodOrdinal}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, periodOrdinal: e.target.value }))
              }
              options={TAX_ENTRY_PERIODS}
              helperText="Decides how much of the cost enters the pool this year."
            />
          </div>

          {failure && (
            <ReasonBanner
              className="mt-4"
              code={failure.code}
              message={failure.message}
              severity="error"
            />
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
