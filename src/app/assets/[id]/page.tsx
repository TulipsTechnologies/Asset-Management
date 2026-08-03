'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import TextArea from '@/components/UI/TextArea';
import AssetDocumentsSection from './_components/AssetDocumentsSection';
import { IAsset } from '@/interface/IAsset';
import { IAssetAssignment } from '@/interface/IAssetAssignment';
import {
  activateAsset,
  fetchAssetById,
  retireAsset,
} from '@/services/asset.service';
import { fetchAssetAssignments } from '@/services/assetAssignment.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import {
  CUSTODY_BADGE_CLASSES,
  CUSTODY_LABELS,
  FINANCIAL_LABELS,
  LIFECYCLE_BADGE_CLASSES,
  LIFECYCLE_LABELS,
  LifecycleStatusEnum,
  OPERATIONAL_LABELS,
  OWNERSHIP_LABELS,
  VERIFICATION_BADGE_CLASSES,
  VERIFICATION_LABELS,
} from '@/enum/assetEnums';
import {
  ASSIGNMENT_STATUS_BADGE_CLASSES,
  ASSIGNMENT_STATUS_LABELS,
} from '@/enum/assignmentEnums';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const Field = ({
  label,
  value,
}: {
  label: string;
  value?: React.ReactNode;
}) => (
  <div>
    <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
    <div className="text-sm text-secondaryColor mt-0.5">{value ?? '—'}</div>
  </div>
);

