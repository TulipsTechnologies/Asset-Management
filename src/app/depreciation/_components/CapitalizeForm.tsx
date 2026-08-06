'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import ToggleSwitch from '@/components/UI/ToggleSwitch';
import { IAssetBook } from '@/interface/IDepreciation';
import { IAssetListItem } from '@/interface/IAsset';
import { FINANCIAL_LABELS, FinancialStatusEnum } from '@/enum/assetEnums';
import {
  CONVENTION_OPTIONS,
  DEPRECIATION_METHOD_CODES,
  DepreciationConventionEnum,
  isDayBasedConvention,
} from '@/enum/depreciationEnums';
import { NEPAL_CLASS_RATES, NEPAL_CLASS_RATE_PCT, NEPAL_TAX_CLASSES, TAX_ENTRY_PERIODS, TaxTreatmentEnum } from '@/interface/ITax';
import {
  capitalizeAsset,
  createFiscalYear,
  fetchAssetBookById,
  fetchDepreciationMethods,
  fetchFiscalYears,
  projectDepreciation,
  updateAssetBook,
} from '@/services/depreciation.service';
import { IFiscalYear } from '@/interface/IDepreciation';
import { draftEarlierFiscalYears } from '@/utils/fiscalYear';
import { IDepreciationProjection } from '@/interface/IDepreciation';
import { assignAssetTaxClass, fetchAssetTaxProfile, seedNepalRulePack } from '@/services/tax.service';
import { fetchAssets } from '@/services/asset.service';
import { fetchAssetCategoryById } from '@/services/assetCategory.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { IDepreciationMethod } from '@/interface/IDepreciation';

const today = () => new Date().toISOString().slice(0, 10);

type TForm = {
  assetId: string;
  cost: string;
  currencyId: string;
  residualValue: string;
  usefulLifeMonths: string;
  depreciationMethodId: string;
  decliningBalanceFactor: string;
  annualRatePercent: string;
  depreciationStartDate: string;
  availableForUseDate: string;
  depreciationConvention: string;
  openingAccumulatedDepreciation: string;
  openingNetBookValue: string;
  lastDepreciationThroughDate: string;
  notes: string;
  irdClassCode: string;
  taxEntryYearCode: string;
  taxEntryPeriodOrdinal: string;
};

const emptyForm: TForm = {
  assetId: '',
  cost: '',
  currencyId: 'NPR',
  residualValue: '0',
  usefulLifeMonths: '60',
  depreciationMethodId: '',
  decliningBalanceFactor: '1',
  annualRatePercent: '',
  depreciationStartDate: today(),
  availableForUseDate: today(),
  depreciationConvention: String(DepreciationConventionEnum.FullMonth),
  openingAccumulatedDepreciation: '0',
  openingNetBookValue: '',
  lastDepreciationThroughDate: '',
  notes: '',
  irdClassCode: '',
  taxEntryYearCode: '',
  taxEntryPeriodOrdinal: '1',
};

const money = (amount: number, currency: string) =>
  `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency.trim()}`;

/** Full-width label that groups the fields beneath it inside the single form card. */
const GroupLabel = ({ children, hint }: { children: string; hint?: string }) => (
  <div className="md:col-span-2 mt-2 first:mt-0">
    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
      {children}
    </h2>
    {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    <div className="mt-3 border-b border-gray-100" />
  </div>
);

/** Small label-over-value pair, for the summary strip inside a modal. */
const DetailField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-800">{value ?? '—'}</p>
  </div>
);

/** A collapsible side panel: circular icon, bold title, chevron, boxed body. */
const Panel = ({
  title,
  icon,
  iconClass = 'text-primarycolor border-primarycolor/30 bg-primarycolor/5',
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  iconClass?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 px-5 py-4"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${iconClass}`}
        >
          <i className={`icon icon-${icon} text-sm`} />
        </span>
        <span className="truncate text-base font-bold text-secondaryColor">{title}</span>
      </span>
      <i
        className={`icon icon-arrow-down shrink-0 text-xs text-gray-400 transition-transform ${
          open ? 'rotate-180' : ''
        }`}
      />
    </button>
    {open && <div className="px-5 pb-5">{children}</div>}
  </div>
);

/** The boxed area inside a panel, matching the sample's inset card. */
const PanelBox = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-lg border border-gray-200 px-4 py-3">{children}</div>
);

