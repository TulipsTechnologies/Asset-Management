'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Modal from '@/components/UI/Modal';
import TextArea from '@/components/UI/TextArea';
import AssetDocumentsSection from './_components/AssetDocumentsSection';
import ProfileHeader from '@/components/UI/ProfileHeader';
import PageToolbar from '@/components/UI/PageToolbar';
import InfoCard, { InfoCardGrid, InfoField } from '@/components/UI/InfoCard';
import AssetDepreciationSection from './_components/AssetDepreciationSection';
import AssetTaxProfileSection from './_components/AssetTaxProfileSection';
import AssetCoverageSection from './_components/AssetCoverageSection';
import { Permission } from '@/enum/permissions';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { IAsset } from '@/interface/IAsset';
import { IAssetAssignment } from '@/interface/IAssetAssignment';
import {
  activateAsset,
  fetchAssetById,
  retireAsset,
} from '@/services/asset.service';
import { fetchAssetAssignments } from '@/services/assetAssignment.service';
import {
  recommissionAsset,
  releaseAsset,
} from '@/services/maintenance.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import {
  CUSTODY_BADGE_CLASSES,
  CUSTODY_LABELS,
  FINANCIAL_LABELS,
  LIFECYCLE_BADGE_CLASSES,
  LIFECYCLE_LABELS,
  LifecycleStatusEnum,
  OPERATIONAL_LABELS,
  OperationalStatusEnum,
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

/** Nepal standard VAT. Display-only — the register stores net prices. */
const VAT_RATE = 0.13;

