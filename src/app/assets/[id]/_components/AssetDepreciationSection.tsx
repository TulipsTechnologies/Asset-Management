'use client';

import { useCallback, useEffect, useState } from 'react';
import InfoCard, { InfoField } from '@/components/UI/InfoCard';
import { IAssetBook } from '@/interface/IDepreciation';
import { CONVENTION_LABELS } from '@/enum/depreciationEnums';
import { fetchAssetBooks } from '@/services/depreciation.service';
import { unwrapPaged } from '@/utils/serviceUtils';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : null;

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? null
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

/**
 * The ACCOUNTING book for this asset — deliberately its own card, separate from the Nepal
 * IRD one beside it. The two books answer different questions and share no figures; showing
 * them in one block is how people end up quoting a tax number in a financial statement.
 */
export default function AssetDepreciationSection({ assetId }: { assetId: string }) {
  const [book, setBook] = useState<IAssetBook | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAssetBooks({ assetId, pageNumber: 1, pageSize: 1 });
      setBook(unwrapPaged<IAssetBook>(response).items[0] ?? null);
    } catch {
      setBook(null);
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading)
    return (
      <InfoCard title="Accounting Depreciation" icon="chart">
        <InfoField label="Book" value={null} emptyText="Loading…" />
      </InfoCard>
    );

  if (!book)
    return (
      <InfoCard title="Accounting Depreciation" icon="chart">
        <InfoField
          label="Book"
          icon="info"
          value={null}
          emptyText="This asset has not been capitalized."
        />
      </InfoCard>
    );

  return (
    <InfoCard title="Accounting Depreciation" icon="chart">
      <InfoField label="Cost" icon="card" value={money(book.cost, book.currencyId)} />
      <InfoField
        label="Depreciation Convention"
        icon="calendar"
        value={CONVENTION_LABELS[book.depreciationConvention] ?? null}
      />
      <InfoField
        label="Available for Use Date"
        icon="calendar"
        value={formatDate(book.availableForUseDate)}
      />
      <InfoField
        label="Last Depreciation Through"
        icon="clock"
        value={formatDate(book.lastDepreciationThroughDate)}
        emptyText="Nothing charged yet"
      />
      <InfoField
        label="Opening Accumulated Depreciation"
        icon="chart"
        value={money(book.openingAccumulatedDepreciation, book.currencyId)}
      />
      <InfoField
        label="Accumulated Depreciation"
        icon="chart"
        value={money(book.accumulatedDepreciation, book.currencyId)}
      />
      <InfoField
        label="Current Net Book Value"
        icon="wallet"
        value={money(book.netBookValue, book.currencyId)}
      />
      <InfoField
        label="Residual Value"
        icon="wallet"
        value={money(book.residualValue, book.currencyId)}
      />
      <InfoField label="Method" icon="setting" value={book.depreciationMethodName} />
    </InfoCard>
  );
}
