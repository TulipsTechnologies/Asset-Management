'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@/components/UI/Button';
import InfoCard from '@/components/UI/InfoCard';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import Select from '@/components/UI/Select';
import { useToast } from '@/components/Providers/ToastProvider';
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TRANSITIONS,
  ClaimStatus,
  IAssetCoverage,
  IClaim,
  IWarranty,
  IInsurancePolicy,
  WARRANTY_TYPE_LABEL,
  WarrantyType,
} from '@/interface/IAssetCoverage';
import {
  cancelPolicy,
  cancelWarranty,
  changeClaimStatus,
  createClaim,
  createPolicy,
  createWarranty,
  fetchAssetCoverage,
} from '@/services/coverage.service';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency}` : ''}`;

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Days from today to `end`, negative once lapsed. */
const daysLeft = (end: string) =>
  Math.round(
    (new Date(end).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) /
      86_400_000
  );

/**
 * Shows how long cover has left, and says plainly when it has run out.
 *
 * `isInForce` comes from the SERVER, which evaluates it against the same clock the rules
 * use — the countdown alone cannot tell "live" from "not started yet", and a warranty
 * beginning next month was rendering as a healthy green 418 days remaining. A cancelled
 * cover reads "Cancelled" rather than a countdown: it cannot lapse, so counting down to
 * its end date would describe something that already ended.
 */
const CoverState = ({
  startDate,
  endDate,
  cancelledOn,
  isInForce,
}: {
  startDate: string;
  endDate: string;
  cancelledOn?: string | null;
  isInForce: boolean;
}) => {
  if (cancelledOn)
    return (
      <span className="text-xs font-semibold text-gray-500">
        Cancelled {formatDate(cancelledOn)}
      </span>
    );

  if (!isInForce && daysLeft(startDate) > 0)
    return (
      <span className="text-xs font-semibold text-gray-500">
        Starts {formatDate(startDate)}
      </span>
    );

  const days = daysLeft(endDate);
  if (days < 0)
    return (
      <span className="text-xs font-semibold text-red-600">
        Expired {Math.abs(days)}d ago
      </span>
    );
  if (days <= 60)
    return (
      <span className="text-xs font-semibold text-amber-600">
        {days}d remaining
      </span>
    );
  return (
    <span className="text-xs font-semibold text-primarycolor">
      {days}d remaining
    </span>
  );
};

type CoverKind = 'warranty' | 'policy';

/**
 * Warranty, insurance and claims for one asset (§9).
 *
 * The asset's own summary warranty/insurance dates are shown ONLY while no coverage rows
 * exist. They are never written from here: those columns keep their single writer, the
 * asset form, and coverage rows supersede them for display (design §1).
 */
