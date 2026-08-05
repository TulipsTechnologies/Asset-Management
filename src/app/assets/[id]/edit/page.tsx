'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import AssetForm from '@/components/AssetForm';
import Button from '@/components/UI/Button';
import { LifecycleStatusEnum } from '@/enum/assetEnums';
import { IAsset } from '@/interface/IAsset';
import { activateAsset, fetchAssetById } from '@/services/asset.service';

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
  const [activating, setActivating] = useState(false);
  // Set when activation succeeded but the follow-up refetch did not: the loaded asset
  // now carries a RowVersion the server has already superseded.
  const [stale, setStale] = useState(false);

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

  const canActivate =
    asset.lifecycleStatus === LifecycleStatusEnum.Draft ||
    asset.lifecycleStatus === LifecycleStatusEnum.Retired;

  /*
   * Activation and the refresh that follows it are reported separately on purpose: once
   * the POST has succeeded the asset IS active, and a failed refresh must never be told
   * as "could not be activated".
   */
  const activate = async () => {
    setActivating(true);
    let activated = false;
    try {
      const res = await activateAsset(asset.id, asset.rowVersion ?? '');
      if (!res?.success) {
        addToast.error(res?.message || 'The asset could not be activated.');
        return;
      }
      activated = true;
      addToast.success(res.message || 'Asset activated.');
    } catch {
      addToast.error('The asset could not be activated.');
    } finally {
      setActivating(false);
    }
    if (!activated) return;

    /*
     * Refetch rather than patch: activation bumps the RowVersion, and a form still
     * holding the old token would 409 on its next save for no visible reason. If the
     * refetch does not land, the form is stale — say so and take it off the screen
     * rather than leave a dead token behind a Save button.
     */
    try {
      const fresh = await fetchAssetById(asset.id);
      if (fresh?.success && fresh.data) setAsset(fresh.data);
      else setStale(true);
    } catch {
      setStale(true);
    }
  };

  const reload = async () => {
    setLoading(true);
    try {
      const fresh = await fetchAssetById(asset.id);
      if (fresh?.success && fresh.data) {
        setAsset(fresh.data);
        setStale(false);
      } else {
        addToast.error(fresh?.message || 'The asset still could not be loaded.');
      }
    } catch {
      addToast.error('The asset still could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  if (stale) {
    return (
      <div className="mx-4 mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
        <p className="text-sm font-semibold text-amber-800">
          The asset was activated, but this form could not be refreshed.
        </p>
        <p className="text-xs text-amber-700/80 mt-1">
          Saving from here would fail as a conflict. Reload to carry on editing.
        </p>
        <Button className="mt-3" onClick={reload}>
          Reload
        </Button>
      </div>
    );
  }

  return (
    <>
      {canActivate && (
        <div className="mx-4 mt-2 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="inline-flex items-center justify-center size-9 rounded-full bg-amber-100 shrink-0">
            <i className="icon icon-zap text-amber-600 text-base"></i>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {asset.lifecycleStatus === LifecycleStatusEnum.Draft
                ? 'This asset is a Draft.'
                : 'This asset is Retired.'}
            </p>
            <p className="text-xs text-amber-700/80">
              It cannot be assigned, maintained or depreciated until it is Active.
            </p>
          </div>
          <Button onClick={activate} disabled={activating}>
            {activating ? 'Activating…' : 'Activate'}
          </Button>
        </div>
      )}
      <AssetForm asset={asset} />
    </>
  );
};

export default EditAssetPage;
