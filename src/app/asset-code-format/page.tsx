'use client';

import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import ToggleSwitch from '@/components/UI/ToggleSwitch';
import {
  IAssetCodeConfiguration,
  SequenceScopeEnum,
} from '@/interface/IAssetCodeConfiguration';
import {
  fetchAssetCodeConfiguration,
  saveAssetCodeConfiguration,
} from '@/services/assetCodeConfiguration.service';

type TFormState = {
  prefix: string;
  includeCategoryToken: boolean;
  includeYearToken: boolean;
  sequencePadding: string;
  sequenceScope: SequenceScopeEnum;
  separator: string;
};

const SEPARATORS = [
  { value: '-', label: 'Dash (-)' },
  { value: '_', label: 'Underscore (_)' },
  { value: '.', label: 'Dot (.)' },
  { value: '/', label: 'Slash (/)' },
  { value: '', label: 'None' },
];

/** Client-side twin of the server composer — cosmetic live preview only. */
const composeExample = (form: TFormState, sampleCategory: string): string => {
  const padding = Math.min(10, Math.max(1, Number(form.sequencePadding) || 1));
  const parts = [form.prefix || 'AST'];
  if (form.includeCategoryToken) parts.push(sampleCategory);
  if (form.includeYearToken) parts.push(String(new Date().getFullYear()));
  parts.push('1'.padStart(padding, '0'));
  return parts.join(form.separator);
};

const AssetCodeFormatPage = () => {
  const { addToast } = useToast();

  const [config, setConfig] = useState<IAssetCodeConfiguration | null>(null);
  const [form, setForm] = useState<TFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetCodeConfiguration();
      if (res?.success && res.data) {
        setConfig(res.data);
        setForm({
          prefix: res.data.prefix,
          includeCategoryToken: res.data.includeCategoryToken,
          includeYearToken: res.data.includeYearToken,
          sequencePadding: String(res.data.sequencePadding),
          sequenceScope: res.data.sequenceScope,
          separator: res.data.separator,
        });
      } else {
        addToast.error(res?.message || 'Failed to load the asset code format');
      }
    } catch (error) {
      console.error('Error loading the asset code format:', error);
      addToast.error('An error occurred while loading the asset code format');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (changes: Partial<TFormState>) => {
    setFormError('');
    setForm((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...changes };
      // Per-category numbering without the category in the code would print
      // identical codes for different categories — the API refuses it, so the
      // form keeps the pair consistent instead of offering a doomed save.
      if (next.sequenceScope === SequenceScopeEnum.PerCompanyAndCategory)
        next.includeCategoryToken = true;
      return next;
    });
  };

  const handleSave = async () => {
    if (!form) return;
    const prefix = form.prefix.trim().toUpperCase();
    if (!/^[A-Z0-9]{1,10}$/.test(prefix)) {
      setFormError('Prefix must be 1–10 letters or digits');
      return;
    }
    const padding = Number(form.sequencePadding);
    if (!Number.isInteger(padding) || padding < 1 || padding > 10) {
      setFormError('Padding must be a whole number from 1 to 10');
      return;
    }
    setSaving(true);
    try {
      const res = await saveAssetCodeConfiguration({
        prefix,
        includeCategoryToken: form.includeCategoryToken,
        includeYearToken: form.includeYearToken,
        sequencePadding: padding,
        sequenceScope: form.sequenceScope,
        separator: form.separator,
        rowVersion: config?.rowVersion ?? undefined,
      });
      if (res?.success) {
        addToast.success(res.message || 'Asset code format saved');
      } else {
        // Validation and conflicts alike: show the server's reason and reload —
        // a stale rowVersion must never be retried as-is.
        addToast.error(res?.message || 'Failed to save the asset code format');
      }
    } catch (error) {
      console.error('Error saving the asset code format:', error);
      addToast.error('An error occurred while saving the asset code format');
    } finally {
      setSaving(false);
      load();
    }
  };

  const sampleCategory = config?.longestCategoryCode || 'IT';
  const preview = form ? composeExample(form, sampleCategory) : '';
  const previewTooLong = !!config && preview.length > config.maxCodeLength;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-secondaryColor">
        Asset Code Format
      </h1>
      <p className="text-sm text-gray-500 mt-1">
        The pattern for codes assigned at registration. Changes apply to codes
        generated from now on — existing codes are printed on labels and never
        change.
      </p>

      {loading || !form ? (
        <p className="text-sm text-gray-400 mt-8">Loading…</p>
      ) : (
        <>
          {/* Live example */}
          <div className="mt-6 rounded-lg border border-gray-100 bg-gray-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Example
            </p>
            <p
              className={`mt-1 font-mono text-2xl ${
                previewTooLong ? 'text-red-600' : 'text-secondaryColor'
              }`}
            >
              {preview}
            </p>
            {previewTooLong && (
              <p className="text-xs text-red-600 mt-1">
                {preview.length} characters — codes longer than{' '}
                {config?.maxCodeLength} cannot be stored.
              </p>
            )}
            {!config?.isPersisted && (
              <p className="text-xs text-gray-400 mt-1">
                This company currently uses the built-in default format.
              </p>
            )}
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            <Input
              label="Prefix"
              required
              value={form.prefix}
              onChange={(e) => update({ prefix: e.target.value.toUpperCase() })}
              placeholder="e.g. AST"
              maxLength={10}
              error={formError}
            />
            <Select
              label="Separator"
              options={SEPARATORS}
              value={form.separator}
              onChange={(e) => update({ separator: e.target.value })}
            />
            <Input
              label="Sequence Padding"
              type="number"
              required
              value={form.sequencePadding}
              onChange={(e) => update({ sequencePadding: e.target.value })}
              helperText="Digits the running number is padded to (1–10); it widens by itself beyond that."
            />
            <Select
              label="Numbering"
              options={[
                {
                  value: String(SequenceScopeEnum.PerCompany),
                  label: 'One sequence for the whole company',
                },
                {
                  value: String(SequenceScopeEnum.PerCompanyAndCategory),
                  label: 'A sequence per category',
                },
              ]}
              value={String(form.sequenceScope)}
              onChange={(e) =>
                update({ sequenceScope: Number(e.target.value) })
              }
            />
            <ToggleSwitch
              label="Include category code"
              checked={form.includeCategoryToken}
              disabled={
                form.sequenceScope === SequenceScopeEnum.PerCompanyAndCategory
              }
              onChange={(e) =>
                update({ includeCategoryToken: e.target.checked })
              }
            />
            <ToggleSwitch
              label="Include year"
              checked={form.includeYearToken}
              onChange={(e) => update({ includeYearToken: e.target.checked })}
            />
          </div>

          {form.sequenceScope === SequenceScopeEnum.PerCompanyAndCategory && (
            <p className="text-xs text-gray-400 mt-3">
              Per-category numbering requires the category code in the format —
              without it, different categories would print identical codes.
            </p>
          )}

          <div className="flex justify-end gap-3 mt-8">
            <Button variant="secondary" onClick={load} disabled={saving}>
              Reset
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Format'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default AssetCodeFormatPage;