export default function AssetCoverageSection({
  assetId,
  canManage,
}: {
  assetId: string;
  canManage: boolean;
}) {
  const { addToast } = useToast();
  const [data, setData] = useState<IAssetCoverage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [coverModal, setCoverModal] = useState<CoverKind | null>(null);
  const [claimModal, setClaimModal] = useState(false);

  // Select renders a portal listbox rather than a native <select>, so its value never
  // reaches FormData — these two fields are controlled while the plain inputs are not.
  const [warrantyType, setWarrantyType] = useState(String(WarrantyType.Manufacturer));
  const [selectedCover, setSelectedCover] = useState('');

  // Dialog state, replacing two window.prompt calls.
  const [cancelTarget, setCancelTarget] =
    useState<{ kind: CoverKind; row: IWarranty | IInsurancePolicy } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [amountTarget, setAmountTarget] =
    useState<{ claim: IClaim; next: ClaimStatus } | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [amountCurrency, setAmountCurrency] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAssetCoverage(assetId);
      if (res?.success) {
        setData(res.data);
        setLoadError(null);
      } else {
        // Surfaced in place rather than only as a toast: a section that silently renders
        // empty is indistinguishable from an asset with no cover.
        setLoadError(res?.message ?? 'Coverage could not be loaded.');
      }
    } catch {
      setLoadError('Coverage could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Every cover, including cancelled ones.
   *
   * Filtering cancelled cover out looked tidy and was wrong: the server accepts a claim
   * whose incident predates the cancellation — that is precisely why a cancelled row is
   * kept rather than deleted — so hiding it made a legitimate loss unfileable from the
   * product, with no workaround. Cancelled entries are labelled, and the server still
   * refuses anything genuinely outside the cover window.
   */
  const claimableCovers = useMemo(() => {
    if (!data) return [];
    const suffix = (cancelledOn?: string | null) =>
      cancelledOn ? ` — cancelled ${formatDate(cancelledOn)}` : '';
    return [
      ...data.warranties.map((w) => ({
        key: `w:${w.id}`,
        label: `Warranty — ${w.provider} (to ${formatDate(w.endDate)})${suffix(w.cancelledOn)}`,
      })),
      ...data.insurancePolicies.map((p) => ({
        key: `p:${p.id}`,
        label: `Insurance — ${p.policyNumber} (to ${formatDate(p.endDate)})${suffix(p.cancelledOn)}`,
      })),
    ];
  }, [data]);

  const hasAnyCover =
    !!data && (data.warranties.length > 0 || data.insurancePolicies.length > 0);

  // ------------------------------------------------------------------ actions

  const submitCover = async (form: HTMLFormElement, kind: CoverKind) => {
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    const num = (k: string) => {
      const raw = get(k);
      return raw === '' ? null : Number(raw);
    };

    setSaving(true);
    try {
      const res =
        kind === 'warranty'
          ? await createWarranty({
              assetId,
              warrantyType: Number(warrantyType) as WarrantyType,
              provider: get('provider'),
              contractNumber: get('contractNumber') || null,
              startDate: get('startDate'),
              endDate: get('endDate'),
              cost: num('cost'),
              currencyId: get('currencyId') || null,
              coverageNotes: get('notes') || null,
            })
          : await createPolicy({
              assetId,
              insurer: get('insurer'),
              policyNumber: get('policyNumber'),
              startDate: get('startDate'),
              endDate: get('endDate'),
              sumInsured: num('sumInsured'),
              premium: num('premium'),
              deductible: num('deductible'),
              currencyId: get('currencyId') || null,
              notes: get('notes') || null,
            });

      if (res?.success) {
        addToast.success(res.message ?? 'Saved.');
        setCoverModal(null);
        await load();
      } else {
        addToast.error(res?.message ?? 'Could not save.');
      }
    } catch {
      addToast.error('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const submitClaim = async (form: HTMLFormElement) => {
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? '').trim();
    const [kind, id] = selectedCover.split(':');
    if (!id) {
      addToast.error('Choose the cover this claim is against.');
      return;
    }

    setSaving(true);
    try {
      const res = await createClaim({
        assetId,
        assetWarrantyId: kind === 'w' ? id : null,
        assetInsurancePolicyId: kind === 'p' ? id : null,
        claimNumber: get('claimNumber') || null,
        claimDate: get('claimDate'),
        incidentDate: get('incidentDate'),
        description: get('description'),
        claimedAmount: get('claimedAmount') === '' ? null : Number(get('claimedAmount')),
        currencyId: get('currencyId') || null,
      });

      if (res?.success) {
        addToast.success(res.message ?? 'Claim recorded.');
        setClaimModal(false);
        await load();
      } else {
        // The in-force refusal lands here, and its message names the cover window.
        addToast.error(res?.message ?? 'Could not record the claim.');
      }
    } catch {
      addToast.error('Could not record the claim. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Both of these used to collect their input with window.prompt — the only two in the
   * codebase, and unusable for money: prompt returns a raw string, and `Number("1,200")`
   * is NaN, which serialises to null, which the server reads as "no amount supplied" and
   * skips. The claim then reported "updated" with the figure silently dropped. They are
   * dialogs now, and the amount is validated before anything is sent.
   */
  const cancelCover = async () => {
    if (!cancelTarget) return;
    const { kind, row } = cancelTarget;

    setSaving(true);
    try {
      const res =
        kind === 'warranty'
          ? await cancelWarranty(row.id, { reason: cancelReason.trim() || null, rowVersion: row.rowVersion })
          : await cancelPolicy(row.id, { reason: cancelReason.trim() || null, rowVersion: row.rowVersion });

      if (res?.success) {
        addToast.success('Cover cancelled.');
        setCancelTarget(null);
        setCancelReason('');
        await load();
      } else {
        addToast.error(res?.message ?? 'Could not cancel.');
      }
    } catch {
      addToast.error('Could not cancel. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /** Transitions that need a figure agreed with the provider before they can be applied. */
  const needsAmount = (next: ClaimStatus) =>
    next === ClaimStatus.Approved || next === ClaimStatus.Settled;

  const moveClaim = async (claim: IClaim, next: ClaimStatus, amountInput?: string) => {
    let approvedAmount: number | null = null;

    if (needsAmount(next) && claim.approvedAmount == null) {
      const raw = (amountInput ?? '').trim();
      const parsed = Number(raw);
      // Explicitly finite: "1,200", "" and "abc" all become NaN or 0 otherwise, and a
      // silently wrong settlement figure is worse than a refusal.
      if (raw === '' || !Number.isFinite(parsed) || parsed < 0) {
        addToast.error('Enter the approved amount as a plain number, e.g. 1200.50');
        return;
      }
      approvedAmount = parsed;
    }

    setSaving(true);
    try {
      const res = await changeClaimStatus(claim.id, {
        status: next,
        approvedAmount,
        // A claim filed without an amount carries no currency; supply one alongside the
        // figure or the server cannot accept it (and the claim could never be settled).
        currencyId:
          approvedAmount == null
            ? null
            : claim.currencyId ?? (amountCurrency.trim().toUpperCase() || null),
        rowVersion: claim.rowVersion,
      });

      if (res?.success) {
        addToast.success('Claim updated.');
        setAmountTarget(null);
        setAmountInput('');
        setAmountCurrency('');
        await load();
      } else {
        addToast.error(res?.message ?? 'Could not update the claim.');
      }
    } catch {
      addToast.error('Could not update the claim. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /** Either applies the transition directly, or opens the dialog that collects the figure. */
  const requestClaimTransition = (claim: IClaim, next: ClaimStatus) => {
    if (needsAmount(next) && claim.approvedAmount == null) {
      setAmountTarget({ claim, next });
      setAmountInput('');
      setAmountCurrency(claim.currencyId ?? '');
      return;
    }
    void moveClaim(claim, next);
  };

  // ------------------------------------------------------------------- render

  return (
    <InfoCard
      title="Warranty & Insurance"
      icon="shield"
      action={
        canManage ? (
          <div className="flex gap-2">
            <Button size="small" variant="outline" onClick={() => setCoverModal('warranty')}>
              Add warranty
            </Button>
            <Button size="small" variant="outline" onClick={() => setCoverModal('policy')}>
              Add policy
            </Button>
            {claimableCovers.length > 0 && (
              <Button
              size="small"
              variant="outline"
              onClick={() => {
                setSelectedCover(claimableCovers[0]?.key ?? '');
                setClaimModal(true);
              }}
            >
                File claim
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {loading && <p className="py-4 text-sm text-gray-500">Loading…</p>}

      {loadError && (
        <p className="py-4 text-sm text-red-600">{loadError}</p>
      )}

      {!loading && !loadError && data && (
        <div className="py-3 space-y-5">
          {/* Fallback: only while nothing supersedes it. */}
          {!hasAnyCover && (
            <div className="text-sm">
              {data.summaryWarrantyEndDate || data.summaryInsuranceExpiryDate ? (
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase">
                    From the asset record
                  </p>
                  {data.summaryWarrantyEndDate && (
                    <p>Warranty until {formatDate(data.summaryWarrantyEndDate)}</p>
                  )}
                  {data.summaryInsuranceExpiryDate && (
                    <p>
                      Insurance {data.summaryInsurancePolicyNumber ?? ''} until{' '}
                      {formatDate(data.summaryInsuranceExpiryDate)}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Summary dates only. Add a warranty or policy to record the provider,
                    contract and claims.
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">No warranty or insurance recorded.</p>
              )}
            </div>
          )}

          {data.warranties.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Warranties
              </p>
              <div className="space-y-2">
                {data.warranties.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-secondaryColor">
                        {w.provider}{' '}
                        <span className="font-normal text-gray-500">
                          · {WARRANTY_TYPE_LABEL[w.warrantyType]}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(w.startDate)} → {formatDate(w.endDate)}
                        {w.contractNumber ? ` · ${w.contractNumber}` : ''}
                        {w.cost != null ? ` · ${money(w.cost, w.currencyId)}` : ''}
                      </p>
                      {w.claimCount > 0 && (
                        <p className="text-xs text-gray-500">{w.claimCount} claim(s)</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <CoverState
                        startDate={w.startDate}
                        endDate={w.endDate}
                        cancelledOn={w.cancelledOn}
                        isInForce={w.isInForce}
                      />
                      {canManage && !w.cancelledOn && (
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-red-600"
                          onClick={() => { setCancelTarget({ kind: 'warranty', row: w }); setCancelReason(''); }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.insurancePolicies.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                Insurance
              </p>
              <div className="space-y-2">
                {data.insurancePolicies.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-secondaryColor">
                        {p.insurer}{' '}
                        <span className="font-normal text-gray-500">
                          · {p.policyNumber}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(p.startDate)} → {formatDate(p.endDate)}
                        {p.sumInsured != null
                          ? ` · insured ${money(p.sumInsured, p.currencyId)}`
                          : ''}
                      </p>
                      {p.claimCount > 0 && (
                        <p className="text-xs text-gray-500">{p.claimCount} claim(s)</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <CoverState
                        startDate={p.startDate}
                        endDate={p.endDate}
                        cancelledOn={p.cancelledOn}
                        isInForce={p.isInForce}
                      />
                      {canManage && !p.cancelledOn && (
                        <button
                          type="button"
                          className="text-xs text-gray-500 hover:text-red-600"
                          onClick={() => { setCancelTarget({ kind: 'policy', row: p }); setCancelReason(''); }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.claims.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Claims</p>
              <div className="space-y-2">
                {data.claims.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-secondaryColor">
                        {c.claimNumber || 'Unnumbered claim'}{' '}
                        <span className="font-normal text-gray-500">
                          · {c.coverKind}
                          {c.coverReference ? ` ${c.coverReference}` : ''}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500">
                        Incident {formatDate(c.incidentDate)} · filed{' '}
                        {formatDate(c.claimDate)}
                        {c.claimedAmount != null
                          ? ` · claimed ${money(c.claimedAmount, c.currencyId)}`
                          : ''}
                        {c.approvedAmount != null
                          ? ` · approved ${money(c.approvedAmount, c.currencyId)}`
                          : ''}
                      </p>
                      <p className="text-xs text-gray-600">{c.description}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-secondaryColor">
                        {CLAIM_STATUS_LABEL[c.status]}
                      </span>
                      {/* Only reachable transitions are offered — the same table the
                          service enforces, so the UI never invites a refusal. */}
                      {canManage &&
                        CLAIM_TRANSITIONS[c.status].map((next) => (
                          <button
                            key={next}
                            type="button"
                            disabled={saving}
                            aria-label={`Move claim to ${CLAIM_STATUS_LABEL[next]}`}
                            className="text-xs text-primarycolor hover:underline disabled:opacity-40"
                            onClick={() => requestClaimTransition(c, next)}
                          >
                            {CLAIM_STATUS_LABEL[next]}
                          </button>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------ modals */}

      <Modal isOpen={coverModal !== null} onClose={() => setCoverModal(null)} size="lg">
        <div className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-secondaryColor">
          {coverModal === 'policy' ? 'Add insurance policy' : 'Add warranty'}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitCover(e.currentTarget, coverModal ?? 'warranty');
          }}
          className="space-y-4"
        >
          {coverModal === 'warranty' ? (
            <>
              <Select
                label="Type"
                required
                value={warrantyType}
                onChange={(e) => setWarrantyType(e.target.value)}
                options={Object.entries(WARRANTY_TYPE_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
              <Input name="provider" label="Provider" required />
              <Input name="contractNumber" label="Contract number" />
            </>
          ) : (
            <>
              <Input name="insurer" label="Insurer" required />
              <Input name="policyNumber" label="Policy number" required />
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input name="startDate" type="date" label="Start date" required defaultValue={todayIso()} />
            <Input name="endDate" type="date" label="End date" required />
          </div>

          {coverModal === 'warranty' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input name="cost" type="number" step="0.01" label="Cost" />
              <Input name="currencyId" label="Currency" maxLength={3} placeholder="NPR" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Input name="sumInsured" type="number" step="0.01" label="Sum insured" />
                <Input name="premium" type="number" step="0.01" label="Premium" />
                <Input name="deductible" type="number" step="0.01" label="Deductible" />
              </div>
              <Input name="currencyId" label="Currency" maxLength={3} placeholder="NPR" />
            </>
          )}

          <Input name="notes" label="Notes" />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCoverModal(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
        </div>
      </Modal>

      <Modal isOpen={claimModal} onClose={() => setClaimModal(false)} size="lg">
        <div className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-secondaryColor">File a claim</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitClaim(e.currentTarget);
          }}
          className="space-y-4"
        >
          <Select
            label="Against"
            required
            value={selectedCover}
            onChange={(e) => setSelectedCover(e.target.value)}
            placeholder="Select the cover"
            options={claimableCovers.map((c) => ({ value: c.key, label: c.label }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              name="incidentDate"
              type="date"
              label="Incident date"
              required
              defaultValue={todayIso()}
            />
            <Input name="claimDate" type="date" label="Claim date" required defaultValue={todayIso()} />
          </div>
          <p className="-mt-2 text-xs text-gray-500">
            The cover must have been in force on the incident date — filing later is fine.
          </p>

          <Input name="claimNumber" label="Claim number" />
          <Input name="description" label="What happened" required />

          <div className="grid grid-cols-2 gap-3">
            <Input name="claimedAmount" type="number" step="0.01" label="Claimed amount" />
            <Input name="currencyId" label="Currency" maxLength={3} placeholder="NPR" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setClaimModal(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'File claim'}
            </Button>
          </div>
        </form>
        </div>
      </Modal>

      <Modal isOpen={cancelTarget !== null} onClose={() => setCancelTarget(null)} size="md">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">End cover early</h2>
          <p className="mb-4 text-xs text-gray-500">
            The record is kept — claims already filed against it reference it, and an incident
            from before today can still be claimed.
          </p>
          <Input
            label="Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Replaced by an extended plan"
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
              Keep it
            </Button>
            <Button type="button" disabled={saving} onClick={() => void cancelCover()}>
              {saving ? 'Cancelling…' : 'Cancel cover'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={amountTarget !== null} onClose={() => setAmountTarget(null)} size="md">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">
            {amountTarget ? CLAIM_STATUS_LABEL[amountTarget.next] : ''} this claim
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            The figure the provider agreed. A claim cannot be settled without one.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Approved amount"
              type="number"
              step="0.01"
              min="0"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="1200.50"
            />
            <Input
              label="Currency"
              maxLength={3}
              value={amountCurrency}
              onChange={(e) => setAmountCurrency(e.target.value)}
              placeholder="NPR"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setAmountTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() =>
                amountTarget && void moveClaim(amountTarget.claim, amountTarget.next, amountInput)
              }
            >
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </InfoCard>
  );
}