const fmtMoney = (value?: number | null, currency?: string | null) =>
  value != null
    ? `${currency ? `${currency} ` : ''}${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : null;

/** Release lifts a Quarantined hold; recommission brings back an OutOfService asset. */
type THoldAction = 'release' | 'recommission';

const HOLD_COPY: Record<
  THoldAction,
  { title: string; blurb: string; confirm: string }
> = {
  release: {
    title: 'Release Asset',
    blurb:
      'Lifts the Quarantined hold and puts the asset back to Operational. Custody is untouched — a released asset stays Unassigned until the assignment workflow issues it.',
    confirm: 'Release',
  },
  recommission: {
    title: 'Recommission Asset',
    blurb:
      'Returns an Out of Service asset to Operational. Together with release this is the only audited exit from a hold, so a reason is required.',
    confirm: 'Recommission',
  },
};

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

const AssetDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { addToast } = useToast();
  const { can } = useUserPermissions();

  const [asset, setAsset] = useState<IAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<IAssetAssignment[]>([]);
  const [activating, setActivating] = useState(false);
  const [retireOpen, setRetireOpen] = useState(false);
  const [retireReason, setRetireReason] = useState('');
  const [retiring, setRetiring] = useState(false);
  // Release / recommission modal (the only audited exits from a hold)
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'documents'>('overview');
  const [holdAction, setHoldAction] = useState<THoldAction | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [holdSaving, setHoldSaving] = useState(false);

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

  const handleHold = async () => {
    if (!asset?.rowVersion || !holdAction || !holdReason.trim() || holdSaving)
      return;
    setHoldSaving(true);
    try {
      const payload = {
        reason: holdReason.trim(),
        rowVersion: asset.rowVersion,
      };
      const res =
        holdAction === 'release'
          ? await releaseAsset(asset.id, payload)
          : await recommissionAsset(asset.id, payload);
      if (res?.success) {
        addToast.success(
          res.message ||
            (holdAction === 'release'
              ? 'Asset released'
              : 'Asset recommissioned')
        );
      } else {
        // 400 on the wrong verb for the current hold, 409 on a stale
        // rowVersion — both messages say which; show them verbatim.
        addToast.error(res?.message || 'Failed to lift the hold');
      }
    } catch (error) {
      console.error('Error lifting the asset hold:', error);
      addToast.error('An error occurred while lifting the hold');
    } finally {
      // Close and reload either way so a retry starts from a fresh RowVersion.
      setHoldSaving(false);
      setHoldAction(null);
      setHoldReason('');
      loadAsset();
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
    <div className="px-4 sm:px-6 py-5">
      <PageToolbar
        actions={
          <>
            {asset.lifecycleStatus !== LifecycleStatusEnum.Disposed && (
              <Button
                variant="toolbar"
                onClick={() => router.push(`/assets/${asset.id}/edit`)}
              >
                <i className="icon icon-edit text-xs"></i>
                <span>Edit</span>
              </Button>
            )}
            {(asset.lifecycleStatus === LifecycleStatusEnum.Draft ||
              asset.lifecycleStatus === LifecycleStatusEnum.Retired) && (
              <Button
                variant="toolbar"
                onClick={handleActivate}
                disabled={activating}
              >
                <i className="icon icon-check-circle text-xs"></i>
                <span>{activating ? 'Activating…' : 'Activate'}</span>
              </Button>
            )}
            {asset.operationalStatus === OperationalStatusEnum.Quarantined && (
              <Button
                variant="toolbar"
                onClick={() => {
                  setHoldReason('');
                  setHoldAction('release');
                }}
              >
                <i className="icon icon-unlock text-xs"></i>
                <span>Release</span>
              </Button>
            )}
            {asset.operationalStatus === OperationalStatusEnum.OutOfService && (
              <Button
                variant="toolbar"
                onClick={() => {
                  setHoldReason('');
                  setHoldAction('recommission');
                }}
              >
                <i className="icon icon-redo text-xs"></i>
                <span>Recommission</span>
              </Button>
            )}
            {asset.lifecycleStatus === LifecycleStatusEnum.Active && (
              <Button
                variant="toolbarDanger"
                onClick={() => {
                  setRetireReason('');
                  setRetireOpen(true);
                }}
              >
                <i className="icon icon-lock text-xs"></i>
                <span>Retire</span>
              </Button>
            )}
          </>
        }
      />
      <ProfileHeader
        fallback={<i className="icon icon-briefcase text-2xl"></i>}
        title={asset.assetCode}
        titleBadges={
          <Badge
            label={LIFECYCLE_LABELS[asset.lifecycleStatus]}
            className={LIFECYCLE_BADGE_CLASSES[asset.lifecycleStatus]}
          />
        }
        subtitle={[asset.assetCategoryName, asset.assetName]
          .filter(Boolean)
          .join(' • ')}
        chips={
          <div className="flex flex-wrap items-center gap-1.5">
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
        }
        rightSlot={
          <div>
            <p className="text-xs text-gray-400">Purchase Cost</p>
            {asset.purchaseCost != null ? (
              <p className="text-sm font-semibold text-secondaryColor">
                {asset.currencyId ? `${asset.currencyId} ` : ''}
                {asset.purchaseCost.toLocaleString()}
              </p>
            ) : (
              <p className="text-sm italic text-gray-400">Not recorded</p>
            )}
          </div>
        }
      />

      <div className="flex gap-1 border-b border-gray-200 mb-5 overflow-x-auto">
        {(
          [
            { key: 'overview', label: 'Overview' },
            { key: 'assignments', label: 'Assignments' },
            { key: 'documents', label: 'Documents' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeTab === tab.key
                ? 'border-primarycolor text-primarycolor font-medium'
                : 'border-transparent text-gray-500 hover:text-secondaryColor'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <InfoCardGrid className="max-w-5xl">
          <InfoCard title="Basic" icon="info">
            <InfoField label="Asset Code" icon="card" value={asset.assetCode} />
            <InfoField label="Asset Tag" icon="id" value={asset.assetTag} />
            <InfoField
              label="Category"
              icon="modules"
              value={asset.assetCategoryName}
            />
            <InfoField
              label="Serial Number"
              icon="clipboard"
              value={asset.serialNumber}
            />
            <InfoField
              label="Make / Model"
              icon="setting"
              value={[asset.manufacturer, asset.brand, asset.model]
                .filter(Boolean)
                .join(' ')}
            />
            <InfoField
              label="Dimension"
              icon="expand"
              value={asset.dimension}
            />
            <InfoField
              label="Parent Asset"
              icon="expand"
              value={asset.parentAssetCode}
            />
            <InfoField
              label="Condition"
              icon="check-circle"
              value={asset.conditionName}
            />
          </InfoCard>

          <InfoCard title="Purchase & Ownership" icon="briefcase">
            <InfoField
              label="Ownership"
              icon="company"
              value={OWNERSHIP_LABELS[asset.ownershipType]}
            />
            <InfoField
              label="Purchase Date"
              icon="calendar"
              value={formatDate(asset.purchaseDate)}
            />
            <InfoField
              label="Net Price"
              icon="cash"
              value={fmtMoney(asset.purchaseCost, asset.currencyId)}
            />
            <InfoField
              label={`Total (incl. ${VAT_RATE * 100}% VAT)`}
              icon="calculator"
              value={
                asset.purchaseCost != null
                  ? fmtMoney(
                      Math.round(asset.purchaseCost * (1 + VAT_RATE) * 100) /
                        100,
                      asset.currencyId
                    )
                  : null
              }
            />
            <InfoField
              label="Depreciation"
              icon="trend"
              value={fmtMoney(asset.accumulatedDepreciation, asset.currencyId)}
              emptyText="Not capitalized"
            />
            <InfoField
              label="Net Book Value"
              icon="wallet-plus"
              value={fmtMoney(asset.netBookValue, asset.currencyId)}
              emptyText="Not capitalized"
            />
            <InfoField
              label="Supplier"
              icon="handshake"
              value={asset.supplierName}
            />
            <InfoField
              label="Invoice / PO"
              icon="documents"
              value={[asset.invoiceNumber, asset.purchaseOrderReference]
                .filter(Boolean)
                .join(' / ')}
            />
            <InfoField
              label="Receipt Date"
              icon="inbox"
              value={formatDate(asset.receiptDate)}
            />
            <InfoField
              label="Commissioning Date"
              icon="run"
              value={formatDate(asset.commissioningDate)}
            />
            <InfoField
              label="Placed In Service"
              icon="clock-check"
              value={formatDate(asset.placedInServiceDate)}
            />
          </InfoCard>

          <AssetDepreciationSection assetId={asset.id} />

          <AssetTaxProfileSection assetId={asset.id} />

          {/* Supersedes the old summary-only card (§9): it shows warranties, policies
              and claims, and falls back to the asset's own summary dates for an asset
              that has none — so nothing that used to be visible disappeared. */}
          {/* Gated on the read permission. Without this a user on a role that lacks it
              gets a permanent red "could not be loaded" banner where the old summary card
              used to be — a 403 rendered as a fault. */}
          {can(Permission.ViewAssetCoverage, Permission.ManageAssetCoverage) && (
            <AssetCoverageSection
              assetId={asset.id}
              canManage={can(Permission.ManageAssetCoverage)}
            />
          )}

          <InfoCard title="Location & Custody" icon="marker">
            <InfoField
              label="Location"
              icon="marker"
              value={asset.assetLocationName}
            />
            <InfoField
              label="Custodian"
              icon="user-check"
              value={
                assignments.find((a) => a.status === 1)?.employeeName ??
                (asset.currentCustodianEmployeeId ? 'Assigned' : null)
              }
              emptyText="Unassigned"
            />
            <InfoField
              label="Registered On"
              icon="calendar"
              value={formatDate(asset.createdOn)}
            />
            <InfoField
              label="Last Modified"
              icon="clock"
              value={formatDate(asset.modifiedOn)}
            />
          </InfoCard>

          <InfoCard title="Notes" icon="comment">
            <div className="py-3">
              {asset.description || asset.notes ? (
                <>
                  {asset.description && (
                    <p className="text-sm text-secondaryColor whitespace-pre-wrap mb-2">
                      {asset.description}
                    </p>
                  )}
                  {asset.notes && (
                    <p className="text-sm text-gray-500 whitespace-pre-wrap">
                      {asset.notes}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm italic text-gray-400">Not provided</p>
              )}
            </div>
          </InfoCard>
        </InfoCardGrid>
      )}

      {activeTab === 'assignments' && (
        <InfoCard
          title="Assignment History"
          icon="users"
          className="max-w-5xl"
          bodyClassName="py-3"
        >
          {assignments.length === 0 ? (
            <p className="text-sm italic text-gray-400 py-3">
              Never assigned.
            </p>
          ) : (
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
          )}
        </InfoCard>
      )}

      {activeTab === 'documents' && (
        <div className="max-w-5xl">
          <AssetDocumentsSection
            assetId={asset.id}
            readOnly={asset.lifecycleStatus === LifecycleStatusEnum.Disposed}
          />
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

      {/* Release / recommission modal — reason is mandatory (design §4) */}
      <Modal
        isOpen={holdAction !== null}
        onClose={() => setHoldAction(null)}
        size="md"
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold text-secondaryColor mb-1">
            {holdAction ? HOLD_COPY[holdAction].title : ''}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            {asset.assetCode} — {asset.assetName}.{' '}
            {holdAction ? HOLD_COPY[holdAction].blurb : ''}
          </p>
          <TextArea
            label="Reason"
            required
            value={holdReason}
            onChange={(e) => setHoldReason(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Why is the hold being lifted?"
          />
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setHoldAction(null)}>
              Back
            </Button>
            <Button
              onClick={handleHold}
              disabled={!holdReason.trim() || holdSaving}
            >
              {holdSaving
                ? 'Working…'
                : holdAction
                  ? HOLD_COPY[holdAction].confirm
                  : ''}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AssetDetailPage;