/** A label/value row. `divider` draws the rule above it that precedes a result. */
const Row = ({
  label,
  value,
  op,
  divider,
  highlight,
  muted,
}: {
  label: string;
  value?: string | null;
  op?: '−' | '÷' | '=';
  divider?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) => (
  <div
    className={`flex items-baseline justify-between gap-3 py-2 ${
      divider ? 'border-t border-gray-200' : ''
    }`}
  >
    <span className="flex items-baseline gap-1.5 text-sm text-gray-600">
      <span className="w-2 shrink-0 text-gray-300">{op ?? ''}</span>
      {label}
    </span>
    <span
      className={
        highlight
          ? 'whitespace-nowrap text-lg font-bold tabular-nums text-primarycolor'
          : `text-sm tabular-nums ${muted ? 'text-gray-400' : 'font-medium text-gray-800'}`
      }
    >
      {value ?? '—'}
    </span>
  </div>
);

/** A single eligibility line: a tick or a cross, and what it means. */
const Check = ({ ok, label }: { ok: boolean; label: string }) => (
  <div className="flex items-start gap-2 py-1.5">
    <i
      className={`icon icon-${ok ? 'check-circle' : 'alert'} mt-0.5 text-sm ${
        ok ? 'text-primarycolor' : 'text-red-500'
      }`}
    />
    <span className={`text-sm ${ok ? 'text-gray-600' : 'text-red-600'}`}>{label}</span>
  </div>
);

export default function CapitalizeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { addToast } = useToast();

  const bookId = params.get('bookId');
  const isEdit = !!bookId;

  const [form, setForm] = useState<TForm>(emptyForm);
  const [book, setBook] = useState<IAssetBook | null>(null);
  const [assetOptions, setAssetOptions] = useState<IAssetListItem[]>([]);
  const [methods, setMethods] = useState<IDepreciationMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taxOn, setTaxOn] = useState(false);
  const [panels, setPanels] = useState({ info: true, eligibility: true, calc: true });
  const [projection, setProjection] = useState<IDepreciationProjection | null>(null);
  const [projecting, setProjecting] = useState(false);
  // Display horizon for a life-less projection. Deliberately NOT part of the form payload
  // that saves the book — "show me 10 years" must never quietly become the accounting life.
  const [forecastYears, setForecastYears] = useState(10);
  const [historyOpen, setHistoryOpen] = useState(false);
  // "historical": no opening balance — the register recomputes the past itself (catch-up).
  // "opening": the prior system's figures are adopted and never recomputed.
  const [startMode, setStartMode] = useState<'historical' | 'opening'>('historical');
  const [fiscalYears, setFiscalYears] = useState<IFiscalYear[]>([]);
  const [seeding, setSeeding] = useState(false);
  const toggle = (key: keyof typeof panels) =>
    setPanels((prev) => ({ ...prev, [key]: !prev[key] }));
  const [failure, setFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

  // Bumped whenever the form is (re)initialized or the asset changes; an async
  // category-defaults prefill from an older generation is dropped.
  const prefillGeneration = useRef(0);

  // Until the operator sets the in-service date themselves it follows the depreciation
  // start date, which is what it meant before the daily convention existed. Left to default
  // to today, a 2016 asset silently got a 2026 anchor.
  const anchorTouched = useRef(false);

  const set = (patch: Partial<TForm>) =>
    setForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.availableForUseDate !== undefined) anchorTouched.current = true;
      if (patch.depreciationStartDate !== undefined && !anchorTouched.current)
        next.availableForUseDate = patch.depreciationStartDate;
      return next;
    });

  // ---------------------------------------------------------------- load

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [methodsResponse, yearsResponse] = await Promise.all([
          fetchDepreciationMethods(),
          fetchFiscalYears(),
        ]);
        if (!cancelled) {
          setMethods(methodsResponse?.data ?? []);
          setFiscalYears(yearsResponse?.data ?? []);
        }

        if (isEdit) {
          const response = await fetchAssetBookById(bookId!);
          if (cancelled) return;
          if (!response?.success || !response.data) {
            addToast.error(response?.message || 'That book could not be loaded.');
            router.replace('/depreciation');
            return;
          }
          const loaded = response.data;
          setBook(loaded);
          // The classification lives on the ASSET, not the book — surface it here so the
          // operator sees what they entered at capitalization instead of an empty section.
          fetchAssetTaxProfile(loaded.assetId)
            .then((tax) => {
              if (cancelled || !tax?.success || !tax.data) return;
              setTaxOn(true);
              setForm((prev) => ({
                ...prev,
                irdClassCode: tax.data.classCode ?? '',
                taxEntryYearCode: tax.data.entryTaxYearCode ?? '',
                taxEntryPeriodOrdinal: String(tax.data.entryPeriodOrdinal ?? 1),
              }));
            })
            .catch(() => undefined);
          setStartMode(
            loaded.openingAccumulatedDepreciation > 0 || loaded.lastDepreciationThroughDate
              ? 'opening'
              : 'historical'
          );
          prefillGeneration.current += 1;
          setForm({
            assetId: loaded.assetId,
            cost: String(loaded.cost),
            currencyId: loaded.currencyId.trim(),
            residualValue: String(loaded.residualValue),
            usefulLifeMonths: String(loaded.usefulLifeMonths),
            depreciationMethodId: loaded.depreciationMethodId,
            decliningBalanceFactor: String(loaded.decliningBalanceFactor),
            annualRatePercent:
              loaded.annualRatePercent != null ? String(loaded.annualRatePercent) : '',
            depreciationStartDate: loaded.depreciationStartDate.slice(0, 10),
            availableForUseDate: loaded.availableForUseDate.slice(0, 10),
            depreciationConvention: String(loaded.depreciationConvention),
            openingAccumulatedDepreciation: String(loaded.openingAccumulatedDepreciation),
            openingNetBookValue: '',
            lastDepreciationThroughDate:
              loaded.lastDepreciationThroughDate?.slice(0, 10) ?? '',
            notes: loaded.notes ?? '',
            // Reclassifying for tax is done from the asset's own screen, not by editing
            // the accounting book.
            irdClassCode: '',
            taxEntryYearCode: '',
            taxEntryPeriodOrdinal: '1',
          });
        } else {
          const assetsResponse = await fetchAssets({ pageNumber: 1, pageSize: 200 });
          if (cancelled) return;
          setAssetOptions(unwrapPaged<IAssetListItem>(assetsResponse).items);
        }
      } catch {
        if (!cancelled) addToast.error('Could not load the form.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // §1.3.6 — the asset's category can carry depreciation defaults. A generation token (not an
  // assetId compare) decides whether a late response may still land.
  const applyCategoryDefaults = useCallback(
    async (assetId: string, categoryId: string, generation: number) => {
      try {
        const res = await fetchAssetCategoryById(categoryId);
        const category = res?.success ? res.data : null;
        if (!category) return;
        if (prefillGeneration.current !== generation) return;
        setForm((prev) => {
          if (prev.assetId !== assetId) return prev;
          const next = { ...prev };
          if (
            category.defaultDepreciationMethodId &&
            methods.some((m) => m.id === category.defaultDepreciationMethodId)
          )
            next.depreciationMethodId = category.defaultDepreciationMethodId;
          if (category.defaultUsefulLifeMonths != null)
            next.usefulLifeMonths = String(category.defaultUsefulLifeMonths);
          if (category.defaultResidualRate != null) {
            const cost = Number(prev.cost || 0);
            if (cost > 0)
              next.residualValue = String(
                Math.round(cost * category.defaultResidualRate) / 100
              );
          }
          return next;
        });
      } catch {
        // No prefill on failure — the form still works by hand.
      }
    },
    [methods]
  );

  // ---------------------------------------------------------------- derived

  const methodCode = methods.find((m) => m.id === form.depreciationMethodId)?.code;
  const currency = form.currencyId.trim().toUpperCase() || 'NPR';

  const cost = Number(form.cost || 0);
  const residual = Number(form.residualValue || 0);
  const opening = Number(form.openingAccumulatedDepreciation || 0);
  const lifeMonths = Number(form.usefulLifeMonths || 0);
  const convention = Number(form.depreciationConvention);
  const dayBased = isDayBasedConvention(convention);

  const depreciableBase = Math.max(cost - residual, 0);
  const remainingBase = Math.max(depreciableBase - opening, 0);
  const openingNbv = cost - opening;

  // Straight line is the only method whose per-period charge is plain division, so it is the
  // only one given a figure. Diminishing balance switches to straight line when that yields
  // more, and the engine — not this form — decides when. Guessing here would put a number on
  // screen that the posted schedule then contradicts.
  const straightLine = methodCode === DEPRECIATION_METHOD_CODES.StraightLine;
  const monthlyCharge =
    straightLine && lifeMonths > 0 ? remainingBase / lifeMonths : null;

  /**
   * WHICH DATE THE ENGINE ACTUALLY MEASURES FROM.
   *
   * A whole-month book is positioned by the depreciation start date; the in-service date
   * only anchors the day-based conventions. Showing the in-service date for a FullMonth book
   * reported a life ending twenty years from today for an asset bought in 2016 — the panel
   * was describing a field the engine was not using.
   */
  const anchorDate = dayBased ? form.availableForUseDate : form.depreciationStartDate;
  const anchorLabel = dayBased ? 'In service from' : 'Depreciation starts';

  const lifeEnd = (() => {
    // Clamped to the backend's own bound: an absurd typed value must not overflow the
    // Date. An overflowed Date's toISOString throws "Invalid time value" mid-render.
    if (!anchorDate || lifeMonths <= 0 || lifeMonths > 1200) return null;
    const start = new Date(anchorDate);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start);
    end.setMonth(end.getMonth() + lifeMonths);
    if (Number.isNaN(end.getTime())) return null;
    return end.toISOString().slice(0, 10);
  })();

  /**
   * Months of the life already gone before the first period the calendar can charge. The
   * asset bought in 2016 with a 2026 calendar has 120 of its 240 months behind it, and
   * nothing has been recorded for them — which is what makes the remaining schedule look
   * twice as steep as it should.
   */
  const elapsedMonths = (() => {
    if (!anchorDate) return 0;
    const start = new Date(anchorDate);
    if (Number.isNaN(start.getTime())) return 0;
    const now = new Date();
    const months =
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return Math.max(0, months);
  })();

  const backdated = startMode === 'historical' && elapsedMonths > 0 && opening <= 0;

  /**
   * The operator thinks in RATES — a Nepal class-C vehicle is "20% a year". The engine
   * stores a FACTOR (a multiplier over the straight-line rate), and rate = factor / years.
   * The form therefore takes the rate and derives the factor, so nobody has to work out
   * that 20% over a 12.5-year life happens to be a factor of 2.5.
   */
  const lifeYears = lifeMonths > 0 ? lifeMonths / 12 : 0;
  const isRateBased =
    methodCode === DEPRECIATION_METHOD_CODES.DecliningBalance ||
    methodCode === DEPRECIATION_METHOD_CODES.WrittenDownValue;
  const isStraightLine = methodCode === DEPRECIATION_METHOD_CODES.StraightLine;

  /**
   * Which rate the book will actually use. A NAMED rate is the operator's own number; a
   * legacy book (no stored rate) derives factor / years, shown but labelled as derived so
   * an 8%-out-of-nowhere is explained rather than mysterious.
   */
  const namedRatePct = Number(form.annualRatePercent || 0);
  const legacyDerivedPct =
    isEdit && book?.annualRatePercent == null && lifeYears > 0
      ? (Number(form.decliningBalanceFactor || 0) / lifeYears) * 100
      : 0;
  const annualRatePct = namedRatePct > 0 ? namedRatePct : legacyDerivedPct;

  const statedNbv = Number(form.openingNetBookValue || 0);
  const nbvMismatch =
    startMode === 'opening' &&
    form.openingNetBookValue !== '' &&
    Math.abs(cost - opening - statedNbv) > 0.01;

  /** Months already behind the through-date — what the total life must exceed. */
  const monthsThrough = (() => {
    if (!form.lastDepreciationThroughDate || !anchorDate) return null;
    const from = new Date(anchorDate);
    const through = new Date(form.lastDepreciationThroughDate);
    if (Number.isNaN(from.getTime()) || Number.isNaN(through.getTime())) return null;
    const months =
      (through.getFullYear() - from.getFullYear()) * 12 +
      (through.getMonth() - from.getMonth()) +
      (through.getDate() >= from.getDate() ? 1 : 0);
    return Math.max(0, months);
  })();

  const remainingLifeMonths =
    monthsThrough != null && lifeMonths > 0 ? Math.max(0, lifeMonths - monthsThrough) : null;

  /**
   * A schedule can only be written against fiscal periods that exist, so an asset whose
   * depreciation began before the calendar does simply has no history to hold — the whole
   * cost lands on the periods that remain. This works out how far short the calendar falls.
   */
  const calendarGap = (() => {
    if (!form.depreciationStartDate || fiscalYears.length === 0) return null;

    const earliest = [...fiscalYears].sort((a, b) =>
      a.startDate.localeCompare(b.startDate)
    )[0];
    const earliestStart = new Date(earliest.startDate);
    const start = new Date(form.depreciationStartDate);
    if (Number.isNaN(start.getTime()) || start >= earliestStart) return null;

    const days = (earliestStart.getTime() - start.getTime()) / 86_400_000;
    const yearsNeeded = Math.ceil(days / 365.25);
    // A half-typed year like 0006 produces a two-millennia gap; that is a typo, not a
    // seeding plan. Stay silent until the date looks real.
    if (yearsNeeded < 1 || yearsNeeded > 100) return null;
    return {
      earliestCode: earliest.code,
      earliestStart: earliest.startDate.slice(0, 10),
      yearsNeeded,
    };
  })();

  const selectedAsset = assetOptions.find((a) => a.id === form.assetId) ?? null;

  const residualTooHigh = residual > cost && cost > 0;
  const openingTooHigh = opening > depreciableBase && depreciableBase > 0;
  const needsThroughDate =
    dayBased && opening > 0 && !form.lastDepreciationThroughDate;

  // Mirrors what the server will check. Shown before submitting so a refusal is not the
  // first time the operator learns something is wrong.
  const eligibility = [
    { ok: !!form.assetId, label: isEdit ? 'Book loaded' : 'An asset is selected' },
    {
      ok:
        isEdit ||
        !selectedAsset ||
        selectedAsset.financialStatus !== FinancialStatusEnum.Capitalized,
      label: 'The asset is not already capitalized',
    },
    { ok: !!form.depreciationMethodId, label: 'A depreciation method is chosen' },
    ...(isStraightLine
      ? [{ ok: lifeMonths > 0, label: 'Useful life is set — straight line charges the base over it' }]
      : []),
    ...(isRateBased
      ? [{ ok: annualRatePct > 0, label: 'An annual rate is set (life is only an optional cap)' }]
      : []),
    { ok: cost > 0, label: 'Cost is greater than zero' },
    { ok: !residualTooHigh, label: 'Residual value does not exceed the cost' },
    { ok: !openingTooHigh, label: 'Opening accumulated fits within the depreciable base' },
    {
      ok: !needsThroughDate,
      label: 'A day-based book with an opening balance states what was already charged',
    },
    {
      ok: !nbvMismatch,
      label: 'Opening NBV agrees with cost minus opening accumulated',
    },
    {
      ok: !!form.availableForUseDate,
      label: 'An in-service date is set as the depreciation anchor',
    },
  ];
  const eligible = eligibility.every((c) => c.ok);

  /**
   * "It cost this much and was bought then — what is it worth now?"
   *
   * Answered by the server running the same engine that posts the books, over synthetic
   * periods for the years the fiscal calendar never covered. Nothing is computed here, and
   * nothing is written there.
   */
  const runProjection = async () => {
    if (projecting) return;
    const projectionReady =
      !!form.depreciationMethodId &&
      cost > 0 &&
      (isRateBased ? annualRatePct > 0 || lifeMonths > 0 : lifeMonths > 0);
    if (!projectionReady) {
      setFailure({
        message: isRateBased
          ? 'Pick a method and enter a cost and an annual rate before projecting.'
          : 'Pick a method and enter a cost and useful life before projecting.',
      });
      return;
    }

    setProjecting(true);
    setFailure(null);
    try {
      const response = await projectDepreciation({
        depreciationMethodId: form.depreciationMethodId,
        cost,
        residualValue: residual,
        usefulLifeMonths: lifeMonths > 0 ? lifeMonths : undefined,
        annualRatePercent: namedRatePct > 0 ? namedRatePct : undefined,
        forecastYears: lifeMonths > 0 ? undefined : forecastYears,
        decliningBalanceFactor: Number(form.decliningBalanceFactor || 1),
        depreciationStartDate: form.depreciationStartDate,
      });

      if (response?.success && response.data) setProjection(response.data);
      else
        setFailure({
          code: response?.reasonCode,
          message: response?.message || 'Could not work out the value to date.',
        });
    } catch {
      setFailure({ message: 'Could not work out the value to date.' });
    } finally {
      setProjecting(false);
    }
  };

  /**
   * Creates the missing years back-to-back before the earliest existing one, oldest first.
   *
   * Each is drafted with twelve editable periods; the backend refuses to generate them
   * because Bikram Sambat months vary in length, so these are a STARTING POINT to be checked
   * against the patro. Creating a fiscal year regenerates every active book's schedule, so
   * the history appears without touching the book.
   */
  const seedEarlierYears = async () => {
    if (!calendarGap || seeding) return;

    setSeeding(true);
    setFailure(null);
    try {
      const drafts = draftEarlierFiscalYears(
        calendarGap.earliestCode,
        calendarGap.earliestStart,
        calendarGap.yearsNeeded
      );

      let created = 0;
      for (const draft of drafts) {
        const response = await createFiscalYear({
          code: draft.code,
          startDate: draft.startDate,
          endDate: draft.endDate,
          isActive: true,
          periods: draft.periods,
        });
        if (!response?.success) {
          setFailure({
            code: response?.reasonCode,
            message: `Created ${created} of ${drafts.length} years, then stopped: ${
              response?.message ?? 'unknown reason'
            }`,
          });
          break;
        }
        created += 1;
      }

      if (created > 0) {
        addToast.success(
          `${created} earlier fiscal year(s) created. Every active book's schedule has been extended — check the month boundaries against the patro.`
        );
        const refreshed = await fetchFiscalYears();
        setFiscalYears(refreshed?.data ?? []);
      }
    } catch {
      setFailure({ message: 'Could not create the earlier fiscal years.' });
    } finally {
      setSeeding(false);
    }
  };

  // ---------------------------------------------------------------- submit

  const applyIrdClassification = async (assetId: string) => {
    if (!taxOn || !form.irdClassCode || !form.taxEntryYearCode) return;

    const startYear = Number(form.taxEntryYearCode.trim().slice(0, 4));
    if (!Number.isFinite(startYear) || startYear < 2000) {
      addToast.warning(
        'The asset was capitalized, but the tax entry year is not a Bikram Sambat year like 2083/84, so no IRD classification was applied.'
      );
      return;
    }

    try {
      // The jurisdiction id has no GET endpoint; the rule-pack seed is idempotent and is the
      // only read path. When the pack exists — the normal case — nothing is created.
      const jurisdiction = await seedNepalRulePack({
        effectiveFromStartYear: startYear,
        effectiveFromTaxYear: form.taxEntryYearCode.trim(),
      });
      if (!jurisdiction?.success || !jurisdiction.data?.id) {
        addToast.warning(
          `The asset was capitalized, but the Nepal tax rules could not be resolved, so no IRD classification was applied. ${
            jurisdiction?.message ?? ''
          }`
        );
        return;
      }

      const assigned = await assignAssetTaxClass(assetId, {
        taxJurisdictionId: jurisdiction.data.id,
        taxTreatment: TaxTreatmentEnum.Pooled,
        classCode: form.irdClassCode,
        entryTaxYearCode: form.taxEntryYearCode.trim(),
        entryTaxStartYear: startYear,
        entryPeriodOrdinal: Number(form.taxEntryPeriodOrdinal || 1),
      });

      if (assigned?.success)
        addToast.success(`IRD class ${form.irdClassCode} assigned.`);
      else
        addToast.warning(
          `The asset was capitalized, but the IRD classification failed: ${
            assigned?.message ?? 'unknown reason'
          }`
        );
    } catch {
      addToast.warning(
        'The asset was capitalized, but the IRD classification could not be applied.'
      );
    }
  };

  const submit = async () => {
    if (saving) return;
    setFailure(null);

    if (!form.assetId || !form.depreciationMethodId) {
      setFailure({ message: 'Pick an asset and a depreciation method.' });
      return;
    }
    if (needsThroughDate) {
      setFailure({
        message:
          'This book carries opening accumulated depreciation on a day-based convention, so the last depreciation-through date is required.',
      });
      return;
    }

    setSaving(true);
    try {
      if (isEdit && book) {
        const response = await updateAssetBook(book.id, {
          cost,
          residualValue: residual,
          usefulLifeMonths: lifeMonths > 0 ? lifeMonths : undefined,
          annualRatePercent: namedRatePct > 0 ? namedRatePct : undefined,
          depreciationMethodId: form.depreciationMethodId,
          decliningBalanceFactor: Number(form.decliningBalanceFactor || 1),
          depreciationStartDate: form.depreciationStartDate,
          openingAccumulatedDepreciation: opening,
          notes: form.notes || undefined,
          rowVersion: book.rowVersion,
        });

        if (response?.success) {
          addToast.success(response.message || 'Book updated.');
          router.push('/depreciation');
          return;
        }
        setFailure({ code: response?.reasonCode, message: response?.message });
        return;
      }

      const asset = assetOptions.find((a) => a.id === form.assetId);
      if (!asset?.rowVersion) {
        setFailure({ message: 'That asset could not be resolved. Reload and try again.' });
        return;
      }

      const openingMode = startMode === 'opening';
      const response = await capitalizeAsset({
        assetId: form.assetId,
        cost,
        currencyId: currency,
        residualValue: residual,
        usefulLifeMonths: lifeMonths > 0 ? lifeMonths : undefined,
        annualRatePercent: isRateBased && namedRatePct > 0 ? namedRatePct : undefined,
        // The plain reducing balance never reaches zero; consuming the base by end of
        // life is the legacy behaviour, opted into per policy, not silently.
        useStraightLineCrossover: false,
        depreciationMethodId: form.depreciationMethodId,
        decliningBalanceFactor: Number(form.decliningBalanceFactor || 1),
        depreciationStartDate: form.depreciationStartDate,
        availableForUseDate: form.availableForUseDate || undefined,
        depreciationConvention: convention,
        // Historical mode: no opening position — the register recomputes the past itself,
        // so any figures typed while the other mode was selected must not ride along.
        openingAccumulatedDepreciation: openingMode ? opening : 0,
        openingNetBookValue:
          openingMode && form.openingNetBookValue !== '' ? statedNbv : undefined,
        lastDepreciationThroughDate: openingMode
          ? form.lastDepreciationThroughDate || undefined
          : undefined,
        notes: form.notes || undefined,
        rowVersion: asset.rowVersion,
      });

      if (!response?.success) {
        setFailure({ code: response?.reasonCode, message: response?.message });
        return;
      }

      addToast.success(response.message || 'Asset capitalized.');
      // A separate act on a separate endpoint: its failure never undoes the capitalization.
      await applyIrdClassification(form.assetId);
      router.push('/depreciation');
    } catch {
      setFailure({ message: 'Could not save. Check the connection and try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="px-4 mt-10 text-center text-sm text-gray-400">Loading…</div>
    );

  // ---------------------------------------------------------------- render

  return (
    <div className="mt-2 max-w-[1400px] px-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-secondaryColor">
            {isEdit ? `Edit Book — ${book?.assetCode}` : 'Capitalize Asset'}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Creates the asset book — the authoritative cost record. The book&apos;s cost is
            independent of the asset&apos;s purchase cost from here on.
          </p>
        </div>
        <button
          onClick={() => router.push('/depreciation')}
          className="text-sm text-gray-500 hover:text-primarycolor"
        >
          <i className="icon icon-left mr-1 text-xs" /> Back
        </button>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ------------------------------------------------------------ form */}
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">
            <Select
              label="Asset"
              required
              disabled={isEdit}
              value={form.assetId}
              onChange={(e) => {
                const assetId = e.target.value;
                const asset = assetOptions.find((a) => a.id === assetId);
                set({
                  assetId,
                  cost: asset?.purchaseCost ? String(asset.purchaseCost) : form.cost,
                  depreciationMethodId: emptyForm.depreciationMethodId,
                  usefulLifeMonths: emptyForm.usefulLifeMonths,
                  residualValue: emptyForm.residualValue,
                });
                const generation = ++prefillGeneration.current;
                if (assetId && asset?.assetCategoryId)
                  applyCategoryDefaults(assetId, asset.assetCategoryId, generation);
              }}
              options={
                isEdit && book
                  ? [{ label: `${book.assetCode} — ${book.assetName}`, value: book.assetId }]
                  : assetOptions.map((a) => ({
                      label: `${a.assetCode} — ${a.assetName}`,
                      value: a.id,
                    }))
              }
              placeholder="Select an asset"
            />
            <Select
              label="Depreciation Method"
              required
              value={form.depreciationMethodId}
              onChange={(e) => set({ depreciationMethodId: e.target.value })}
              options={methods.map((m) => ({ label: m.name, value: m.id }))}
              placeholder="Select a method"
            />

            <GroupLabel hint="What the asset is carried at, and what will never be depreciated away.">
              Cost Basis
            </GroupLabel>

            <Input
              label="Cost"
              type="number"
              required
              value={form.cost}
              onChange={(e) => set({ cost: e.target.value })}
              helperText="Defaults from the asset's purchase cost, then becomes independent."
            />
            <Input
              label="Currency"
              required
              disabled={isEdit}
              value={form.currencyId}
              onChange={(e) => set({ currencyId: e.target.value })}
              helperText="Must match the company base currency."
            />
            <Input
              label="Residual Value"
              type="number"
              value={form.residualValue}
              onChange={(e) => set({ residualValue: e.target.value })}
              error={residualTooHigh ? 'Residual cannot exceed the cost.' : undefined}
              helperText="What the asset is expected to be worth at the end of its life."
            />
            {isRateBased && (
              <Input
                label="Annual Depreciation Rate (%)"
                type="number"
                required
                value={form.annualRatePercent}
                onChange={(e) => set({ annualRatePercent: e.target.value })}
                helperText={
                  legacyDerivedPct > 0 && !form.annualRatePercent
                    ? `This book predates named rates: it derives ${legacyDerivedPct.toFixed(
                        1
                      )}% from factor ${form.decliningBalanceFactor} over ${lifeYears.toFixed(
                        1
                      )} years. Enter a rate here only to move it onto the named-rate setup.`
                    : 'Your own accounting rate — e.g. 20% for vehicles. This is independent of the Nepal IRD tax rate below. Each month charges on the current book value, so the amount falls every period.'
                }
              />
            )}

            <GroupLabel hint="How long the asset lasts, and how each period is measured.">
              Measurement
            </GroupLabel>

            <Input
              label="Useful Life (months)"
              type="number"
              required={!isRateBased}
              value={form.usefulLifeMonths}
              onChange={(e) => set({ usefulLifeMonths: e.target.value })}
              helperText={
                isRateBased
                  ? 'Optional for rate-based methods — it only caps the schedule. Leave empty to depreciate at the rate until residual or disposal.'
                  : undefined
              }
            />
            <Select
              label="Depreciation Convention"
              required
              disabled={isEdit}
              value={form.depreciationConvention}
              onChange={(e) => set({ depreciationConvention: e.target.value })}
              options={CONVENTION_OPTIONS}
              helperText={
                dayBased
                  ? 'The start date is excluded and the period-end date is included.'
                  : 'The period containing the start date depreciates in full.'
              }
            />
            <Input
              label="Depreciation Start Date"
              type="date"
              required
              value={form.depreciationStartDate}
              onChange={(e) => set({ depreciationStartDate: e.target.value })}
              helperText="The period containing this date depreciates in full."
            />
            <Input
              label="Available for Use Date"
              type="date"
              required
              disabled={isEdit}
              value={form.availableForUseDate}
              onChange={(e) => set({ availableForUseDate: e.target.value })}
              helperText="Daily depreciation starts from this date according to the selected convention."
            />

            <GroupLabel hint="How the asset's past enters the register.">
              Depreciation Start
            </GroupLabel>

            {/* The two ways a mid-life asset can arrive. Historical: the register computes
                the past itself (needs the fiscal calendar to reach back that far). Opening
                balance: the prior system's figures are adopted and never recomputed. */}
            <div className="md:col-span-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
              {(
                [
                  {
                    key: 'historical',
                    label: 'Historical Recalculation',
                    hint: 'The register computes every past period itself.',
                  },
                  {
                    key: 'opening',
                    label: 'Opening Balance',
                    hint: 'Adopt the previous system\u2019s figures; never recompute them.',
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.key}
                  className={`flex flex-1 cursor-pointer items-start gap-2.5 rounded-lg border p-3 ${
                    startMode === option.key
                      ? 'border-primarycolor bg-primarycolor/5'
                      : 'border-gray-200'
                  } ${isEdit ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="startMode"
                    className="mt-0.5 accent-primarycolor"
                    checked={startMode === option.key}
                    disabled={isEdit}
                    onChange={() => setStartMode(option.key)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>

            {startMode === 'opening' && (
              <>
                <Input
                  label="Opening Accumulated Depreciation"
                  type="number"
                  required
                  value={form.openingAccumulatedDepreciation}
                  onChange={(e) => set({ openingAccumulatedDepreciation: e.target.value })}
                  error={
                    openingTooHigh
                      ? 'Cannot exceed the depreciable base (cost less residual).'
                      : undefined
                  }
                  helperText="What the previous system had already charged."
                />
                <Input
                  label="Opening Net Book Value"
                  type="number"
                  value={form.openingNetBookValue}
                  onChange={(e) => set({ openingNetBookValue: e.target.value })}
                  error={
                    nbvMismatch
                      ? `Cost − opening accumulated is ${money(cost - opening, currency)}. The three figures must agree.`
                      : undefined
                  }
                  helperText="Optional cross-check against the source sheet. Must equal cost − opening accumulated."
                />
                <Input
                  label="Last Depreciation Through Date"
                  type="date"
                  required={dayBased && opening > 0}
                  disabled={isEdit}
                  value={form.lastDepreciationThroughDate}
                  onChange={(e) => set({ lastDepreciationThroughDate: e.target.value })}
                  error={needsThroughDate ? 'Required on a day-based book.' : undefined}
                  helperText="New depreciation begins after this date to prevent duplicate depreciation."
                />
                <div>
                  <p className="block text-sm font-medium text-gray-500">
                    Remaining Useful Life
                  </p>
                  <p className="py-2 text-base text-gray-800">
                    {remainingLifeMonths != null
                      ? `${remainingLifeMonths} of ${lifeMonths} months`
                      : '—'}
                  </p>
                  <p className="text-gray-400 text-xs italic">
                    Derived: total life minus the months already charged through.
                  </p>
                </div>
              </>
            )}

            {startMode === 'historical' && !isEdit && (
              <p className="md:col-span-2 rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
                The register will compute the asset&apos;s past itself: every period from the
                start date is scheduled, a run sweeps the years already gone as historical
                catch-up, and the current fiscal year is charged period by period. Needs the
                fiscal calendar to reach back to the start date — the panel on the right
                offers to create the missing years.
              </p>
            )}

            {(
              <>
                <div className="md:col-span-2 mt-2 flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Nepal IRD Tax Details
                    </h2>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {isEdit
                        ? 'The classification entered at capitalization. Saving updates it.'
                        : 'A second, independent book. Skip it and the asset still capitalizes.'}
                    </p>
                  </div>
                  <ToggleSwitch checked={taxOn} onChange={() => setTaxOn((on) => !on)} />
                </div>
                <div className="md:col-span-2 -mt-2 border-b border-gray-100" />

                {taxOn && (
                  <>
                    <Select
                      label="IRD Class"
                      value={form.irdClassCode}
                      onChange={(e) => {
                        const classCode = e.target.value;
                        const classRate = NEPAL_CLASS_RATE_PCT[classCode];
                        // Choosing the class is the explicit act that may seed the internal
                        // rate — but only into an EMPTY field. A rate the operator already
                        // typed is theirs; the adopt button below handles that case.
                        if (isRateBased && classRate != null && !form.annualRatePercent)
                          set({ irdClassCode: classCode, annualRatePercent: String(classRate) });
                        else set({ irdClassCode: classCode });
                      }}
                      options={NEPAL_TAX_CLASSES}
                      placeholder="Not classified"
                      helperText={
                        form.irdClassCode
                          ? `IRD pool rate: ${
                              NEPAL_CLASS_RATES[form.irdClassCode] ?? '—'
                            } — used by the TAX book. The internal accounting rate above stays separate unless you adopt it.`
                          : undefined
                      }
                    />
                    {isRateBased &&
                      NEPAL_CLASS_RATE_PCT[form.irdClassCode] != null &&
                      Number(form.annualRatePercent || 0) !==
                        NEPAL_CLASS_RATE_PCT[form.irdClassCode] && (
                        <div className="md:col-span-1 -mt-1">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() =>
                              set({
                                annualRatePercent: String(
                                  NEPAL_CLASS_RATE_PCT[form.irdClassCode]
                                ),
                              })
                            }
                          >
                            Use {NEPAL_CLASS_RATE_PCT[form.irdClassCode]}% (class{' '}
                            {form.irdClassCode}) as the accounting rate too
                          </Button>
                        </div>
                      )}
                    <Input
                      label="Tax Entry Year"
                      value={form.taxEntryYearCode}
                      onChange={(e) => set({ taxEntryYearCode: e.target.value })}
                      placeholder="2083/84"
                      helperText="Bikram Sambat, as 2083/84."
                    />
                    <Select
                      label="Tax Entry Period"
                      value={form.taxEntryPeriodOrdinal}
                      onChange={(e) => set({ taxEntryPeriodOrdinal: e.target.value })}
                      options={TAX_ENTRY_PERIODS}
                      helperText="Decides how much of the cost enters the pool this year."
                    />
                  </>
                )}
              </>
            )}

            <GroupLabel>Notes</GroupLabel>
            <div className="md:col-span-2">
              <TextArea
                label=""
                value={form.notes}
                onChange={(e) => set({ notes: e.target.value })}
                placeholder="Anything worth recording about this capitalization."
              />
            </div>
          </div>

          {methodCode === DEPRECIATION_METHOD_CODES.None && (
            <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Method <strong>None</strong> never depreciates — the asset is carried at cost
              forever. This is the correct choice for land.
            </p>
          )}

          {isEdit && (
            <p className="mt-4 rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
              The convention and the in-service anchor are fixed at capitalization. Moving a
              book to actual calendar days is done from the Books list, prospectively, so
              posted periods keep the numbers they were posted with.
            </p>
          )}

          {failure && (
            <ReasonBanner
              className="mt-4"
              code={failure.code}
              message={failure.message}
              severity="error"
            />
          )}

          <div className="mt-6 flex justify-end gap-2 border-t border-gray-100 pt-5">
            <Button variant="secondary" onClick={() => router.push('/depreciation')}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving
                ? isEdit
                  ? 'Saving…'
                  : 'Capitalizing…'
                : isEdit
                  ? 'Save Changes'
                  : 'Capitalize Asset'}
            </Button>
          </div>
        </div>

        {/* --------------------------------------------------- side panels */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <Panel
            title="Asset Info"
            icon="info"
            open={panels.info}
            onToggle={() => toggle('info')}
          >
            <PanelBox>
              {isEdit && book ? (
                <>
                  <Row label="Asset" value={book.assetCode} />
                  <Row label="Category" value={book.assetCategoryName} />
                  <Row label="Book status" value={book.hasPostedDepreciation ? 'Has posted depreciation' : 'Nothing posted yet'} />
                  <Row
                    label="Accumulated"
                    value={money(book.accumulatedDepreciation, book.currencyId)}
                  />
                </>
              ) : !selectedAsset ? (
                <p className="py-6 text-center text-sm text-red-500">
                  Choose an asset to view its information.
                </p>
              ) : (
                <>
                  <Row label="Asset" value={selectedAsset.assetCode} />
                  <Row label="Category" value={selectedAsset.assetCategoryName} />
                  <Row
                    label="Purchase cost"
                    value={
                      selectedAsset.purchaseCost != null
                        ? money(selectedAsset.purchaseCost, currency)
                        : null
                    }
                  />
                  <Row
                    label="Purchase date"
                    value={selectedAsset.purchaseDate?.slice(0, 10) ?? null}
                  />
                  <Row
                    label="Financial status"
                    value={FINANCIAL_LABELS[selectedAsset.financialStatus] ?? null}
                  />
                </>
              )}
            </PanelBox>
          </Panel>

          <Panel
            title="Eligibility"
            icon={eligible ? 'check-circle' : 'alert'}
            iconClass={
              eligible
                ? 'text-primarycolor border-primarycolor/30 bg-primarycolor/5'
                : 'text-red-500 border-red-200 bg-red-50'
            }
            open={panels.eligibility}
            onToggle={() => toggle('eligibility')}
          >
            <PanelBox>
              {eligibility.map((check) => (
                <Check key={check.label} ok={check.ok} label={check.label} />
              ))}
            </PanelBox>
          </Panel>

          <Panel
            title="Depreciation Calculator"
            icon="bar-chart"
            open={panels.calc}
            onToggle={() => toggle('calc')}
          >
            <PanelBox>
              <p className="pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Depreciable base
              </p>
              <Row label="Cost" value={money(cost, currency)} />
              <Row op="−" label="Residual value" value={money(residual, currency)} />
              <Row op="=" label="Depreciable base" value={money(depreciableBase, currency)} divider />

              <p className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Opening position
              </p>
              <Row op="−" label="Opening accumulated" value={money(opening, currency)} />
              <Row op="=" label="Opening NBV" value={money(openingNbv, currency)} divider />
              <Row label="Still to depreciate" value={money(remainingBase, currency)} muted />

              <p className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Charge
              </p>
              {!methodCode ? (
                <p className="py-2 text-sm text-gray-400">
                  Pick a depreciation method to see how the charge is worked out.
                </p>
              ) : methodCode === DEPRECIATION_METHOD_CODES.None ? (
                <p className="py-2 text-sm text-gray-500">
                  Never depreciates. The asset stays at cost.
                </p>
              ) : methodCode === DEPRECIATION_METHOD_CODES.WrittenDownValue ? (
                <p className="py-2 text-sm text-gray-500">
                  Written-down value charges{' '}
                  {annualRatePct > 0 ? `${annualRatePct.toFixed(1)}%` : 'the rate'}{' '}
                  of each year&apos;s opening book value, forever — the value never reaches
                  zero; whatever the rate has not consumed remains on the book at the end of
                  the life.
                </p>
              ) : monthlyCharge != null ? (
                <>
                  <Row op="÷" label={`Useful life (months)`} value={String(lifeMonths)} />
                  <Row
                    label="Monthly charge"
                    value={money(monthlyCharge, currency)}
                    divider
                    highlight
                  />
                </>
              ) : (
                <p className="py-2 text-sm text-gray-500">
                  Diminishing balance at {annualRatePct > 0 ? `${annualRatePct.toFixed(1)}%` : 'the rate'}{' '}
                  a year charges each month on that month&apos;s opening book value, so the
                  amount falls every period — but it is bound by the useful life and switches
                  to straight line once that charges more, finishing at the residual. For a
                  rate that never reaches zero, choose <strong>Written-Down Value</strong>.
                </p>
              )}

              <p className="pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Timing
              </p>
              <div className="space-y-1.5 text-sm text-gray-600">
                <p>
                  {anchorLabel}{' '}
                  <span className="font-medium text-gray-800">{anchorDate || '—'}</span>
                </p>
                {lifeEnd && (
                  <p>
                    Life ends <span className="font-medium text-gray-800">{lifeEnd}</span>
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  {dayBased
                    ? 'Charged by actual calendar days — the start date is excluded, the period-end date included, so a 31-day month charges more than a 28-day one.'
                    : 'Charged in whole months — every period charges the same amount regardless of its length.'}
                </p>
                {form.lastDepreciationThroughDate && (
                  <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    Nothing on or before{' '}
                    <strong>{form.lastDepreciationThroughDate}</strong> will be charged again.
                  </p>
                )}
                {elapsedMonths > 0 && (
                  <div className="mt-2 rounded border border-gray-200 p-2.5">
                    <p className="text-xs font-medium text-gray-700">
                      Value as of today
                    </p>
                    {isRateBased && lifeMonths <= 0 && (
                      <label className="mt-1 flex items-center gap-2 text-[11px] text-gray-500">
                        Forecast horizon
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={forecastYears}
                          onChange={(e) =>
                            setForecastYears(Math.min(20, Math.max(1, Number(e.target.value || 10))))
                          }
                          className="w-14 rounded border border-gray-200 px-1.5 py-0.5 text-xs"
                        />
                        years — display only, never saved as the life
                      </label>
                    )}
                    <p className="mt-0.5 text-[11px] text-gray-500">
                      Runs the depreciation engine from {form.depreciationStartDate || 'the start date'} to
                      today, for the years the fiscal calendar does not cover.
                    </p>

                    {projection ? (
                      <div className="mt-2">
                        <Row
                          label={`Depreciated over ${projection.elapsedMonths} months`}
                          value={money(projection.accumulatedToDate, currency)}
                        />
                        <Row
                          label="Value left today"
                          value={money(projection.netBookValueToDate, currency)}
                          divider
                          highlight
                        />
                        <Row
                          label="This year's charge"
                          value={money(projection.currentYearCharge, currency)}
                          muted
                        />
                        <Button
                          variant="secondary"
                          size="small"
                          className="mt-2 w-full"
                          onClick={() => setHistoryOpen(true)}
                        >
                          View year by year
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          className="mt-1.5 w-full"
                          onClick={() => {
                            set({
                              openingAccumulatedDepreciation: String(
                                projection.accumulatedToDate
                              ),
                            });
                            setProjection(null);
                          }}
                        >
                          Use as opening accumulated
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="small"
                        className="mt-2 w-full"
                        onClick={runProjection}
                        disabled={projecting}
                      >
                        {projecting ? 'Calculating…' : 'Calculate value as of today'}
                      </Button>
                    )}
                  </div>
                )}

                {calendarGap && (
                  <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2.5">
                    <p className="text-xs font-medium text-amber-900">
                      The calendar starts after this asset does
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                      Fiscal years only go back to <strong>{calendarGap.earliestCode}</strong>{' '}
                      ({calendarGap.earliestStart}), but depreciation starts{' '}
                      <strong>{form.depreciationStartDate}</strong>. Those earlier periods do
                      not exist, so the schedule cannot hold that history.
                    </p>
                    <Button
                      variant="secondary"
                      size="small"
                      className="mt-2 w-full"
                      onClick={seedEarlierYears}
                      disabled={seeding}
                    >
                      {seeding
                        ? 'Creating…'
                        : `Create ${calendarGap.yearsNeeded} earlier fiscal year${
                            calendarGap.yearsNeeded === 1 ? '' : 's'
                          }`}
                    </Button>
                  </div>
                )}

                {backdated && (
                  <p className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                    About <strong>{elapsedMonths}</strong> of the {lifeMonths || '—'} months
                    have already passed, and no opening accumulated depreciation is recorded
                    for them. The whole cost would then be spread over the periods that
                    remain, charging far more per period than the asset really consumes.
                    Enter what has already been depreciated as{' '}
                    <strong>Opening Accumulated Depreciation</strong>.
                  </p>
                )}
              </div>
            </PanelBox>

            <p className="mt-3 text-[11px] leading-relaxed text-gray-400">
              An estimate to help you check the inputs. The posted schedule is generated by the
              server, period by period, and is what the books use.
            </p>
          </Panel>
        </aside>
      </div>

      {/* ------------------------------------------------- year-by-year history */}
      <Modal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} size="3xl">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">
            Depreciation year by year
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Every year from {projection?.depreciationStartDate?.slice(0, 10)} to the end of the
            asset&apos;s life, computed by the same engine that posts the books. Years already
            elapsed are the history; the rest is what is still to come.
          </p>

          {projection && (
            <>
              <div className="mb-4 grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
                <DetailField label="Method" value={projection.methodName} />
                <DetailField
                  label="Elapsed"
                  value={`${projection.elapsedMonths} of ${projection.usefulLifeMonths} months`}
                />
                <DetailField
                  label="Depreciated to date"
                  value={money(projection.accumulatedToDate, currency)}
                />
                <DetailField
                  label="Value left today"
                  value={money(projection.netBookValueToDate, currency)}
                />
              </div>

              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                    <tr>
                      <th className="px-3 py-2">Year</th>
                      <th className="px-3 py-2">Period</th>
                      <th className="px-3 py-2 text-right">Opening value</th>
                      <th className="px-3 py-2 text-right">Charge</th>
                      <th className="px-3 py-2 text-right">Accumulated</th>
                      <th className="px-3 py-2 text-right">Closing value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.years.map((year) => (
                      <tr
                        key={year.yearNumber}
                        className={`border-b border-gray-100 ${
                          year.isCurrent ? 'bg-primarycolor/5' : year.elapsed ? '' : 'opacity-60'
                        }`}
                      >
                        <td className="px-3 py-2 font-medium">
                          {year.yearNumber}
                          {year.isCurrent && (
                            <span className="ml-2 rounded bg-primarycolor/10 px-1.5 py-0.5 text-[10px] font-medium text-primarycolor">
                              current
                            </span>
                          )}
                          {!year.elapsed && !year.isCurrent && (
                            <span className="ml-2 text-[10px] text-gray-400">future</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {year.from.slice(0, 10)} → {year.to.slice(0, 10)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {money(year.openingNetBookValue, currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {money(year.charge, currency)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {money(year.accumulatedAtEnd, currency)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {money(year.closingNetBookValue, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="mt-3 space-y-1">
                {projection.notes.map((note) => (
                  <li key={note} className="text-[11px] leading-relaxed text-gray-400">
                    {note}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="mt-5 flex justify-end">
            <Button variant="secondary" onClick={() => setHistoryOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
