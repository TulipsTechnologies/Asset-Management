'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import BackButton from '@/components/UI/BackButton';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import ReasonBanner from '@/components/UI/ReasonBanner';
import { Panel, PanelBox } from '@/components/UI/FormLayout';
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
import { useAssetPhoto } from '@/components/Assets/assetPhoto';
import { uploadAssetDocument } from '@/services/assetDocument.service';
import { AssetDocumentTypeEnum } from '@/enum/assetDocumentEnums';

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
  const { options: conditionOptions, emptyText: conditionEmptyText } =
    useAssetConditions(asset?.assetConditionTypeId);

  const [categories, setCategories] = useState<IAssetCategory[]>([]);
  const [vendors, setVendors] = useState<IVendor[]>([]);
  const [locations, setLocations] = useState<IAssetLocation[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<TFormErrors>({});

  /**
   * The asset's picture, chosen right here in Asset Identity.
   *
   * On EDIT it uploads as soon as it is chosen — the asset exists, so there is nothing to wait
   * for. On CREATE it cannot: a document attaches to an asset id, and there is no id until the
   * asset is registered. So the file is HELD and uploaded immediately after the create returns,
   * which is why `photoFile` is state rather than a fire-and-forget call.
   *
   * A failed photo upload never fails the registration. The asset is saved either way and the
   * operator is told the picture did not attach, because losing a filled-in form over a photo
   * would be a far worse outcome than an asset with no photo yet.
   */
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const existingPhoto = useAssetPhoto(asset?.id, isEdit);
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

  // Which panels start open — the SAME on create and edit.
  //
  // Only Asset Identity is open. Every other cluster is optional and starts CLOSED, so the
  // page opens as one short form rather than a wall of ~25 mostly-empty inputs. Each closed
  // panel keeps its filled-count badge (0/6, 1/7 …), so what a section holds is visible
  // without opening it — nothing is hidden, only folded.
  //
  // Edit used to auto-open whichever clusters already held data, which meant the page you got
  // depended on the record: two assets opened to different layouts, and a well-filled one
  // opened to everything at once — the exact wall this is meant to avoid.
  const [sections, setSections] = useState({
    identity: true,
    tracking: false,
    purchase: false,
    service: false,
    notes: false,
    readiness: true,
    // Reference material, not something to read while typing — one click away.
    guidance: false,
  });
  const toggle = (key: keyof typeof sections) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  /** Attaches the chosen file to an existing asset as its primary photo. */
  const uploadPhotoFor = async (assetId: string, file: File) =>
    uploadAssetDocument(assetId, {
      documentType: AssetDocumentTypeEnum.Photo,
      isPrimaryPhoto: true,
      file,
    });

  const pickPhoto = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      addToast.error('Choose an image file.');
      return;
    }

    // Shown immediately either way, so the operator sees what they picked before any
    // round-trip. Revoked when replaced so a long editing session does not leak blobs.
    setPhotoPreview((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });

    if (!isEdit) {
      // No asset id yet — hold it and let handleCreate attach it once there is one.
      setPhotoFile(file);
      return;
    }

    setPhotoUploading(true);
    try {
      const res = await uploadPhotoFor(asset.id, file);
      if (res?.success) addToast.success('Image uploaded');
      else addToast.error(res?.message || 'Could not upload the image');
    } catch {
      addToast.error('Could not upload the image');
    } finally {
      setPhotoUploading(false);
    }
  };

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

  // (The Summary panel that read back Category / Ownership / Location / Supplier / cost was
  // removed: it restated, in a second column, values the operator had just typed and could
  // still see. Its derived lookups went with it.)

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

      // The picture chosen in Asset Identity, attached now that the asset has an id.
      // Deliberately NOT allowed to fail the registration: the asset is already saved, so a
      // photo problem is reported and the operator moves on rather than losing the form.
      if (photoFile && res.data) {
        try {
          const photoRes = await uploadPhotoFor(res.data, photoFile);
          if (!photoRes?.success) {
            addToast.error(
              'The asset was registered, but its image did not upload — add it from Edit.'
            );
          }
        } catch {
          addToast.error(
            'The asset was registered, but its image did not upload — add it from Edit.'
          );
        }
      }

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

  // 1200 rather than 1400: this is a FORM, and a field stretched across a 1400px column is
  // harder to scan, not more generous. The narrower measure also keeps the two-field rows a
  // comfortable width on a large monitor.
  return (
    <div className="mt-2 max-w-[1200px] px-4">
      {/* Back sits ABOVE the title on the left, through the shared BackButton, exactly as
          every other page in the module places it. This screen used to hand-roll its own on
          the RIGHT of the title row, which put the control in a different place depending on
          which page you were on — and on a narrow viewport it collided with the long
          "Edit Asset — PREMIER-FU-FY83/84-C-05446" heading. */}
      <BackButton className="mb-3" />
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-secondaryColor">
          {isEdit ? `Edit Asset — ${asset.assetCode}` : 'Add Asset'}
        </h1>
        <p className="mt-0.5 text-xs text-gray-500">
          {isEdit
            ? 'Descriptive and purchase details of the asset. Lifecycle, custody and financials are managed by their own workflows.'
            : 'Registers the asset and assigns its code. Only name, category and condition are needed to start — the rest can be filled in any time.'}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* ------------------------------------------------------------ form */}
        <div className="space-y-4">
          <Panel
            title="Asset Identity"
            icon="clipboard"
            open={sections.identity}
            onToggle={() => toggle('identity')}
          >
            {/* The picture sits with identity, because that is what it is: the quickest way
                to tell one chair from another. Full width above the fields so it reads as
                the record's face rather than as one more input. */}
            <div className="mb-5 flex items-center gap-4">
              <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-blue-50">
                {photoPreview || existingPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview ?? existingPhoto ?? ''}
                    alt={form.assetName.trim() || 'Asset image'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <i className="icon icon-briefcase text-2xl text-blue-600" />
                )}
              </span>

              <div className="min-w-0">
                <Button
                  variant="secondary"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                >
                  <i className="icon icon-plus text-xs" />
                  <span>
                    {photoUploading
                      ? 'Uploading…'
                      : photoPreview || existingPhoto
                        ? 'Replace image'
                        : 'Upload image'}
                  </span>
                </Button>
                <p className="mt-1.5 text-xs text-gray-500">
                  {isEdit
                    ? 'Uploaded straight away and set as the primary photo.'
                    : 'Attached automatically once the asset is registered.'}
                </p>
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-label="Upload image"
                onChange={(e) => {
                  pickPhoto(e.target.files?.[0] ?? null);
                  // Cleared so choosing the SAME file again still fires onChange.
                  e.target.value = '';
                }}
              />
            </div>

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
              <i aria-hidden="true" className="icon icon-save text-xs" />
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
