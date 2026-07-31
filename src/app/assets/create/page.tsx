'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import { ICreateAsset } from '@/interface/IAsset';
import { IAssetCategory } from '@/interface/IAssetCategory';
import { createAsset } from '@/services/asset.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import {
  ASSET_CONDITIONS,
  enumOptions,
  OWNERSHIP_LABELS,
  OwnershipTypeEnum,
} from '@/enum/assetEnums';

type TFormErrors = Partial<Record<'assetName' | 'assetCategoryId' | 'assetConditionTypeId', string>>;

const CreateAssetPage = () => {
  const router = useRouter();
  const { addToast } = useToast();

  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<TFormErrors>({});

  const [form, setForm] = useState({
    assetName: '',
    assetCategoryId: '',
    assetConditionTypeId: '',
    assetTag: '',
    serialNumber: '',
    manufacturer: '',
    brand: '',
    model: '',
    ownershipType: String(OwnershipTypeEnum.Owned),
    purchaseDate: '',
    purchaseCost: '',
    currencyId: '',
    invoiceNumber: '',
    purchaseOrderReference: '',
    warrantyStartDate: '',
    warrantyEndDate: '',
    description: '',
    notes: '',
  });

  useEffect(() => {
    fetchAssetCategories({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setCategories(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  }, []);

  const set = (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const handleSave = async () => {
    const nextErrors: TFormErrors = {};
    if (!form.assetName.trim()) nextErrors.assetName = 'Asset name is required';
    if (!form.assetCategoryId) nextErrors.assetCategoryId = 'Category is required';
    if (!form.assetConditionTypeId)
      nextErrors.assetConditionTypeId = 'Condition is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      const payload: ICreateAsset = {
        assetName: form.assetName.trim(),
        assetCategoryId: form.assetCategoryId,
        assetConditionTypeId: form.assetConditionTypeId,
        assetTag: form.assetTag.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        brand: form.brand.trim() || undefined,
        model: form.model.trim() || undefined,
        ownershipType: Number(form.ownershipType) as OwnershipTypeEnum,
        purchaseDate: form.purchaseDate || undefined,
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
        currencyId: form.currencyId.trim().toUpperCase() || undefined,
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        purchaseOrderReference:
          form.purchaseOrderReference.trim() || undefined,
        warrantyStartDate: form.warrantyStartDate || undefined,
        warrantyEndDate: form.warrantyEndDate || undefined,
        description: form.description.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      const res = await createAsset(payload);
      if (res?.success) {
        addToast.success(res.message || 'Asset registered successfully');
        router.push(res.data ? `/assets/${res.data}` : '/assets');
      } else {
        addToast.error(res?.message || 'Failed to register the asset');
      }
    } catch (error) {
      console.error('Error creating asset:', error);
      addToast.error('An error occurred while registering the asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 mt-2 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-secondaryColor">
          Register Asset
        </h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-primarycolor"
        >
          <i className="icon icon-arrow-left text-xs mr-1" /> Back
        </button>
      </div>

      <div className="bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Identification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Input
            label="Asset Name"
            required
            value={form.assetName}
            onChange={set('assetName')}
            error={errors.assetName}
          />
          <Select
            label="Category"
            required
            placeholder="Select category"
            options={categories.map((c) => ({
              value: c.id,
              label: `${c.categoryCode} — ${c.name}`,
            }))}
            value={form.assetCategoryId}
            onChange={set('assetCategoryId')}
            error={errors.assetCategoryId}
          />
          <Select
            label="Condition"
            required
            placeholder="Select condition"
            options={ASSET_CONDITIONS.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            value={form.assetConditionTypeId}
            onChange={set('assetConditionTypeId')}
            error={errors.assetConditionTypeId}
          />
          <Select
            label="Ownership"
            options={enumOptions(OWNERSHIP_LABELS).map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
            value={form.ownershipType}
            onChange={set('ownershipType')}
          />
          <Input
            label="Asset Tag"
            value={form.assetTag}
            onChange={set('assetTag')}
            placeholder="Physical label id (optional)"
          />
          <Input
            label="Serial Number"
            value={form.serialNumber}
            onChange={set('serialNumber')}
          />
          <Input
            label="Manufacturer"
            value={form.manufacturer}
            onChange={set('manufacturer')}
          />
          <Input label="Brand" value={form.brand} onChange={set('brand')} />
          <Input label="Model" value={form.model} onChange={set('model')} />
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-8 mb-4">
          Purchase & warranty
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          <Input
            label="Purchase Date"
            type="date"
            value={form.purchaseDate}
            onChange={set('purchaseDate')}
          />
          <Input
            label="Purchase Cost"
            type="number"
            value={form.purchaseCost}
            onChange={set('purchaseCost')}
            placeholder="Informational — the asset book is authoritative"
          />
          <Input
            label="Currency (ISO code)"
            value={form.currencyId}
            onChange={set('currencyId')}
            placeholder="e.g. NPR"
            maxLength={3}
          />
          <Input
            label="Invoice Number"
            value={form.invoiceNumber}
            onChange={set('invoiceNumber')}
          />
          <Input
            label="PO Reference"
            value={form.purchaseOrderReference}
            onChange={set('purchaseOrderReference')}
          />
          <Input
            label="Warranty Start"
            type="date"
            value={form.warrantyStartDate}
            onChange={set('warrantyStartDate')}
          />
          <Input
            label="Warranty End"
            type="date"
            value={form.warrantyEndDate}
            onChange={set('warrantyEndDate')}
          />
        </div>

        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mt-8 mb-4">
          Details
        </h2>
        <div className="grid grid-cols-1 gap-y-5">
          <TextArea
            label="Description"
            value={form.description}
            onChange={set('description')}
            rows={3}
          />
          <TextArea
            label="Notes"
            value={form.notes}
            onChange={set('notes')}
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <Button variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Registering…' : 'Register Asset'}
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          The asset code is generated automatically from your company&apos;s code
          configuration and cannot be changed after registration. New assets
          start in Draft lifecycle.
        </p>
      </div>
    </div>
  );
};

export default CreateAssetPage;
