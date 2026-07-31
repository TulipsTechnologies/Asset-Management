'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import { IAsset } from '@/interface/IAsset';
import { fetchAssetById } from '@/services/asset.service';
import {
  CUSTODY_BADGE_CLASSES,
  CUSTODY_LABELS,
  FINANCIAL_LABELS,
  LIFECYCLE_BADGE_CLASSES,
  LIFECYCLE_LABELS,
  OPERATIONAL_LABELS,
  OWNERSHIP_LABELS,
  VERIFICATION_LABELS,
} from '@/enum/assetEnums';

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

  useEffect(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
        <div className="flex flex-wrap gap-2">
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
          <Badge label={VERIFICATION_LABELS[asset.verificationStatus]} />
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
          value={asset.currentCustodianEmployeeId ? 'Assigned' : 'Unassigned'}
        />
        <Field label="Registered On" value={formatDate(asset.createdOn)} />
        <Field label="Last Modified" value={formatDate(asset.modifiedOn)} />
      </Section>

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
    </div>
  );
};

export default AssetDetailPage;