const Badge = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
      className ?? 'bg-gray-100 text-gray-700'
    }`}
  >
    {label}
  </span>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="bg-white rounded-xl p-6">
    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
      {title}
    </h2>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
      {children}
    </div>
  </div>
);

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();

  const [asset, setAsset] = useState<IAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<IAssetAssignment[]>([]);
  const [activating, setActivating] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);

  const loadAsset = useCallback(() => {
    if (!id) return;
    fetchAssetById(id)
      .then((res) => {
        if (res?.success && res.data) {
          setAsset(res.data);
        } else {
          addToast.error(res?.message || 'Asset not found');
          router.replace('/assets');
        }
      })
      .catch(() => {
        addToast.error('An error occurred while loading the asset');
        router.replace('/assets');
      })
      .finally(() => setLoading(false));

    fetchAssetAssignments({ assetId: id, pageNumber: 1, pageSize: 50 })
      .then((res) => {
        if (res?.success) setAssignments(unwrapPaged(res).items);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    loadAsset();
  }, [loadAsset]);

  const handleActivate = async () => {
    if (!asset?.rowVersion) return;
    setActivating(true);
    try {
      const res = await activateAsset(asset.id, asset.rowVersion);
      if (res?.success) {
        addToast.success(res.message || 'Asset activated');
        loadAsset();
      } else {
        addToast.error(res?.message || 'Failed to activate the asset');
      }
    } catch (error) {
      console.error('Error activating asset:', error);
      addToast.error('An error occurred while activating the asset');
    } finally {
      setActivating(false);
    }
  };

  const handleRetire = async () => {
    if (!asset?.rowVersion || retiring) return;
    setRetiring(true);
    try {
      const res = await retireAsset(
        asset.id,
        asset.rowVersion,
        retireReason.trim() || undefined
      );
      if (res?.success) {
        addToast.success(res.message || 'Asset retired');
      } else {
        // 409 carries the custody/active-transfer guard message — show verbatim.
        addToast.error(res?.message || 'Failed to retire the asset');
      }
      // Close and reload either way so a retry starts from a fresh RowVersion
      // instead of looping on the stale one (assignments-phase lesson).
      setRetireOpen(false);
      setRetireReason('');
      loadAsset();
    } catch (error) {
      console.error('Error retiring asset:', error);
      addToast.error('An error occurred while retiring the asset');
    } finally {
      setRetiring(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 mt-10 text-center text-gray-400 text-sm">
        Loading asset…
      </div>
    );
  }

  if (!asset) return null;

  return (
    <div className="px-4 mt-2 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push('/assets')}
            className="text-sm text-gray-500 hover:text-primarycolor"
          >
            <i className="icon icon-arrow-left text-xs mr-1" /> Assets
          </button>
          <h1 className="text-lg font-semibold text-secondaryColor mt-1">
            {asset.assetName}
            <span className="ml-3 text-sm font-normal text-gray-400">
              {asset.assetCode}
            </span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {asset.lifecycleStatus !== LifecycleStatusEnum.Disposed && (
            <Button
              variant="outline"
              onClick={() => router.push(`/assets/${asset.id}/edit`)}
            >
              <i className="icon icon-edit text-xs" />
              <span>Edit</span>
            </Button>
          )}
          {(asset.lifecycleStatus === LifecycleStatusEnum.Draft ||
            asset.lifecycleStatus === LifecycleStatusEnum.Retired) && (
            <Button onClick={handleActivate} disabled={activating}>
              {activating ? 'Activating…' : 'Activate'}
            </Button>
          )}
          {asset.lifecycleStatus === LifecycleStatusEnum.Active && (
            <Button
              variant="danger"
              onClick={() => {
                setRetireReason('');
                setRetireOpen(true);
              }}
            >
              Retire
            </Button>
          )}
          <Badge
            label={LIFECYCLE_LABELS[asset.lifecycleStatus]}
            className={LIFECYCLE_BADGE_CLASSES[asset.lifecycleStatus]}
          />
          <Badge
            label={CUSTODY_LABELS[asset.custodyStatus]}
            className={CUSTODY_BADGE_CLASSES[asset.custodyStatus]}
          />
          <Badge label={OPERATIONAL_LABELS[asset.operationalStatus]} />
          <Badge label={FINANCIAL_LABELS[asset.financialStatus]} />
          <Badge
            label={VERIFICATION_LABELS[asset.verificationStatus]}
            className={VERIFICATION_BADGE_CLASSES[asset.verificationStatus]}
          />
          <Badge
            label={asset.conditionName}
            className="bg-blue-50 text-blue-700"
          />
        </div>
      </div>

      <Section title="Identification">
        <Field label="Asset Code" value={asset.assetCode} />
        <Field label="Asset Tag" value={asset.assetTag || '—'} />
        <Field label="Category" value={asset.assetCategoryName} />
        <Field label="Serial Number" value={asset.serialNumber || '—'} />
        <Field label="Manufacturer" value={asset.manufacturer || '—'} />
        <Field label="Brand" value={asset.brand || '—'} />
        <Field label="Model" value={asset.model || '—'} />
        <Field
          label="Ownership"
          value={OWNERSHIP_LABELS[asset.ownershipType]}
        />
        <Field label="Parent Asset" value={asset.parentAssetCode || '—'} />
      </Section>

      <Section title="Purchase">
        <Field label="Purchase Date" value={formatDate(asset.purchaseDate)} />
        <Field
          label="Purchase Cost"
          value={
            asset.purchaseCost != null
              ? `${asset.currencyId ? `${asset.currencyId} ` : ''}${asset.purchaseCost.toLocaleString()}`
              : '—'
          }
        />
        <Field label="Supplier" value={asset.supplierName || '—'} />
        <Field label="Invoice No." value={asset.invoiceNumber || '—'} />
        <Field
          label="PO Reference"
          value={asset.purchaseOrderReference || '—'}
        />
        <Field label="Receipt Date" value={formatDate(asset.receiptDate)} />
        <Field
          label="Commissioned"
          value={formatDate(asset.commissioningDate)}
        />
        <Field
          label="Placed In Service"
          value={formatDate(asset.placedInServiceDate)}
        />
      </Section>

      <Section title="Warranty & insurance">
        <Field
          label="Warranty Start"
          value={formatDate(asset.warrantyStartDate)}
        />
        <Field label="Warranty End" value={formatDate(asset.warrantyEndDate)} />
        <Field
          label="Insurance Policy"
          value={asset.insurancePolicyNumber || '—'}
        />
        <Field
          label="Insurance Expiry"
          value={formatDate(asset.insuranceExpiryDate)}
        />
      </Section>

      <Section title="Location & custody">
        <Field label="Location" value={asset.assetLocationName || '—'} />
        <Field
          label="Custodian"
          value={
            assignments.find((a) => a.status === 1)?.employeeName ??
            (asset.currentCustodianEmployeeId ? 'Assigned' : 'Unassigned')
          }
        />
        <Field label="Registered On" value={formatDate(asset.createdOn)} />
        <Field label="Last Modified" value={formatDate(asset.modifiedOn)} />
      </Section>

      {assignments.length > 0 && (
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Assignment history
          </h2>
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm border-b border-gray-50 pb-3 last:border-0 last:pb-0"
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    ASSIGNMENT_STATUS_BADGE_CLASSES[assignment.status] ??
                    'bg-gray-100 text-gray-700'
                  }`}
                >
                  {ASSIGNMENT_STATUS_LABELS[assignment.status]}
                </span>
                <span className="font-medium text-secondaryColor">
                  {assignment.employeeName}
                </span>
                <span className="text-gray-400">
                  {formatDate(assignment.assignmentDate)}
                  {assignment.returnedDate
                    ? ` → ${formatDate(assignment.returnedDate)}`
                    : assignment.expectedReturnDate
                      ? ` (due ${formatDate(assignment.expectedReturnDate)})`
                      : ''}
                </span>
                <span className="text-gray-400">
                  {assignment.conditionAtIssueName}
                  {assignment.conditionAtReturnName
                    ? ` → ${assignment.conditionAtReturnName}`
                    : ''}
                </span>
                {assignment.returnNotes && (
                  <span className="text-xs text-gray-400 w-full">
                    {assignment.returnNotes}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AssetDocumentsSection
        assetId={asset.id}
        readOnly={asset.lifecycleStatus === LifecycleStatusEnum.Disposed}
      />

      {(asset.description || asset.notes) && (
        <div className="bg-white rounded-xl p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Details
          </h2>
          {asset.description && (
            <p className="text-sm text-secondaryColor whitespace-pre-wrap mb-3">
              {asset.description}
            </p>
          )}
          {asset.notes && (
            <p className="text-sm text-gray-500 whitespace-pre-wrap">
              {asset.notes}
            </p>
          )}
        </div>
      )}

      {/* Retire confirmation modal */}
      <Modal isOpen={retireOpen} onClose={() => setRetireOpen(false)} size="md">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            Retire Asset
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {asset.assetCode} — {asset.assetName}. Retired assets leave active
            service but keep their history and can be re-activated later.
            Assets in custody or with an active transfer cannot be retired.
          </p>
          <TextArea
            label="Reason"
            value={retireReason}
            onChange={(e) => setRetireReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Optional — end of life, replaced, obsolete…"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setRetireOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleRetire} disabled={retiring}>
              {retiring ? 'Retiring…' : 'Retire Asset'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssetDetailPage;
