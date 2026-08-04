'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import { IAsset, ICreateAsset, IUpdateAsset } from '@/interface/IAsset';
import { IAssetCategory } from '@/interface/IAssetCategory';
import { IAssetLocation } from '@/interface/IAssetLocation';
import { IVendor } from '@/interface/IVendor';
import { createAsset, updateAsset } from '@/services/asset.service';
import { fetchAssetCategories } from '@/services/assetCategory.service';
import { fetchAssetLocations } from '@/services/assetLocation.service';
import { fetchVendors } from '@/services/vendor.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import {
  ASSET_CONDITIONS,
  enumOptions,
  OWNERSHIP_LABELS,
  OwnershipTypeEnum,
} from '@/enum/assetEnums';

type TFormErrors = Partial<
  Record<
    'assetName' | 'assetCategoryId' | 'assetConditionTypeId' | 'quantity',
    string
  >
>;

/** ISO datetime from the API → value an <input type="date"> accepts. */
const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

/**
 * Shared registration/edit form. Without an `asset` prop it registers a new
 * asset (condition is a create-only field); with one it edits it — AssetCode
 * is shown read-only, condition/statuses are hidden (workflow-owned) and the
 * PUT round-trips the rowVersion per the concurrency contract.
 */
const AssetForm = ({ asset }: { asset?: IAsset }) => {
  const isEdit = !!asset;
  const router = useRouter();
  const { addToast } = useToast();

  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [vendors, setVendors] = useState<IVendor[]>([]);
  const [locations, setLocations] = useState<IAssetLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<TFormErrors>({});

  const [form, setForm] = useState({
    assetName: asset?.assetName ?? '',
    assetCategoryId: asset?.assetCategoryId ?? '',
    assetConditionTypeId: '',
    assetLocationId: asset?.assetLocationId ?? '',
    quantity: '1',
    assetTag: asset?.assetTag ?? '',
    serialNumber: asset?.serialNumber ?? '',
    manufacturer: asset?.manufacturer ?? '',
    brand: asset?.brand ?? '',
    model: asset?.model ?? '',
    ownershipType: String(asset?.ownershipType ?? OwnershipTypeEnum.Owned),
    supplierId: asset?.supplierId ?? '',
    purchaseDate: toDateInput(asset?.purchaseDate),
    purchaseCost: asset?.purchaseCost != null ? String(asset.purchaseCost) : '',
    currencyId: asset?.currencyId ?? '',
    invoiceNumber: asset?.invoiceNumber ?? '',
    purchaseOrderReference: asset?.purchaseOrderReference ?? '',
    receiptDate: toDateInput(asset?.receiptDate),
    commissioningDate: toDateInput(asset?.commissioningDate),
    placedInServiceDate: toDateInput(asset?.placedInServiceDate),
    warrantyStartDate: toDateInput(asset?.warrantyStartDate),
    warrantyEndDate: toDateInput(asset?.warrantyEndDate),
    insurancePolicyNumber: asset?.insurancePolicyNumber ?? '',
    insuranceExpiryDate: toDateInput(asset?.insuranceExpiryDate),
    description: asset?.description ?? '',
    notes: asset?.notes ?? '',
  });

  useEffect(() => {
    fetchAssetCategories({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setCategories(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchVendors({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setVendors(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    fetchAssetLocations({ pageNumber: 1, pageSize: 500, isActive: true })
      .then((res) => {
        if (res?.success) setLocations(unwrapPaged(res).items);
      })
      .catch(() => undefined);
  }, []);

  // Keep an edited asset's current (possibly deactivated) location selectable.
  const locationOptions = useMemo(() => {
    const options = locations.map((l) => ({ value: l.id, label: l.name }));
    if (
      asset?.assetLocationId &&
      !locations.some((l) => l.id === asset.assetLocationId)
    ) {
      options.push({
        value: asset.assetLocationId,
        label: asset.assetLocationName ?? 'Current location',
      });
    }
    return options;
  }, [locations, asset]);

  // Keep an edited asset's current (possibly deactivated) supplier selectable.
  const vendorOptions = useMemo(() => {
    const options = vendors.map((v) => ({ value: v.id, label: v.name }));
    if (
      asset?.supplierId &&
      !vendors.some((v) => v.id === asset.supplierId)
    ) {
      options.push({
        value: asset.supplierId,
        label: asset.supplierName ?? 'Current supplier',
      });
    }
    return options;
  }, [vendors, asset]);

  const set =
    (key: keyof typeof form) =>
    (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const sharedFields = () => ({
    assetName: form.assetName.trim(),
    assetCategoryId: form.assetCategoryId,
    assetLocationId: form.assetLocationId || undefined,
    assetTag: form.assetTag.trim() || undefined,
    serialNumber: form.serialNumber.trim() || undefined,
    manufacturer: form.manufacturer.trim() || undefined,
    brand: form.brand.trim() || undefined,
    model: form.model.trim() || undefined,
    ownershipType: Number(form.ownershipType) as OwnershipTypeEnum,
    supplierId: form.supplierId || undefined,
    purchaseDate: form.purchaseDate || undefined,
    purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
    currencyId: form.currencyId.trim().toUpperCase() || undefined,
    invoiceNumber: form.invoiceNumber.trim() || undefined,
    purchaseOrderReference: form.purchaseOrderReference.trim() || undefined,
    receiptDate: form.receiptDate || undefined,
    commissioningDate: form.commissioningDate || undefined,
    placedInServiceDate: form.placedInServiceDate || undefined,
    warrantyStartDate: form.warrantyStartDate || undefined,
    warrantyEndDate: form.warrantyEndDate || undefined,
    insurancePolicyNumber: form.insurancePolicyNumber.trim() || undefined,
    insuranceExpiryDate: form.insuranceExpiryDate || undefined,
    description: form.description.trim() || undefined,
    notes: form.notes.trim() || undefined,
  });

  const handleCreate = async () => {
    const payload: ICreateAsset = {
      ...sharedFields(),
      assetConditionTypeId: form.assetConditionTypeId,
      quantity: Number(form.quantity) || 1,
    };
    const res = await createAsset(payload);
    if (res?.success) {
      addToast.success(res.message || 'Asset registered successfully');
      router.push(res.data ? `/assets/${res.data}` : '/assets');
    } else {
      addToast.error(res?.message || 'Failed to register the asset');
    }
  };

  const handleUpdate = async () => {
    if (!asset?.rowVersion) return;
    const payload: IUpdateAsset = {
      ...sharedFields(),
      // Not rendered here — round-trip unchanged so the save never clears them.
      assetClassId: asset.assetClassId ?? undefined,
      assetTypeId: asset.assetTypeId ?? undefined,
      branchId: asset.branchId ?? undefined,
      departmentId: asset.departmentId ?? undefined,
      parentAssetId: asset.parentAssetId ?? undefined,
      rowVersion: asset.rowVersion,
    };
    const res = await updateAsset(asset.id, payload);
    if (res?.success) {
      addToast.success(res.message || 'Asset updated successfully');
      router.push(`/assets/${asset.id}`);
    } else if (res?.statusCode === 409) {
      // Stale rowVersion or duplicate tag/serial — the message says which.
      addToast.error(
        res?.message ||
          'This asset was modified by someone else — reload the page and try again'
      );
    } else {
      addToast.error(res?.message || 'Failed to update the asset');
    }
  };

  const handleSave = async () => {
    const nextErrors: TFormErrors = {};
    if (!form.assetName.trim()) nextErrors.assetName = 'Asset name is required';
    if (!form.assetCategoryId)
      nextErrors.assetCategoryId = 'Category is required';
    if (!isEdit && !form.assetConditionTypeId)
      nextErrors.assetConditionTypeId = 'Condition is required';
    if (!isEdit) {
      const quantity = Number(form.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50)
        nextErrors.quantity = 'Units must be a whole number from 1 to 50';
      else if (
        quantity > 1 &&
        (form.assetTag.trim() || form.serialNumber.trim())
      )
        nextErrors.quantity =
          'Multiple units cannot share a tag or serial — leave them blank and set them per unit afterwards';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await handleUpdate();
      } else {
        await handleCreate();
      }
    } catch (error) {
      console.error('Error saving asset:', error);
      addToast.error(
        isEdit
          ? 'An error occurred while updating the asset'
          : 'An error occurred while registering the asset'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 mt-2 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-secondaryColor">
          {isEdit ? `Edit Asset — ${asset.assetCode}` : 'Register Asset'}
        </h1>
        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-primarycolor"
        >
          <i className="icon icon-left text-xs mr-1" /> Back
        </button>
      </div>

      <div className="bg-white rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Identification
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
          {isEdit && (
            <Input
              label="Asset Code"
              value={asset.assetCode}
              disabled
              readOnly
              helperText="Generated at registration — immutable"
            />
          )}
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
          {!isEdit && (
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
          )}
          <Select
            label="Ownership"
            options={enumOptions(OWNERSHIP_LABELS).map((o) => ({
              value: String(o.value),
              label: o.label,
            }))}
            value={form.ownershipType}
            onChange={set('ownershipType')}
          />
          <Select
            label="Location"
            placeholder="Select location (optional)"
            options={locationOptions}
            value={form.assetLocationId}
            onChange={set('assetLocationId')}
          />
          {!isEdit && (
            <Input
              label="Units"
              type="number"
              value={form.quantity}
              onChange={set('quantity')}
              error={errors.quantity}
              helperText="Each unit is registered as its own asset with its own code, so units can be assigned to different people."
            />
          )}
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
          <Select
            label="Supplier"
            placeholder="Select supplier (optional)"
            options={vendorOptions}
            value={form.supplierId}
            onChange={set('supplierId')}
          />
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
            label="Receipt Date"
            type="date"
            value={form.receiptDate}
            onChange={set('receiptDate')}
          />
          <Input
            label="Commissioning Date"
            type="date"
            value={form.commissioningDate}
            onChange={set('commissioningDate')}
          />
          <Input
            label="Placed In Service"
            type="date"
            value={form.placedInServiceDate}
            onChange={set('placedInServiceDate')}
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
          <Input
            label="Insurance Policy No."
            value={form.insurancePolicyNumber}
            onChange={set('insurancePolicyNumber')}
          />
          <Input
            label="Insurance Expiry"
            type="date"
            value={form.insuranceExpiryDate}
            onChange={set('insuranceExpiryDate')}
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
            {saving
              ? isEdit
                ? 'Saving…'
                : 'Registering…'
              : isEdit
                ? 'Save Changes'
                : 'Register Asset'}
          </Button>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          {isEdit
            ? 'The asset code is immutable. Condition and lifecycle/custody statuses are managed by their workflows (assignments, transfers, activate/retire) and cannot be edited here.'
            : "The asset code is generated automatically from your company's code configuration and cannot be changed after registration. New assets start in Draft lifecycle."}
        </p>
      </div>
    </div>
  );
};

export default AssetForm;
