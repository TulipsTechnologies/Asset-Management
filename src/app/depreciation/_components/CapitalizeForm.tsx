'use client';

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import Modal from '@/components/UI/Modal';
import ReasonBanner from '@/components/UI/ReasonBanner';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import ToggleSwitch from '@/components/UI/ToggleSwitch';
import {
  DetailField,
  GroupLabel,
  Panel,
  PanelBox,
  Row,
} from '@/components/UI/FormLayout';
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
  // No default life: a prefilled 60 was silently adopted as the asset's life, and it decided
  // where depreciation stopped. Required only where the method actually needs it.
  usefulLifeMonths: '',
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
  /** Fiscal-year rows whose monthly periods are expanded in the year-by-year modal. */
  const [expandedYears, setExpandedYears] = useState<Set<number>>(new Set());
  /** Fingerprint of the inputs the current projection was computed from — a mismatch
      means the figures on screen no longer describe the form. */
  const [projectedInputs, setProjectedInputs] = useState<string | null>(null);
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
          const years = yearsResponse?.data ?? [];
          setFiscalYears(years);

          // Default the tax-entry year to the CURRENT fiscal year — the common case is an
          // asset entering the pool now. An edit loads its own stored year afterwards.
          const today = new Date().toISOString().slice(0, 10);
          const current = years.find(
            (y) => y.startDate.slice(0, 10) <= today && y.endDate.slice(0, 10) >= today
          );
          if (current)
            setForm((prev) =>
              prev.taxEntryYearCode ? prev : { ...prev, taxEntryYearCode: current.code }
            );
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

  /** The configured fiscal year containing today. Everything tax-entry hangs off it. */
  const currentFiscalYear = (() => {
    const today = new Date().toISOString().slice(0, 10);
    return (
      fiscalYears.find(
        (y) => y.startDate.slice(0, 10) <= today && y.endDate.slice(0, 10) >= today
      ) ?? null
    );
  })();

  /**
   * Tax-entry years, read from the company's fiscal calendar rather than typed: every year
   * from the one the asset was acquired in through the current one, newest first. A future
   * year is never offered — an asset cannot have entered a pool that has not started.
   * An asset older than the calendar simply gets every year the calendar has.
   */
  const taxEntryYearOptions = (() => {
    if (fiscalYears.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    const acquired = (form.availableForUseDate || form.depreciationStartDate || '').slice(0, 10);

    const acquisitionYear = acquired
      ? fiscalYears.find(
          (y) => y.startDate.slice(0, 10) <= acquired && y.endDate.slice(0, 10) >= acquired
        )
      : undefined;
    const floor = acquisitionYear?.startDate.slice(0, 10) ?? '';

    return fiscalYears
      .filter((y) => y.startDate.slice(0, 10) <= today)
      .filter((y) => !floor || y.startDate.slice(0, 10) >= floor)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((y) => ({ value: y.code, label: y.code }));
  })();

  const selectedAsset = assetOptions.find((a) => a.id === form.assetId) ?? null;

  const residualTooHigh = residual > cost && cost > 0;
  const openingTooHigh = opening > depreciableBase && depreciableBase > 0;
  const needsThroughDate =
    dayBased && opening > 0 && !form.lastDepreciationThroughDate;

  // Mirrors what the server will check. Shown before submitting so a refusal is not the
  // first time the operator learns something is wrong.
  /**
   * What still stands between this form and a book — nothing more.
   *
   * An item appears only while it is UNMET, so the panel is a short to-do list that empties
   * as the form is filled, rather than a wall of ticks restating every rule. Each line names
   * the field and what to do with it; the arithmetic that explains why lives in the
   * calculator beside it, not here.
   */
  const blockers = [
    { ok: !!form.assetId, label: isEdit ? 'Load a book' : 'Select an asset' },
    {
      ok:
        isEdit ||
        !selectedAsset ||
        selectedAsset.financialStatus !== FinancialStatusEnum.Capitalized,
      label: 'This asset is already capitalized',
    },
    { ok: cost > 0, label: 'Enter a cost' },
    { ok: !!form.depreciationMethodId, label: 'Choose a depreciation method' },
    ...(isStraightLine ? [{ ok: lifeMonths > 0, label: 'Enter a useful life' }] : []),
    ...(isRateBased ? [{ ok: annualRatePct > 0, label: 'Enter an annual rate' }] : []),
    { ok: !!form.availableForUseDate, label: 'Set the in-service date' },
    { ok: !residualTooHigh, label: 'Residual value exceeds the cost' },
    { ok: !openingTooHigh, label: 'Opening accumulated exceeds the depreciable base' },
    { ok: !nbvMismatch, label: 'Opening NBV does not match cost less opening accumulated' },
    { ok: !needsThroughDate, label: 'Set the last depreciation-through date' },
  ];
  const outstanding = blockers.filter((item) => !item.ok);
  const eligible = outstanding.length === 0;

  /**
   * A life that has already run out. This is the single most misread state on this screen:
   * the schedule then legitimately ends in a past fiscal year, and it reads as the register
   * having "stopped early" when in fact the entered life expired there. Say so where the
   * life is entered, in the asset's own fiscal terms.
   */
  const lifeAlreadyOver =
    !!lifeEnd && lifeMonths > 0 && lifeEnd < new Date().toISOString().slice(0, 10);

  /** Worth saying, but not blocking. */
  const advisories = [
    ...(lifeAlreadyOver
      ? [
          `This useful life ends ${lifeEnd} — already past, so nothing after that date is scheduled and the asset is fully depreciated on arrival. Check the life before saving.`,
        ]
      : []),
    ...(backdated
      ? [
          `About ${elapsedMonths} month${elapsedMonths === 1 ? '' : 's'} have already passed with no opening balance recorded. Use the calculator to set one, or the whole cost spreads over the periods that remain.`,
        ]
      : []),
    ...(calendarGap
      ? [
          `The fiscal calendar starts at ${calendarGap.earliestCode}, after this asset does — those earlier periods cannot hold history until they are created.`,
        ]
      : []),
    ...(taxOn && !form.irdClassCode ? ['No IRD class chosen — the tax book will not be started.'] : []),
  ];

  /**
   * "It cost this much and was bought then — what is it worth now?"
   *
   * Answered by the server running the same engine that posts the books, over synthetic
   * periods for the years the fiscal calendar never covered. Nothing is computed here, and
   * nothing is written there.
   */
  /** The inputs the projection depends on, as one comparable string. */
  const projectionFingerprint = [
    form.depreciationMethodId,
    cost,
    residual,
    lifeMonths,
    namedRatePct,
    form.depreciationStartDate,
    forecastYears,
  ].join('|');
  const projectionStale = projection != null && projectedInputs !== projectionFingerprint;

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

      if (response?.success && response.data) {
        setProjection(response.data);
        setProjectedInputs(projectionFingerprint);
      } else
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
   * "Depreciate the past, then open the current year at what is left."
   *
   * Runs the same server projection the calculator uses and writes its cutover triple —
   * accumulated through the last CLOSED fiscal year, the NBV that leaves, and the
   * through-date — into the Opening Balance fields, then switches the form to that mode.
   *
   * Deliberately one click and not automatic at submit: it moves the whole of the asset's
   * history out of the current period's P&L and into the opening position, which is a
   * ledger decision. The operator is left looking at the three figures in editable fields,
   * and nothing is written until they save.
   */
  const applyHistoryThroughLastClosedYear = async () => {
    if (projecting) return;

    // Same precondition the calculator uses. Without it the server rejects the half-filled
    // request and the operator is shown its wire-level complaint instead of what to do.
    const ready =
      !!form.depreciationMethodId &&
      cost > 0 &&
      (isRateBased ? annualRatePct > 0 || lifeMonths > 0 : lifeMonths > 0);
    if (!ready) {
      setFailure({
        message: isRateBased
          ? 'Pick a method and enter a cost and an annual rate before calculating the history.'
          : 'Pick a method and enter a cost and useful life before calculating the history.',
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

      if (!response?.success || !response.data) {
        setFailure({
          code: response?.reasonCode,
          message: response?.message || 'Could not work out the history for this asset.',
        });
        return;
      }

      const projected = response.data;
      if (
        !projected.isFiscalAligned ||
        projected.accumulatedThroughCutover == null ||
        !projected.cutoverThroughDate
      ) {
        // No closed fiscal year to cut over at — the calendar does not reach the start
        // date, or none has ended yet. Say which rather than writing a misleading zero.
        setProjection(projected);
        setProjectedInputs(projectionFingerprint);
        setFailure({
          message: projected.isFiscalAligned
            ? 'No fiscal year has closed yet for this asset, so there is no history to carry forward.'
            : 'The fiscal calendar does not reach this asset’s start date, so its history cannot be dated. Create the earlier fiscal years first.',
        });
        return;
      }

      set({
        openingAccumulatedDepreciation: String(projected.accumulatedThroughCutover),
        ...(projected.netBookValueAtCutover != null
          ? { openingNetBookValue: String(projected.netBookValueAtCutover) }
          : {}),
        lastDepreciationThroughDate: projected.cutoverThroughDate.slice(0, 10),
      });
      setStartMode('opening');
      setProjection(null);
      addToast.success(
        `History through ${projected.lastClosedFiscalYearCode} set as the opening balance. ${
          projected.currentFiscalYearCode ?? 'The current fiscal year'
        } opens at ${money(projected.netBookValueAtCutover ?? 0, currency)}.`
      );
    } catch {
      setFailure({ message: 'Could not work out the history for this asset.' });
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
            {isEdit ? `Edit Depreciation — ${book?.assetCode}` : 'Add Depreciation'}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500">
            Sets how this asset depreciates and creates its book — the authoritative cost
            record, independent of the asset&apos;s purchase cost from here on.
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
              options={methods
                // Straight Line and Diminishing Balance are the two methods offered here.
                // None and Written-Down Value are hidden (this form submits the crossover
                // off, so Diminishing Balance already never reaches zero) — but a book that
                // already carries one of them must keep its method visible on edit.
                .filter(
                  (m) =>
                    m.code === DEPRECIATION_METHOD_CODES.StraightLine ||
                    m.code === DEPRECIATION_METHOD_CODES.DecliningBalance ||
                    m.id === form.depreciationMethodId
                )
                .map((m) => ({ label: m.name, value: m.id }))}
              placeholder="Select a method"
            />

            {/* Nepal IRD tax classification — up front on purpose: the class both files
                the TAX book and can seed the accounting rate below, so it is the natural
                second decision after the method. Skipping it still capitalizes. */}
            <div
              className={`md:col-span-2 rounded-lg border p-3.5 ${
                taxOn
                  ? 'border-primarycolor/40 bg-primarycolor/[0.04]'
                  : 'border-gray-200 bg-gray-50/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-primarycolor">
                    Nepal IRD Tax Details
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {isEdit
                      ? 'The classification entered at capitalization. Saving updates it.'
                      : 'Classify now so the tax pool starts with this asset — a second, independent book. Skip it and the asset still capitalizes.'}
                  </p>
                </div>
                <ToggleSwitch checked={taxOn} onChange={() => setTaxOn((on) => !on)} />
              </div>

              {taxOn && (
                <div className="mt-3 grid gap-x-6 gap-y-4 md:grid-cols-2">
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
                          } — used by the TAX book. The internal accounting rate in Cost Basis stays separate unless you adopt it.`
                        : undefined
                    }
                  />
                  <Select
                    label="Tax Entry Year"
                    value={form.taxEntryYearCode}
                    onChange={(e) => set({ taxEntryYearCode: e.target.value })}
                    options={taxEntryYearOptions}
                    placeholder={
                      fiscalYears.length === 0
                        ? 'No fiscal calendar configured'
                        : 'Select a fiscal year'
                    }
                    helperText={
                      currentFiscalYear
                        ? `The year this asset first entered the tax pool — from its acquisition year through the current year (${currentFiscalYear.code}).`
                        : 'The year this asset first entered the tax pool.'
                    }
                  />
                  <Select
                    label="Tax Entry Period"
                    value={form.taxEntryPeriodOrdinal}
                    onChange={(e) => set({ taxEntryPeriodOrdinal: e.target.value })}
                    options={TAX_ENTRY_PERIODS}
                    helperText="Decides how much of the cost enters the pool this year."
                  />
                  {isRateBased &&
                    NEPAL_CLASS_RATE_PCT[form.irdClassCode] != null &&
                    Number(form.annualRatePercent || 0) !==
                      NEPAL_CLASS_RATE_PCT[form.irdClassCode] && (
                      <div className="self-end">
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
                </div>
              )}
            </div>

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
                    : 'Your own accounting rate — e.g. 20% for vehicles. This is independent of the Nepal IRD tax rate above. Each month charges on the current book value, so the amount falls every period.'
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
              <div className="md:col-span-2 rounded bg-gray-50 px-3 py-2.5">
                <p className="text-xs text-gray-500">
                  The register computes the asset&apos;s past itself: every period from the
                  start date is scheduled, and a run then sweeps the years already gone as
                  historical catch-up — one large charge in the current period&apos;s P&amp;L.
                  Needs the fiscal calendar to reach back to the start date.
                </p>
                {backdated && (
                  <div className="mt-2 border-t border-gray-200 pt-2">
                    <p className="text-xs text-gray-600">
                      For an asset this old the usual choice is to close the past instead:
                      depreciate through the last closed fiscal year, and open the current one
                      at the value that leaves. The figures are the same either way — only
                      where the history lands differs.
                    </p>
                    <Button
                      variant="secondary"
                      size="small"
                      className="mt-2"
                      disabled={projecting}
                      onClick={applyHistoryThroughLastClosedYear}
                    >
                      {projecting
                        ? 'Calculating…'
                        : 'Calculate history and set the opening balance'}
                    </Button>
                  </div>
                )}
              </div>
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
                  : 'Adding…'
                : isEdit
                  ? 'Save Changes'
                  : 'Add Depreciation'}
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
              {eligible ? (
                <p className="flex items-center gap-2 py-1 text-sm text-primarycolor">
                  <i className="icon icon-check-circle text-xs" />
                  Ready to {isEdit ? 'save' : 'add'}.
                </p>
              ) : (
                <ul className="space-y-1.5 py-0.5">
                  {outstanding.map((item) => (
                    <li key={item.label} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                      {item.label}
                    </li>
                  ))}
                </ul>
              )}

              {advisories.length > 0 && (
                <ul className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                  {advisories.map((note) => (
                    <li key={note} className="flex items-start gap-2 text-xs text-amber-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
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
                  Diminishing balance at{' '}
                  {annualRatePct > 0 ? `${annualRatePct.toFixed(1)}%` : 'the rate'} a year
                  charges each month on that month&apos;s opening book value, so the amount
                  falls every period and the value never quite reaches zero — whatever the
                  rate has not consumed stays on the book. A useful life only caps how far
                  the schedule is written.
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
                      Runs the depreciation engine from{' '}
                      {form.depreciationStartDate || 'the start date'} to today, aligned to the
                      configured fiscal calendar where it reaches the start date (twelve-month
                      blocks otherwise).
                    </p>

                    {projection ? (
                      <div className="mt-2">
                        {projectionStale && (
                          <div className="mb-2 flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5">
                            <p className="text-[11px] text-amber-800">
                              The inputs changed — these figures describe the previous ones.
                            </p>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={runProjection}
                              disabled={projecting}
                            >
                              {projecting ? '…' : 'Recalculate'}
                            </Button>
                          </div>
                        )}

                        <div
                          className={`rounded-lg bg-gray-50 p-3 text-center ${
                            projectionStale ? 'opacity-50' : ''
                          }`}
                        >
                          <p className="text-[11px] uppercase tracking-wide text-gray-400">
                            Value left today
                          </p>
                          <p className="mt-0.5 text-xl font-semibold text-primarycolor">
                            {money(projection.netBookValueToDate, currency)}
                          </p>
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            after {money(projection.accumulatedToDate, currency)} over{' '}
                            {projection.elapsedMonths} months
                          </p>
                          {projection.isFiscalAligned &&
                            projection.lastClosedFiscalYearCode && (
                              <p className="mt-1.5 inline-block rounded-full bg-primarycolor/10 px-2 py-0.5 text-[10px] font-medium text-primarycolor">
                                History complete through {projection.lastClosedFiscalYearCode}
                              </p>
                            )}
                        </div>

                        <div className={projectionStale ? 'opacity-50' : ''}>
                          <Row
                            label={
                              projection.currentFiscalYearCode
                                ? `${projection.currentFiscalYearCode} charge`
                                : "This year's charge"
                            }
                            value={money(projection.currentYearCharge, currency)}
                            muted
                          />
                        </div>

                        <Button
                          variant="secondary"
                          size="small"
                          className="mt-2 w-full"
                          onClick={() => {
                            setExpandedYears(new Set());
                            setHistoryOpen(true);
                          }}
                        >
                          View year by year
                        </Button>
                        <Button
                          size="small"
                          className="mt-1.5 w-full"
                          disabled={projectionStale}
                          onClick={() => {
                            // Fiscal cutover: save the triple — opening accumulated,
                            // opening NBV, and the through-date — so the posted schedule
                            // starts at the current fiscal year with nothing recharged.
                            // The anniversary fallback keeps the value-as-of-today figure.
                            const fiscal =
                              projection.isFiscalAligned &&
                              projection.accumulatedThroughCutover != null;
                            set({
                              openingAccumulatedDepreciation: String(
                                fiscal
                                  ? projection.accumulatedThroughCutover
                                  : projection.accumulatedToDate
                              ),
                              ...(fiscal && projection.netBookValueAtCutover != null
                                ? {
                                    openingNetBookValue: String(
                                      projection.netBookValueAtCutover
                                    ),
                                  }
                                : {}),
                              ...(fiscal && projection.cutoverThroughDate
                                ? {
                                    lastDepreciationThroughDate:
                                      projection.cutoverThroughDate.slice(0, 10),
                                  }
                                : {}),
                            });
                            setStartMode('opening');
                            setProjection(null);
                          }}
                        >
                          Use as opening balance
                        </Button>
                        <p className="mt-1 text-center text-[10px] leading-snug text-gray-400">
                          {projection.isFiscalAligned && projection.cutoverThroughDate
                            ? `Fills the Opening Balance fields with the history through ${
                                projection.lastClosedFiscalYearCode
                              } (ended ${projection.cutoverThroughDate.slice(
                                0,
                                10
                              )}) — only ${
                                projection.currentFiscalYearCode ?? 'the current year'
                              } onward remains to post.`
                            : 'Fills Opening Accumulated Depreciation with the value to date.'}
                        </p>
                      </div>
                    ) : (
                      <Button
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
                    <strong>{elapsedMonths}</strong> of the {lifeMonths || '—'} months have
                    already passed with nothing recorded against them. Calculate the value
                    below and save it as the opening balance, or the whole cost spreads over
                    the periods that remain.
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
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">
            Depreciation year by year
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            {projection?.isFiscalAligned ? (
              <>
                Every fiscal year from {projection?.depreciationStartDate?.slice(0, 10)} to the
                end of the asset&apos;s life, computed by the same engine that posts the books
                over the company&apos;s configured fiscal calendar. Click a year to see its
                monthly periods.
              </>
            ) : (
              <>
                Every year from {projection?.depreciationStartDate?.slice(0, 10)} to the end of
                the asset&apos;s life, computed by the same engine that posts the books. Years
                already elapsed are the history; the rest is what is still to come.
              </>
            )}
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
                {projection.isFiscalAligned && projection.lastClosedFiscalYearCode && (
                  <DetailField
                    label="History through"
                    value={`${projection.lastClosedFiscalYearCode} · ended ${
                      projection.cutoverThroughDate?.slice(0, 10) ?? ''
                    }`}
                  />
                )}
              </div>

              {projection.years.some((y) => y.periods.length > 0) && (
                <div className="mb-1.5 flex justify-end">
                  <button
                    type="button"
                    className="text-xs font-medium text-primarycolor hover:underline"
                    onClick={() =>
                      setExpandedYears((current) =>
                        current.size === projection.years.length
                          ? new Set()
                          : new Set(projection.years.map((y) => y.yearNumber))
                      )
                    }
                  >
                    {expandedYears.size === projection.years.length
                      ? 'Collapse all months'
                      : 'Expand all months'}
                  </button>
                </div>
              )}

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
                    {projection.years.map((year) => {
                      const expandable = year.periods.length > 0;
                      const expanded = expandable && expandedYears.has(year.yearNumber);
                      return (
                        <Fragment key={year.yearNumber}>
                          <tr
                            className={`border-b border-gray-100 ${
                              year.isCurrent
                                ? 'bg-primarycolor/5'
                                : year.elapsed
                                ? ''
                                : 'opacity-60'
                            } ${expandable ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                            onClick={() => {
                              if (!expandable) return;
                              setExpandedYears((current) => {
                                const next = new Set(current);
                                if (next.has(year.yearNumber)) next.delete(year.yearNumber);
                                else next.add(year.yearNumber);
                                return next;
                              });
                            }}
                            aria-expanded={expandable ? expanded : undefined}
                          >
                            <td className="px-3 py-2 font-medium">
                              <span className="inline-flex items-center gap-1.5">
                                {expandable && (
                                  <span
                                    className={`inline-block text-[9px] text-gray-400 transition-transform ${
                                      expanded ? 'rotate-90' : ''
                                    }`}
                                    aria-hidden
                                  >
                                    ▶
                                  </span>
                                )}
                                {year.fiscalYearCode ?? year.yearNumber}
                              </span>
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
                          {expanded &&
                            year.periods.map((month) => (
                              <tr
                                key={`${year.yearNumber}-${month.periodOrdinal}-${month.from}`}
                                className="border-b border-gray-50 bg-gray-50/60 text-xs"
                              >
                                <td className="py-1.5 pl-9 pr-3 text-gray-500">
                                  {month.monthName ?? `Month ${month.periodOrdinal}`}
                                </td>
                                <td className="px-3 py-1.5 text-gray-400">
                                  {month.from.slice(0, 10)} → {month.to.slice(0, 10)}
                                </td>
                                <td className="px-3 py-1.5 text-right text-gray-500">
                                  {money(month.closingNetBookValue + month.charge, currency)}
                                </td>
                                <td className="px-3 py-1.5 text-right text-gray-600">
                                  {money(month.charge, currency)}
                                </td>
                                <td className="px-3 py-1.5 text-right text-gray-500">
                                  {money(month.accumulatedAtEnd, currency)}
                                </td>
                                <td className="px-3 py-1.5 text-right text-gray-500">
                                  {money(month.closingNetBookValue, currency)}
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                  </tbody>
                  <tfoot className="sticky bottom-0 border-t border-gray-200 bg-gray-50 text-xs font-medium text-gray-700">
                    <tr>
                      <td className="px-3 py-2" colSpan={3}>
                        Total — {projection.years.reduce((n, y) => n + y.months, 0)} months
                      </td>
                      <td className="px-3 py-2 text-right">
                        {money(
                          projection.years.reduce((sum, y) => sum + y.charge, 0),
                          currency
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {money(
                          projection.years[projection.years.length - 1]?.accumulatedAtEnd ?? 0,
                          currency
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {money(
                          projection.years[projection.years.length - 1]?.closingNetBookValue ??
                            projection.cost,
                          currency
                        )}
                      </td>
                    </tr>
                  </tfoot>
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
