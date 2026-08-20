'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import ReasonBanner from '@/components/UI/ReasonBanner';
import { Panel, PanelBox, Row } from '@/components/UI/FormLayout';
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
  enumOptions,
  OWNERSHIP_LABELS,
  OwnershipTypeEnum,
} from '@/enum/assetEnums';
import useAssetConditions from '@/hooks/useAssetConditions';

type TFormErrors = Partial<
  Record<
    'assetName' | 'assetCategoryId' | 'assetConditionTypeId' | 'quantity',
    string
  >
>;

/** ISO datetime from the API → value an <input type="date"> accepts. */
const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '');

/** The optional clusters, each a collapsible panel with a filled-count badge. */
const SECTION_FIELDS = {
  tracking: [
    'assetTag',
    'serialNumber',
    'manufacturer',
    'brand',
    'model',
    'dimension',
  ] as const,
  purchase: [
    'supplierId',
    'purchaseDate',
    'purchaseCost',
    'currencyId',
    'invoiceNumber',
    'purchaseOrderReference',
    'receiptDate',
  ] as const,
  service: [
    'commissioningDate',
    'placedInServiceDate',
    'warrantyStartDate',
    'warrantyEndDate',
    'insurancePolicyNumber',
    'insuranceExpiryDate',
  ] as const,
  notes: ['description', 'notes'] as const,
};

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

  // The asset's OWN condition rides along via includeId, so an asset graded at a condition
  // the company has since deactivated still shows its real grade rather than a blank.
  const {
    options: conditionOptions,
    emptyText: conditionEmptyText,
    nameById: conditionNameById,
  } = useAssetConditions(asset?.assetConditionTypeId);

  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [vendors, setVendors] = useState<IVendor[]>([]);
  const [locations, setLocations] = useState<IAssetLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<TFormErrors>({});
  // Server-side refusal shown persistently above the footer — a toast alone is
  // too transient for a 409 whose message the operator must read and act on.
  const [failure, setFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

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
    dimension: asset?.dimension ?? '',
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

  // Which panels start open: identity always; on create the common registration
  // clusters; on edit whichever clusters already hold data (computed once —
  // typing must not snap sections open or shut under the user's cursor).
  const [sections, setSections] = useState(() => {
    const hasAny = (keys: readonly (keyof typeof form)[]) =>
      keys.some((key) => String(form[key]).trim() !== '');
    return {
      identity: true,
      tracking: isEdit ? hasAny(SECTION_FIELDS.tracking) : true,
      purchase: isEdit ? hasAny(SECTION_FIELDS.purchase) : true,
      service: hasAny(SECTION_FIELDS.service),
      notes: hasAny(SECTION_FIELDS.notes),
      summary: true,
      readiness: true,
      guidance: true,
    };
  });
  const toggle = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

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

  // ------------------------------------------------------- side rail feeds

  const filledCount = (keys: readonly (keyof typeof form)[]) =>
    keys.filter((key) => String(form[key]).trim() !== '').length;

  const selectedCategory = categories.find(
    (c) => c.id === form.assetCategoryId
  );
  const conditionName = conditionNameById(form.assetConditionTypeId);
  const ownershipLabel = enumOptions(OWNERSHIP_LABELS).find(
    (o) => String(o.value) === form.ownershipType
  )?.label;
  const locationName = locationOptions.find(
    (o) => o.value === form.assetLocationId
  )?.label;
  const supplierName = vendorOptions.find(
    (o) => o.value === form.supplierId
  )?.label;
  const costDisplay = form.purchaseCost
    ? `${Number(form.purchaseCost).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${form.currencyId.trim() ? ` ${form.currencyId.trim().toUpperCase()}` : ''}`
    : null;

  const multiUnitTagClash =
    !isEdit &&
    Number(form.quantity) > 1 &&
    !!(form.assetTag.trim() || form.serialNumber.trim());

  const outstanding: string[] = [];
  if (!form.assetName.trim()) outstanding.push('Asset name is required');
  if (!form.assetCategoryId) outstanding.push('Category is required');
  if (!isEdit && !form.assetConditionTypeId)
    outstanding.push('Condition is required');

  const advisories: string[] = [];
  if (multiUnitTagClash)
    advisories.push(
      'Multiple units cannot share a tag or serial — leave them blank and set them per unit afterwards.'
    );
  if (
    form.warrantyStartDate &&
    form.warrantyEndDate &&
    form.warrantyEndDate < form.warrantyStartDate
  )
    advisories.push('Warranty end date is before its start.');
  if (form.currencyId.trim() && form.currencyId.trim().length !== 3)
    advisories.push('Currency should be a 3-letter ISO code, e.g. NPR.');

  const ready = outstanding.length === 0;

  // ------------------------------------------------------------ submission

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
    dimension: form.dimension.trim() || undefined,
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
      setFailure({
        code: res?.reasonCode,
        message: res?.message || 'Failed to register the asset',
      });
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
      const message =
        res?.message ||
        'This asset was modified by someone else — reload the page and try again';
      addToast.error(message);
      setFailure({ code: res?.reasonCode, message });
    } else {
      addToast.error(res?.message || 'Failed to update the asset');
      setFailure({
        code: res?.reasonCode,
        message: res?.message || 'Failed to update the asset',
      });
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
      else if (multiUnitTagClash)
        nextErrors.quantity =
          'Multiple units cannot share a tag or serial — leave them blank and set them per unit afterwards';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      // Every required field lives in Identity — make sure it is visible; the
      // units/tag clash also points at fields in the tracking section.
      setSections((prev) => ({
        ...prev,
        identity: true,
        tracking: prev.tracking || multiUnitTagClash,
      }));
      return;
    }

    setSaving(true);
    setFailure(null);
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

  // ---------------------------------------------------------------- render

  const grid = 'grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2';
  // Deterministic Back/Cancel — router.back() would leave the app when the
  // page was opened from a deep link. Same targets a successful save uses.
  const backUrl = isEdit ? `/assets/${asset.id}` : '/assets';

  return (
    <div className="mt-2 max-w-[1400px] px-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-y-2">
        <div>
          <h1 className="text-lg font-semibold text-secondaryColor">
            {isEdit ? `Edit Asset — ${asset.assetCode}` : 'Add Asset'}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {isEdit
              ? 'Descriptive and purchase details of the asset. Lifecycle, custody and financials are managed by their own workflows.'
              : 'Registers the asset and assigns its code. Only name, category and condition are needed to start — the rest can be filled in any time.'}
          </p>
        </div>
        <button
          onClick={() => router.push(backUrl)}
          className="text-sm text-gray-500 hover:text-primarycolor"
        >
          <i className="icon icon-left mr-1 text-xs" /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------------ form */}
        <div className="space-y-4">
          <Panel
            title="Asset Identity"
            icon="clipboard"
            open={sections.identity}
            onToggle={() => toggle('identity')}
          >
            <div className={grid}>
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
                  options={conditionOptions}
                  emptyText={conditionEmptyText}
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
            </div>
          </Panel>

          <Panel
            title="Identification & Tracking"
            icon="search"
            badge={`${filledCount(SECTION_FIELDS.tracking)}/${SECTION_FIELDS.tracking.length}`}
            open={sections.tracking}
            onToggle={() => toggle('tracking')}
          >
            <div className={grid}>
              <Input
                label="Asset Tag"
                value={form.assetTag}
                onChange={set('assetTag')}
                helperText="Physical label id (optional)"
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
              <Input
                label="Dimension"
                value={form.dimension}
                onChange={set('dimension')}
                helperText="Physical size, e.g. 39.5in L, 39.5in W, 16in H"
              />
            </div>
          </Panel>

          <Panel
            title="Purchase & Supplier"
            icon="briefcase"
            badge={`${filledCount(SECTION_FIELDS.purchase)}/${SECTION_FIELDS.purchase.length}`}
            open={sections.purchase}
            onToggle={() => toggle('purchase')}
          >
            <div className={grid}>
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
                helperText="Informational — the asset book is authoritative"
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
            </div>
          </Panel>

          <Panel
            title="Service, Warranty & Insurance"
            icon="calendar"
            badge={`${filledCount(SECTION_FIELDS.service)}/${SECTION_FIELDS.service.length}`}
            open={sections.service}
            onToggle={() => toggle('service')}
          >
            <div className={grid}>
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
          </Panel>

          <Panel
            title="Description & Notes"
            icon="file"
            badge={`${filledCount(SECTION_FIELDS.notes)}/${SECTION_FIELDS.notes.length}`}
            open={sections.notes}
            onToggle={() => toggle('notes')}
          >
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
          </Panel>

          {failure && (
            <ReasonBanner
              code={failure.code}
              message={failure.message}
              severity="error"
            />
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="secondary" onClick={() => router.push(backUrl)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving
                ? isEdit
                  ? 'Saving…'
                  : 'Adding…'
                : isEdit
                  ? 'Save Changes'
                  : 'Add Asset'}
            </Button>
          </div>
        </div>

        {/* --------------------------------------------------- side panels */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <Panel
            title="Summary"
            icon="info"
            open={sections.summary}
            onToggle={() => toggle('summary')}
          >
            <PanelBox>
              {isEdit && <Row label="Asset code" value={asset.assetCode} />}
              <Row label="Name" value={form.assetName.trim() || null} />
              <Row
                label="Category"
                value={
                  selectedCategory
                    ? `${selectedCategory.categoryCode} — ${selectedCategory.name}`
                    : null
                }
              />
              {!isEdit && <Row label="Condition" value={conditionName ?? null} />}
              <Row label="Ownership" value={ownershipLabel ?? null} />
              <Row label="Location" value={locationName ?? null} />
              {!isEdit && <Row label="Units" value={form.quantity || null} />}
              <Row label="Supplier" value={supplierName ?? null} />
              <Row label="Purchase cost" value={costDisplay} />
              <Row label="Purchase date" value={form.purchaseDate || null} />
            </PanelBox>
          </Panel>

          <Panel
            title="Readiness"
            icon={ready ? 'check-circle' : 'alert'}
            iconClass={
              ready
                ? 'text-primarycolor border-primarycolor/30 bg-primarycolor/5'
                : 'text-red-500 border-red-200 bg-red-50'
            }
            open={sections.readiness}
            onToggle={() => toggle('readiness')}
          >
            <PanelBox>
              {ready ? (
                <p className="flex items-center gap-2 py-1 text-sm text-primarycolor">
                  <i className="icon icon-check-circle text-xs" />
                  Ready to {isEdit ? 'save' : 'add'}.
                </p>
              ) : (
                <ul className="space-y-1.5 py-0.5">
                  {outstanding.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-gray-700"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              )}

              {advisories.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                  {advisories.map((note) => (
                    <li
                      key={note}
                      className="flex items-start gap-2 text-xs text-amber-700"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </PanelBox>
          </Panel>

          <Panel
            title="How This Works"
            icon="documents"
            open={sections.guidance}
            onToggle={() => toggle('guidance')}
          >
            <PanelBox>
              <ul className="space-y-2 py-0.5">
                {(isEdit
                  ? [
                      'The asset code is immutable.',
                      'Condition and lifecycle/custody statuses are managed by their workflows (assignments, transfers, activate/retire) and cannot be edited here.',
                      'Purchase cost here is informational — the asset book set up under Depreciation is the authoritative cost record.',
                    ]
                  : [
                      "The asset code is generated automatically from your company's code configuration and cannot be changed after registration.",
                      'New assets start in the Draft lifecycle.',
                      'Each unit is registered as its own asset with its own code.',
                      'Purchase cost here is informational — the asset book set up under Depreciation is the authoritative cost record.',
                    ]
                ).map((note) => (
                  <li
                    key={note}
                    className="flex items-start gap-2 text-xs text-gray-600"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                    {note}
                  </li>
                ))}
              </ul>
            </PanelBox>
          </Panel>
        </aside>
      </div>
    </div>
  );
};

export default AssetForm;
