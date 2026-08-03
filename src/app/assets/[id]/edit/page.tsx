'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import AssetForm from '@/components/AssetForm';
import { LifecycleStatusEnum } from '@/enum/assetEnums';
import { IAsset } from '@/interface/IAsset';
import { fetchAssetById } from '@/services/asset.service';

/**
 * Edit flow: loads the asset (the GET carries every editable field plus the
 * rowVersion) and hands it to the shared AssetForm in edit mode.
 * Covered by the '/assets/:path*' middleware matcher.
 */
const EditAssetPage = () => {
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
          // Mirror the backend rule: Disposed assets are immutable, so the edit
          // route bounces straight back to the detail page.
          if (res.data.lifecycleStatus === LifecycleStatusEnum.Disposed) {
            addToast.error('Disposed assets cannot be edited.');
            router.replace(`/assets/${id}`);
            return;
          }
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

  return <AssetForm asset={asset} />;
};

export default EditAssetPage;
