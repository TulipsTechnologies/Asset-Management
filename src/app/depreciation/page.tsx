'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Providers/ToastProvider';
import Button from '@/components/UI/Button';
import ConfirmationModal from '@/components/UI/ConfirmationModel';
import CustomTable from '@/components/CustomTable/CustomTable';
import {
  ITableFilters,
  TTableColumn,
} from '@/components/CustomTable/CustomTableInterface';
import CustomMenuItem from '@/components/UI/CustomMenuItem';
import Dropdown from '@/components/UI/Dropdown';
import RowKebab from '@/components/UI/RowKebab';
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetBook,
  IAssetBookFilter,
  IDepreciationRun,
  IDepreciationExclusion,
  IDepreciationRunDetail,
  IDepreciationRunFilter,
  IDepreciationSchedule,
  IFiscalPeriod,
  IJournalProposal,
  IJournalProposalFilter,
} from '@/interface/IDepreciation';
import { IAssetListItem } from '@/interface/IAsset';
import {
  approveRun,
  calculateRun,
  deleteAssetBook,
  discardRun,
  fetchAssetBooks,
  fetchBookSchedule,
  fetchDepreciationRun,
  fetchDepreciationRuns,
  fetchFiscalPeriods,
  fetchFiscalYears,
  fetchJournalProposal,
  fetchJournalProposals,
  fetchRunDetails,
  postRun,
  reverseRun,
  reviseEstimate,
} from '@/services/depreciation.service';
import { assignAssetTaxClass, seedNepalRulePack } from '@/services/tax.service';
import ReasonBanner from '@/components/UI/ReasonBanner';
import ConventionSwitchModal from './_components/ConventionSwitchModal';
import ScheduleModal from './_components/ScheduleModal';
import TaxRunModal from './_components/TaxRunModal';
import OpeningBalanceImportModal from './_components/OpeningBalanceImportModal';
import { NEPAL_TAX_CLASSES, TAX_ENTRY_PERIODS, TaxTreatmentEnum } from '@/interface/ITax';
import { mergeTableFilters, unwrapPaged } from '@/utils/serviceUtils';
import { shortDate } from '@/components/Assets/AssetViewShared';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  AssetBookStatusEnum,
  BOOK_STATUS_BADGE_CLASSES,
  BOOK_STATUS_LABELS,
  CONVENTION_BADGE_CLASSES,
  CONVENTION_LABELS,
  DepreciationConventionEnum,
  DepreciationRunStatusEnum,
  FiscalPeriodStatusEnum,
  PROPOSAL_SOURCE_LABELS,
  PROPOSAL_STATUS_BADGE_CLASSES,
  PROPOSAL_STATUS_LABELS,
  RUN_INCLUSION_NOTE,
  RUN_STATUS_BADGE_CLASSES,
  RUN_STATUS_LABELS,
} from '@/enum/depreciationEnums';
import useDebounce from '@/hooks/useDebounce';

// Delegates to the module's one date formatter. This was one of 18 identical local copies
// rendering the locale default ("8/20/2026"), which reads as a different day outside the US
// and disagreed with the dashboard and the printed sheets.
const formatDate = (value?: string | null) => shortDate(value);

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

/** Money for dense table cells: the column header carries the currency, not every row. */
const amount = (value?: number | null) =>
  value == null
    ? '—'
    : value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

/** A figure in the run's summary band. `hero` marks the one people open this for. */
const RunStat = ({
  label,
  value,
  foot,
  hero,
}: {
  label: string;
  value: React.ReactNode;
  foot?: string | null;
  hero?: boolean;
}) => (
  <div
    className={`rounded-xl border px-4 py-3 ${
      hero ? 'border-primarycolor/30 bg-primarycolor/5' : 'border-gray-100 bg-white shadow-sm'
    }`}
  >
    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p
      className={`mt-1 tabular-nums leading-tight ${
        hero ? 'text-2xl font-bold text-primarycolor' : 'text-lg font-semibold text-gray-800'
      }`}
    >
      {value}
    </p>
    {foot ? <p className="mt-1 truncate text-[11px] text-gray-400">{foot}</p> : null}
  </div>
);

const Badge = ({ label, classes }: { label: string; classes: string }) => (
  <span className={`rounded px-2 py-0.5 text-xs font-medium ${classes}`}>
    {label}
  </span>
);

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

export default function DepreciationPage() {
  const { addToast } = useToast();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'books' | 'runs' | 'proposals'>('books');

  // ---------------------------------------------------------------- books
  const [books, setBooks] = useState<IAssetBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(false);
  const [booksTotal, setBooksTotal] = useState(0);
  const [booksPageCount, setBooksPageCount] = useState(0);
  const [bookFilters, setBookFilters] = useState<IAssetBookFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [bookSearch, setBookSearch] = useState('');
  const debouncedBookSearch = useDebounce(bookSearch, 400);

  // ---------------------------------------------------------------- runs
  const [runs, setRuns] = useState<IDepreciationRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPageCount, setRunsPageCount] = useState(0);
  const [runFilters, setRunFilters] = useState<IDepreciationRunFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ---------------------------------------------------------------- proposals
  const [proposals, setProposals] = useState<IJournalProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalsTotal, setProposalsTotal] = useState(0);
  const [proposalsPageCount, setProposalsPageCount] = useState(0);
  const [proposalFilters, setProposalFilters] = useState<IJournalProposalFilter>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ---------------------------------------------------------------- modals
  const [saving, setSaving] = useState(false);

  const [viewingBook, setViewingBook] = useState<IAssetBook | null>(null);
  const [schedule, setSchedule] = useState<IDepreciationSchedule[]>([]);

  const [revising, setRevising] = useState<IAssetBook | null>(null);
  const [reviseForm, setReviseForm] = useState({ residualValue: '', usefulLifeMonths: '', reason: '' });

  const [deletingBook, setDeletingBook] = useState<IAssetBook | null>(null);
  const [switchingBook, setSwitchingBook] = useState<IAssetBook | null>(null);
  const [taxRunOpen, setTaxRunOpen] = useState(false);
  const [openingImportOpen, setOpeningImportOpen] = useState(false);

  const [calculateOpen, setCalculateOpen] = useState(false);
  const [openPeriods, setOpenPeriods] = useState<IFiscalPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  // Separate from the page-wide `saving` so the run's own in-flight state governs the
  // button, and the modal can stay open afterwards to show what the run did.
  const [calculating, setCalculating] = useState(false);
  const [calculateResult, setCalculateResult] = useState<IDepreciationRun | null>(null);
  const [calculateFailure, setCalculateFailure] = useState<{
    code?: string | null;
    message?: string | null;
  } | null>(null);

  const [viewingRun, setViewingRun] = useState<IDepreciationRun | null>(null);
  const [runDetails, setRunDetails] = useState<IDepreciationRunDetail[]>([]);
  const [runExclusions, setRunExclusions] = useState<IDepreciationExclusion[]>([]);

  const [reversing, setReversing] = useState<IDepreciationRun | null>(null);
  const [reverseReason, setReverseReason] = useState('');

  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    run: IDepreciationRun;
    kind: 'approve' | 'post' | 'discard';
  } | null>(null);

  const [viewingProposal, setViewingProposal] = useState<IJournalProposal | null>(null);

  // ---------------------------------------------------------------- loaders

  const loadBooks = useCallback(async () => {
    setBooksLoading(true);
    try {
      const response = await fetchAssetBooks({
        pageNumber: bookFilters.pageNumber,
        pageSize: bookFilters.pageSize,
        sortBy: bookFilters.sortBy,
        sortDesc: bookFilters.sortDesc,
        search: debouncedBookSearch || undefined,
      });
      const { items, rowCount, pageCount } = unwrapPaged<IAssetBook>(response);
      setBooks(items);
      setBooksTotal(rowCount);
      setBooksPageCount(pageCount);
    } catch {
      addToast.error('Could not load asset books.');
    } finally {
      setBooksLoading(false);
    }
  }, [
    bookFilters.pageNumber,
    bookFilters.pageSize,
    bookFilters.sortBy,
    bookFilters.sortDesc,
    debouncedBookSearch,
    addToast,
  ]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const response = await fetchDepreciationRuns({
        pageNumber: runFilters.pageNumber,
        pageSize: runFilters.pageSize,
        sortBy: runFilters.sortBy,
        sortDesc: runFilters.sortDesc,
      });
      const { items, rowCount, pageCount } = unwrapPaged<IDepreciationRun>(response);
      setRuns(items);
      setRunsTotal(rowCount);
      setRunsPageCount(pageCount);
    } catch {
      addToast.error('Could not load depreciation runs.');
    } finally {
      setRunsLoading(false);
    }
  }, [
    runFilters.pageNumber,
    runFilters.pageSize,
    runFilters.sortBy,
    runFilters.sortDesc,
    addToast,
  ]);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const response = await fetchJournalProposals({
        pageNumber: proposalFilters.pageNumber,
        pageSize: proposalFilters.pageSize,
        sortBy: proposalFilters.sortBy,
        sortDesc: proposalFilters.sortDesc,
      });
      const { items, rowCount, pageCount } = unwrapPaged<IJournalProposal>(response);
      setProposals(items);
      setProposalsTotal(rowCount);
      setProposalsPageCount(pageCount);
    } catch {
      addToast.error('Could not load journal proposals.');
    } finally {
      setProposalsLoading(false);
    }
  }, [
    proposalFilters.pageNumber,
    proposalFilters.pageSize,
    proposalFilters.sortBy,
    proposalFilters.sortDesc,
    addToast,
  ]);

  // ---------------------------------------------------------------- filter merges

  // One per tab: each table pages and sorts its own list, and mergeTableFilters is what
  // lets the sort CustomTable emits survive as far as the service (a hand-rolled merge
  // that forwarded only paging is how the sort used to be dropped one layer early).
  const updateBookFilters = (updates: Partial<ITableFilters>) =>
    setBookFilters((prev) => mergeTableFilters(prev, updates));

  const updateRunFilters = (updates: Partial<ITableFilters>) =>
    setRunFilters((prev) => mergeTableFilters(prev, updates));

  const updateProposalFilters = (updates: Partial<ITableFilters>) =>
    setProposalFilters((prev) => mergeTableFilters(prev, updates));

  // Only the active tab fetches (returns precedent).
  useEffect(() => {
    if (activeTab === 'books') loadBooks();
  }, [loadBooks, activeTab]);

  useEffect(() => {
    if (activeTab === 'runs') loadRuns();
  }, [loadRuns, activeTab]);

  useEffect(() => {
    if (activeTab === 'proposals') loadProposals();
  }, [loadProposals, activeTab]);

  // ---------------------------------------------------------------- actions

  // Capitalization and basis edits live on their own page: the form carries three related
  // decisions and the arithmetic that ties them together, which a dialog had no room for.
  const openEditBook = (book: IAssetBook) =>
    router.push(`/depreciation/capitalize?bookId=${book.id}`);

  const openCapitalize = () => router.push('/depreciation/capitalize');

  const openSchedule = async (book: IAssetBook) => {
    setViewingBook(book);
    setSchedule([]);
    try {
      const response = await fetchBookSchedule(book.id);
      setSchedule(response?.data ?? []);
    } catch {
      addToast.error('Could not load the schedule.');
    }
  };

  const submitRevise = async () => {
    if (!revising) return;
    setSaving(true);
    try {
      const response = await reviseEstimate(revising.id, {
        residualValue: Number(reviseForm.residualValue || 0),
        usefulLifeMonths: Number(reviseForm.usefulLifeMonths || 0),
        reason: reviseForm.reason || undefined,
        rowVersion: revising.rowVersion,
      });
      if (response?.success) addToast.success(response.message || 'Estimate revised.');
      else addToast.error(response?.message || 'Could not revise the estimate.');
    } catch {
      addToast.error('Could not revise the estimate.');
    } finally {
      setSaving(false);
      setRevising(null);
      loadBooks();
    }
  };

  const submitDeleteBook = async () => {
    if (!deletingBook) return;
    setSaving(true);
    try {
      const response = await deleteAssetBook(deletingBook.id, deletingBook.rowVersion);
      if (response?.success) addToast.success(response.message || 'Capitalization reversed.');
      else addToast.error(response?.message || 'Could not delete the book.');
    } catch {
      addToast.error('Could not delete the book.');
    } finally {
      setSaving(false);
      setDeletingBook(null);
      loadBooks();
    }
  };

  const openCalculate = async () => {
    setSelectedPeriodId('');
    setCalculateResult(null);
    setCalculateFailure(null);
    setCalculateOpen(true);
    try {
      // Ask for the CURRENT fiscal year's periods, not "the first hundred open ones".
      // Every period of every future year is open, so an unscoped page — returned newest
      // first — was entirely years away from now and did not even contain the current
      // year: 324 open periods, page size 100, current year nowhere in it.
      const today = new Date().toISOString().slice(0, 10);
      const years = (await fetchFiscalYears())?.data ?? [];
      const currentYear =
        years.find(
          (y) => y.startDate.slice(0, 10) <= today && y.endDate.slice(0, 10) >= today
        ) ??
        // No year contains today (a gap in the calendar): use the latest one that has begun.
        [...years]
          .filter((y) => y.startDate.slice(0, 10) <= today)
          .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];

      if (!currentYear) {
        setOpenPeriods([]);
        return;
      }

      const response = await fetchFiscalPeriods({
        pageNumber: 1,
        pageSize: 12,
        fiscalYearId: currentYear.id,
        status: FiscalPeriodStatusEnum.Open,
      });
      setOpenPeriods(unwrapPaged<IFiscalPeriod>(response).items);
    } catch {
      addToast.error('Could not load open periods.');
    }
  };

  const submitCalculate = async () => {
    if (!selectedPeriodId) {
      addToast.error('Pick a period to run.');
      return;
    }
    // Guard against a second submission while the first is in flight: the server refuses a
    // duplicate run for the period, but a double-click should not depend on that.
    if (calculating) return;

    setCalculating(true);
    setCalculateFailure(null);
    try {
      const response = await calculateRun(selectedPeriodId);

      if (!response?.success) {
        setCalculateFailure({
          code: response?.reasonCode,
          message: response?.message || 'Could not calculate the run.',
        });
        return;
      }

      addToast.success(response.message || 'Run calculated.');

      // The calculate endpoint returns only the new run's id, so the figures the summary
      // shows — counts, total, exclusions — are read back from the run itself.
      const run = await fetchDepreciationRun(response.data);
      if (run?.success && run.data) setCalculateResult(run.data);
      else setCalculateOpen(false);

      loadRuns();
    } catch {
      setCalculateFailure({ message: 'Could not calculate the run.' });
    } finally {
      setCalculating(false);
    }
  };

  const openRunDetails = async (run: IDepreciationRun) => {
    setViewingRun(run);
    setRunDetails([]);
    setRunExclusions([]);
    try {
      // Two reads: the lines, and the run itself — the exclusion list is only populated on
      // a single-run fetch, not on the list the table was built from.
      const [details, full] = await Promise.all([
        fetchRunDetails(run.id),
        fetchDepreciationRun(run.id),
      ]);
      setRunDetails(details?.data ?? []);
      if (full?.success && full.data) {
        setRunExclusions(full.data.exclusions ?? []);
        setViewingRun(full.data);
      }
    } catch {
      addToast.error('Could not load run details.');
    }
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    const { run, kind } = confirmAction;
    setSaving(true);
    try {
      const call =
        kind === 'approve' ? approveRun : kind === 'post' ? postRun : discardRun;
      const response = await call(run.id, run.rowVersion);
      if (response?.success) addToast.success(response.message || 'Done.');
      else addToast.error(response?.message || 'The action could not be completed.');
    } catch {
      addToast.error('The action could not be completed.');
    } finally {
      setSaving(false);
      setConfirmAction(null);
      loadRuns();
    }
  };

  const submitReverse = async () => {
    if (!reversing) return;
    if (!reverseReason.trim()) {
      addToast.error('A reason is required to reverse a posted run.');
      return;
    }
    setSaving(true);
    try {
      const response = await reverseRun(reversing.id, reversing.rowVersion, reverseReason.trim());
      if (response?.success) addToast.success(response.message || 'Run reversed.');
      else addToast.error(response?.message || 'Could not reverse the run.');
    } catch {
      addToast.error('Could not reverse the run.');
    } finally {
      setSaving(false);
      setReversing(null);
      setReverseReason('');
      loadRuns();
    }
  };

  const openProposal = async (proposal: IJournalProposal) => {
    setViewingProposal(proposal);
    try {
      const response = await fetchJournalProposal(proposal.id);
      if (response?.data) setViewingProposal(response.data);
    } catch {
      addToast.error('Could not load the proposal lines.');
    }
  };

  // ---------------------------------------------------------------- columns

  // sortField names an AssetBook ENTITY property, so the database orders every book and
  // hands back page 1. Asset, Category and Method are joined in from Asset / AssetCategory
  // / DepreciationMethod, and Net Book Value is computed in the projection
  // (Cost − Accumulated) — none of them is a column the database can order by, so they
  // carry no sortField and correctly show no sort control.
  const bookColumns: TTableColumn[] = [
    { key: 'asset', label: 'Asset', width: 200, type: 'string', name: 'asset' },
    { key: 'category', label: 'Category', width: 140, type: 'string', name: 'category' },
    // Formatted money, ordered by the stored decimal behind it.
    { key: 'cost', label: 'Cost', width: 130, name: 'cost', sortField: 'Cost' },
    {
      key: 'accumulated',
      label: 'Accumulated',
      width: 130,
      name: 'accumulated',
      sortField: 'AccumulatedDepreciation',
    },
    { key: 'nbv', label: 'Net Book Value', width: 140, name: 'nbv' },
    { key: 'method', label: 'Method', width: 130, name: 'method' },
    // Badges, ordered by the enums they render.
    {
      key: 'convention',
      label: 'Convention',
      width: 120,
      name: 'convention',
      sortField: 'DepreciationConvention',
    },
    { key: 'status', label: 'Status', width: 90, name: 'status', sortField: 'Status' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  // Period carries no sortField: the cell is fiscal year + month name + ordinal, and the
  // month name is joined from FiscalPeriod. The one entity column behind it, FiscalYearCode,
  // is identical on every row of a single year — a sort by it would visibly do nothing on
  // the ordinary list. Chronology is what Run Date orders, and the server's default order
  // (year then period, newest first) is what the table opens on.
  const runColumns: TTableColumn[] = [
    { key: 'period', label: 'Period', width: 160, type: 'string', name: 'period' },
    { key: 'status', label: 'Status', width: 110, name: 'status', sortField: 'Status' },
    { key: 'assetCount', label: 'Assets', width: 80, name: 'assetCount', sortField: 'AssetCount' },
    {
      key: 'excludedAssetCount',
      label: 'Excluded',
      width: 90,
      name: 'excludedAssetCount',
      sortField: 'ExcludedAssetCount',
    },
    { key: 'totalAmount', label: 'Total', width: 150, name: 'totalAmount', sortField: 'TotalAmount' },
    { key: 'runDate', label: 'Run Date', width: 110, name: 'runDate', sortField: 'RunDate' },
    { key: 'postedOn', label: 'Posted', width: 110, name: 'postedOn', sortField: 'PostedOn' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  // The outbox endpoint honours SortBy over the JournalProposal entity. Period is left
  // unsortable for the same reason as the runs table: the cell is fiscal year AND ordinal,
  // and neither alone orders what it shows. Date is the chronological handle.
  const proposalColumns: TTableColumn[] = [
    { key: 'source', label: 'Source', width: 130, name: 'source', sortField: 'SourceType' },
    { key: 'period', label: 'Period', width: 140, type: 'string', name: 'period' },
    { key: 'debit', label: 'Debit', width: 140, name: 'debit', sortField: 'TotalDebit' },
    { key: 'credit', label: 'Credit', width: 140, name: 'credit', sortField: 'TotalCredit' },
    { key: 'status', label: 'Status', width: 110, name: 'status', sortField: 'Status' },
    {
      key: 'proposalDate',
      label: 'Date',
      width: 110,
      name: 'proposalDate',
      sortField: 'ProposalDate',
    },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  // ---------------------------------------------------------------- rows

  const bookRows = books.map((book) => ({
    ...book,
    asset: (
      <div>
        <p className="font-medium text-gray-800">{book.assetCode}</p>
        <p className="text-xs text-gray-500">{book.assetName}</p>
      </div>
    ),
    category: book.assetCategoryName,
    cost: money(book.cost, book.currencyId),
    accumulated: money(book.accumulatedDepreciation, book.currencyId),
    nbv: money(book.netBookValue, book.currencyId),
    method: book.depreciationMethodName,
    convention: (
      <Badge
        label={
          CONVENTION_LABELS[book.depreciationConvention] ??
          String(book.depreciationConvention)
        }
        classes={
          CONVENTION_BADGE_CLASSES[book.depreciationConvention] ??
          'bg-gray-100 text-gray-700'
        }
      />
    ),
    status: (
      <Badge
        label={BOOK_STATUS_LABELS[book.status] ?? String(book.status)}
        classes={BOOK_STATUS_BADGE_CLASSES[book.status] ?? 'bg-gray-100 text-gray-700'}
      />
    ),
    actions: (
      <div className="flex justify-center">
        <Dropdown
          ariaLabel="Row actions"
          buttonChildren={<RowKebab />}
          position="fixed"
        >
          {[
            {
              label: 'View Schedule',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => openSchedule(book),
            },
            ...(book.status === 1
              ? [
                  {
                    label: 'Revise Estimate',
                    icon: <i className="icon icon-redo text-sm" />,
                    action: () => {
                      setRevising(book);
                      setReviseForm({
                        residualValue: String(book.residualValue),
                        usefulLifeMonths: String(book.usefulLifeMonths),
                        reason: '',
                      });
                    },
                  },
                ]
              : []),
            // Prospective, so it is offered whether or not anything has posted — posted
            // periods keep the numbers they were posted with.
            ...(book.depreciationConvention === DepreciationConventionEnum.FullMonth &&
            book.status === AssetBookStatusEnum.Active
              ? [
                  {
                    label: 'Switch to Actual Calendar Days',
                    icon: <i className="icon icon-calendar text-sm" />,
                    action: () => setSwitchingBook(book),
                  },
                ]
              : []),
            ...(!book.hasPostedDepreciation
              ? [
                  {
                    // Basis edit — only until anything posts (Rule A); after that the
                    // prospective path is Revise Estimate.
                    label: 'Edit Book',
                    icon: <i className="icon icon-edit text-sm" />,
                    action: () => openEditBook(book),
                  },
                  {
                    label: 'Delete',
                    icon: <i className="icon icon-trash text-sm" />,
                    action: () => setDeletingBook(book),
                  },
                ]
              : []),
          ].map((option, index, arr) => (
            <CustomMenuItem
              key={index}
              label={option.label}
              onClick={option.action}
              border={index !== arr.length - 1}
              icon={option.icon}
              className="!py-2"
            />
          ))}
        </Dropdown>
      </div>
    ),
  }));

  const runRows = runs.map((run) => ({
    ...run,
    period: (
      <div>
        <p className="font-medium text-gray-800">
          {run.fiscalYearCode} · {run.monthName}
        </p>
        <p className="text-xs text-gray-500">Period {run.periodOrdinal}</p>
      </div>
    ),
    status: (
      <Badge
        label={RUN_STATUS_LABELS[run.status] ?? String(run.status)}
        classes={RUN_STATUS_BADGE_CLASSES[run.status] ?? 'bg-gray-100 text-gray-700'}
      />
    ),
    assetCount: run.assetCount,
    excludedAssetCount:
      run.excludedAssetCount > 0 ? (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
          {run.excludedAssetCount}
        </span>
      ) : (
        <span className="text-gray-400">0</span>
      ),
    totalAmount: money(run.totalAmount, run.currencyId),
    runDate: formatDate(run.runDate),
    postedOn: formatDate(run.postedOn),
    actions: (
      <div className="flex justify-center">
        <Dropdown
          ariaLabel="Row actions"
          buttonChildren={<RowKebab />}
          position="fixed"
        >
          {[
            {
              label: 'View Details',
              icon: <i className="icon icon-eye text-sm" />,
              action: () => openRunDetails(run),
            },
            ...(run.status === DepreciationRunStatusEnum.Calculated
              ? [
                  {
                    label: 'Approve',
                    icon: <i className="icon icon-check text-sm" />,
                    action: () =>
                      setConfirmAction({
                        run,
                        kind: 'approve',
                        message: `Approve depreciation of ${money(
                          run.totalAmount,
                          run.currencyId
                        )} across ${run.assetCount} asset(s) for ${run.fiscalYearCode}/${run.periodOrdinal}?`,
                      }),
                  },
                  {
                    label: 'Discard',
                    icon: <i className="icon icon-close text-sm" />,
                    action: () =>
                      setConfirmAction({
                        run,
                        kind: 'discard',
                        message:
                          'Discard this calculated run? The period becomes free to run again.',
                      }),
                  },
                ]
              : []),
            ...(run.status === DepreciationRunStatusEnum.Approved
              ? [
                  {
                    label: 'Post',
                    icon: <i className="icon icon-check text-sm" />,
                    action: () =>
                      setConfirmAction({
                        run,
                        kind: 'post',
                        message: `Post ${money(
                          run.totalAmount,
                          run.currencyId
                        )} to the ledger? Every guard is re-checked at this point, and posting can only be undone by a reversal.`,
                      }),
                  },
                ]
              : []),
            ...(run.status === DepreciationRunStatusEnum.Posted
              ? [
                  {
                    label: 'Reverse',
                    icon: <i className="icon icon-redo text-sm" />,
                    action: () => {
                      setReversing(run);
                      setReverseReason('');
                    },
                  },
                ]
              : []),
          ].map((option, index, arr) => (
            <CustomMenuItem
              key={index}
              label={option.label}
              onClick={option.action}
              border={index !== arr.length - 1}
              icon={option.icon}
              className="!py-2"
            />
          ))}
        </Dropdown>
      </div>
    ),
  }));

  const proposalRows = proposals.map((proposal) => ({
    ...proposal,
    source: PROPOSAL_SOURCE_LABELS[proposal.sourceType] ?? String(proposal.sourceType),
    period: `${proposal.fiscalYearCode} · ${proposal.periodOrdinal}`,
    debit: money(proposal.totalDebit, proposal.currencyId),
    credit: money(proposal.totalCredit, proposal.currencyId),
    status: (
      <Badge
        label={PROPOSAL_STATUS_LABELS[proposal.status] ?? String(proposal.status)}
        classes={
          PROPOSAL_STATUS_BADGE_CLASSES[proposal.status] ?? 'bg-gray-100 text-gray-700'
        }
      />
    ),
    proposalDate: formatDate(proposal.proposalDate),
    actions: (
      <div className="flex justify-center">
        <Dropdown
          ariaLabel="Row actions"
          buttonChildren={<RowKebab />}
          position="fixed"
        >
          <CustomMenuItem
            label="View Lines"
            onClick={() => openProposal(proposal)}
            icon={<i className="icon icon-eye text-sm" />}
            className="!py-2"
          />
        </Dropdown>
      </div>
    ),
  }));

  const selectedPeriod = openPeriods.find((p) => p.id === selectedPeriodId);

  /**
   * Runnable periods: the CURRENT fiscal year's, oldest first, and none that has not begun.
   *
   * Every period of every future year is "open" — nothing has closed them — so an unfiltered
   * list offered years away from now, newest first, which put the most wrong choice at the
   * top. A run also cannot depreciate a period that has not started. Earlier unrun periods
   * need no entry of their own: the run sweeps them in as flagged catch-up lines, which is
   * what the note at the top of this dialog says.
   */
  const runnablePeriods = (() => {
    if (openPeriods.length === 0) return [];
    const today = new Date().toISOString().slice(0, 10);

    const currentYearCode = openPeriods.find(
      (p) => p.startDate.slice(0, 10) <= today && p.endDate.slice(0, 10) >= today
    )?.fiscalYearCode;

    // No period contains today (a calendar gap): fall back to the latest year that has
    // started, so the dialog still offers the nearest real choice rather than the future.
    const fallbackCode = [...openPeriods]
      .filter((p) => p.startDate.slice(0, 10) <= today)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0]?.fiscalYearCode;

    const yearCode = currentYearCode ?? fallbackCode;
    if (!yearCode) return [];

    return openPeriods
      .filter((p) => p.fiscalYearCode === yearCode && p.startDate.slice(0, 10) <= today)
      .sort((a, b) => a.periodOrdinal - b.periodOrdinal);
  })();

  const runFiscalYearCode = runnablePeriods[0]?.fiscalYearCode ?? null;

  // ---------------------------------------------------------------- render

  return (
    <div className="px-4 mt-2">
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-secondaryColor">Depreciation</h1>
        <p className="mt-0.5 text-xs text-gray-500">
          Asset books, period runs and the journal outbox. Asset Management proposes
          journals; it never writes to Finance directly.
        </p>
      </div>

      <div className="mb-4 flex gap-1 border-b border-gray-200" role="tablist">
        {(
          [
            { id: 'books', label: 'Books' },
            { id: 'runs', label: 'Runs' },
            { id: 'proposals', label: 'Journal Proposals' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === tab.id
                ? 'border-b-2 border-primarycolor text-secondaryColor'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'books' && (
        <>
          {/* Distinct key per tab: CustomTable seeds its column state from props once,
              so without this React reuses the instance and the columns bleed across. */}
          <CustomTable
            key="depreciation-books-table"
            columns={bookColumns}
            rows={bookRows}
            tableName="Asset Books"
            serialOffset={
              ((bookFilters.pageNumber ?? 1) - 1) *
              (bookFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={booksLoading}
            entityLabel="book"
            updateFilters={updateBookFilters}
            sortBy={bookFilters.sortBy}
            sortDesc={bookFilters.sortDesc}
            tableHeaderLeft={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={openCapitalize}>
                  <i className="icon icon-plus text-xs"></i>
                  <span>Add Depreciation</span>
                </Button>
                <Button variant="secondary" onClick={() => setOpeningImportOpen(true)}>
                  <i className="icon icon-import text-xs"></i>
                  <span>Opening Balance Import</span>
                </Button>
              </div>
            }
            tableHeaderRight={
              <SearchBox
                searchVal={bookSearch}
                onSearch={(value: string) => {
                  setBookSearch(value);
                  setBookFilters((prev) => ({ ...prev, pageNumber: 1 }));
                }}
              />
            }
          />
          <Pagination
            pageNumber={bookFilters.pageNumber ?? 1}
            totalPages={booksPageCount}
            pageSize={bookFilters.pageSize ?? DEFAULT_PAGE_SIZE}
            totalCount={booksTotal}
            updateFilters={updateBookFilters}
          />
        </>
      )}

      {activeTab === 'runs' && (
        <>
          <p className="mb-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
            {RUN_INCLUSION_NOTE}
          </p>
          <CustomTable
            key="depreciation-runs-table"
            columns={runColumns}
            rows={runRows}
            tableName="Depreciation Runs"
            serialOffset={
              ((runFilters.pageNumber ?? 1) - 1) *
              (runFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={runsLoading}
            entityLabel="run"
            updateFilters={updateRunFilters}
            sortBy={runFilters.sortBy}
            sortDesc={runFilters.sortDesc}
            tableHeaderLeft={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={openCalculate}>
                  <i className="icon icon-plus text-xs"></i>
                  <span>Calculate Run</span>
                </Button>
                <Button variant="secondary" onClick={() => setTaxRunOpen(true)}>
                  <i className="icon icon-file text-xs"></i>
                  <span>Nepal Tax Run</span>
                </Button>
              </div>
            }
          />
          <Pagination
            pageNumber={runFilters.pageNumber ?? 1}
            totalPages={runsPageCount}
            pageSize={runFilters.pageSize ?? DEFAULT_PAGE_SIZE}
            totalCount={runsTotal}
            updateFilters={updateRunFilters}
          />
        </>
      )}

      {activeTab === 'proposals' && (
        <>
          <p className="mb-3 rounded bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Proposals stay <strong>Pending</strong> until a Finance module consumes them.
            That is the design, not a failure — the outbox is written now so no history has
            to be reconstructed later.
          </p>
          <CustomTable
            key="depreciation-proposals-table"
            columns={proposalColumns}
            rows={proposalRows}
            tableName="Journal Proposals"
            serialOffset={
              ((proposalFilters.pageNumber ?? 1) - 1) *
              (proposalFilters.pageSize ?? DEFAULT_PAGE_SIZE)
            }
            isLoading={proposalsLoading}
            entityLabel="proposal"
            updateFilters={updateProposalFilters}
            sortBy={proposalFilters.sortBy}
            sortDesc={proposalFilters.sortDesc}
          />
          <Pagination
            pageNumber={proposalFilters.pageNumber ?? 1}
            totalPages={proposalsPageCount}
            pageSize={proposalFilters.pageSize ?? DEFAULT_PAGE_SIZE}
            totalCount={proposalsTotal}
            updateFilters={updateProposalFilters}
          />
        </>
      )}

      {/* ---------------------------------------------------------------- schedule */}
      <ScheduleModal
        book={viewingBook}
        schedule={schedule}
        onClose={() => setViewingBook(null)}
      />

      {/* ---------------------------------------------------------------- revise */}
      <Modal isOpen={!!revising} onClose={() => setRevising(null)} size="lg">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">Revise Estimate</h2>
          <p className="mb-4 text-xs text-gray-500">
            Applied <strong>prospectively</strong>: periods already posted keep the numbers
            they were posted with, and the remaining carrying amount is re-spread over the
            remaining life.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Residual Value"
              type="number"
              value={reviseForm.residualValue}
              onChange={(e) =>
                setReviseForm((prev) => ({ ...prev, residualValue: e.target.value }))
              }
            />
            <Input
              label="Useful Life (months)"
              type="number"
              value={reviseForm.usefulLifeMonths}
              onChange={(e) =>
                setReviseForm((prev) => ({ ...prev, usefulLifeMonths: e.target.value }))
              }
            />
          </div>

          <TextArea
            label="Reason"
            value={reviseForm.reason}
            onChange={(e) => setReviseForm((prev) => ({ ...prev, reason: e.target.value }))}
            className="mt-4"
          />

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRevising(null)}>
              Cancel
            </Button>
            <Button onClick={submitRevise} disabled={saving}>
              {saving ? 'Revising…' : 'Revise'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------- opening balance import */}
      <OpeningBalanceImportModal
        open={openingImportOpen}
        onClose={() => setOpeningImportOpen(false)}
        onApplied={loadBooks}
      />

      {/* ---------------------------------------------------------- nepal tax run */}
      <TaxRunModal open={taxRunOpen} onClose={() => setTaxRunOpen(false)} />

      {/* ------------------------------------------------- convention switch */}
      <ConventionSwitchModal
        book={switchingBook}
        onClose={() => setSwitchingBook(null)}
        onApplied={loadBooks}
      />

      {/* ---------------------------------------------------------------- calculate */}
      <Modal isOpen={calculateOpen} onClose={() => setCalculateOpen(false)} size="lg">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">Calculate Depreciation</h2>
          <p className="mb-4 text-xs text-gray-500">
            Amounts owed from earlier periods that were never run are swept into this one as
            flagged catch-up lines, rather than being lost.
          </p>

          <Select
            label="Period"
            required
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            options={runnablePeriods.map((p) => ({
              label: `${p.monthName} (period ${p.periodOrdinal})`,
              value: p.id,
            }))}
            placeholder={
              openPeriods.length === 0
                ? 'No open periods — create a fiscal year first'
                : runnablePeriods.length === 0
                  ? 'No period of the current fiscal year has started yet'
                  : 'Select a period'
            }
            helperText={
              runFiscalYearCode
                ? `Fiscal year ${runFiscalYearCode}. Later periods appear once they begin.`
                : undefined
            }
            disabled={!!calculateResult}
          />

          {/* What the run is about to do. The basis is per-BOOK, so it is stated as the
              rule rather than claimed as a single value for the whole run. */}
          {selectedPeriod && !calculateResult && (
            <div className="mt-4 rounded bg-gray-50 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <DetailField
                  label="Period"
                  value={`${selectedPeriod.fiscalYearCode} · ${selectedPeriod.monthName}`}
                />
                <DetailField
                  label="Period Start"
                  value={formatDate(selectedPeriod.startDate)}
                />
                <DetailField label="Period End" value={formatDate(selectedPeriod.endDate)} />
              </div>
              <p className="mt-3 text-xs text-gray-600">
                Each book is measured by its own convention. Books on{' '}
                <strong>Actual Calendar Days</strong> are depreciated using actual calendar
                days — the start boundary is excluded and the period-end date is included.
                Books on <strong>Full Month</strong> charge the whole period.
              </p>
            </div>
          )}

          {calculateFailure && (
            <ReasonBanner
              className="mt-4"
              code={calculateFailure.code}
              message={calculateFailure.message}
              severity="error"
            />
          )}

          {/* What the run actually did. */}
          {calculateResult && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded bg-gray-50 p-3">
                <DetailField label="Assets Calculated" value={calculateResult.assetCount} />
                <DetailField label="Excluded" value={calculateResult.excludedAssetCount} />
                <DetailField
                  label="Total Depreciation"
                  value={money(calculateResult.totalAmount, calculateResult.currencyId)}
                />
                <DetailField
                  label="Warnings"
                  value={calculateResult.exclusions?.length ?? 0}
                />
              </div>

              {calculateResult.exclusions && calculateResult.exclusions.length > 0 && (
                <ReasonBanner
                  reasons={calculateResult.exclusions.map((exclusion) => ({
                    code: exclusion.reasonCode,
                    message: exclusion.message,
                    subject: `${exclusion.assetCode} — ${exclusion.assetName}`,
                  }))}
                />
              )}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCalculateOpen(false)}>
              {calculateResult ? 'Close' : 'Cancel'}
            </Button>
            {calculateResult ? (
              <Button
                onClick={() => {
                  setCalculateOpen(false);
                  setActiveTab('runs');
                  openRunDetails(calculateResult);
                }}
              >
                View Run Details
              </Button>
            ) : (
              <Button
                onClick={submitCalculate}
                disabled={calculating || !selectedPeriodId}
              >
                {calculating ? 'Calculating…' : 'Calculate'}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- run details */}
      <Modal isOpen={!!viewingRun} onClose={() => setViewingRun(null)} size="6xl">
        {/* Header, summary and notices hold still; only the lines scroll, so the column
            headings stay with the figures they name. */}
        <div className="flex max-h-[86vh] flex-col">
          <div className="shrink-0 border-b border-gray-100 px-6 pb-4 pr-14 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-secondaryColor">
                Depreciation Run — {viewingRun?.fiscalYearCode} · {viewingRun?.monthName}
              </h2>
              {viewingRun && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    RUN_STATUS_BADGE_CLASSES[viewingRun.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {RUN_STATUS_LABELS[viewingRun.status]}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              {viewingRun?.assetCount ?? 0} asset
              {(viewingRun?.assetCount ?? 0) === 1 ? '' : 's'} charged
              {(viewingRun?.excludedAssetCount ?? 0) > 0
                ? `, ${viewingRun?.excludedAssetCount} excluded`
                : ''}
              {viewingRun?.postedOn
                ? ` · posted ${formatDate(viewingRun.postedOn)}`
                : ' · not posted'}
            </p>
          </div>

          <div className="shrink-0 px-6 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <RunStat
                hero
                label="Total charged"
                value={money(viewingRun?.totalAmount, viewingRun?.currencyId)}
              />
              <RunStat
                label="Current fiscal year"
                value={money(viewingRun?.currentYearTotal ?? 0, viewingRun?.currencyId)}
                foot={`${viewingRun?.fiscalYearCode ?? ''} · ${viewingRun?.monthName ?? ''}`}
              />
              <RunStat
                label="Historical catch-up"
                value={money(viewingRun?.priorYearCatchUpTotal ?? 0, viewingRun?.currencyId)}
                foot="Owed from earlier periods never run"
              />
            </div>
          </div>

          {/* Books the run considered and charged nothing for. Warnings, not failures. */}
          {runExclusions.length > 0 && (
            <div className="shrink-0 px-6 pt-4">
              <p className="mb-1.5 text-xs font-medium text-gray-600">
                Excluded assets ({runExclusions.length})
              </p>
              <div className="max-h-32 overflow-y-auto">
                <ReasonBanner
                  reasons={runExclusions.map((exclusion) => ({
                    code: exclusion.reasonCode,
                    message: exclusion.message,
                    subject: `${exclusion.assetCode} — ${exclusion.assetName}`,
                  }))}
                />
              </div>
            </div>
          )}

          {viewingRun?.reversalReason && (
            <p className="mx-6 mt-4 shrink-0 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
              Reversed: {viewingRun.reversalReason}
            </p>
          )}

          {/* Narrow screens scroll this table sideways rather than crushing the figures —
              a squeezed money column is unreadable, a scrolled one is merely narrow. */}
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-5 pt-4">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gray-100 text-left text-[11px] uppercase tracking-wide text-gray-600">
                  <th scope="col" className="rounded-l-lg py-2.5 pl-4 pr-3 font-semibold">
                    Asset
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">Basis</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Opening NBV
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">Charge</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Accumulated after
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    NBV after
                  </th>
                  <th scope="col" className="rounded-r-lg px-4 py-2.5 text-right font-semibold">
                    Residual
                  </th>
                </tr>
              </thead>
              <tbody>
                {runDetails.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">
                      No lines in this run.
                    </td>
                  </tr>
                )}
                {runDetails.map((detail) => (
                  <tr
                    key={detail.id}
                    className="border-b border-gray-100 align-top transition-colors hover:bg-gray-50"
                  >
                    <td className="py-2.5 pl-4 pr-3">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-medium text-gray-800">{detail.assetCode}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            detail.startingMode === 'OpeningBalance'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {detail.startingMode === 'OpeningBalance'
                            ? 'Opening balance'
                            : 'Historical catch-up'}
                        </span>
                        {detail.isCatchUp && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            catch-up
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {detail.assetName}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        In service {formatDate(detail.availableForUseDate)}
                        {detail.lastDepreciationThroughDate
                          ? ` · charged through ${formatDate(
                              detail.lastDepreciationThroughDate
                            )}`
                          : ''}
                      </p>
                      {detail.priorYearCatchUpAmount > 0 && (
                        <p className="mt-1 text-[11px] text-amber-700">
                          {amount(detail.priorYearCatchUpAmount)} prior-year ·{' '}
                          {amount(detail.currentYearAmount)} this year
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600">
                      {CONVENTION_LABELS[detail.depreciationConvention] ?? '—'}
                      <span className="mt-0.5 block text-[11px] text-gray-400">
                        {/* A whole-month book has no day count — the period IS the unit. */}
                        {detail.chargedDays != null
                          ? `${detail.chargedDays} day${detail.chargedDays === 1 ? '' : 's'}`
                          : 'Full period'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {amount(detail.netBookValueBefore)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-gray-800">
                      {amount(detail.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {amount(detail.closingAccumulated)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                      {amount(detail.netBookValueAfter)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600">
                      {amount(detail.residualValue)}
                    </td>
                  </tr>
                ))}
              </tbody>

              {runDetails.length > 0 && (
                <tfoot className="sticky bottom-0">
                  <tr className="bg-gray-100 text-sm font-semibold text-gray-800">
                    <td className="rounded-l-lg py-2.5 pl-4 pr-3">
                      Total{viewingRun?.currencyId ? ` (${viewingRun.currencyId.trim()})` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-normal text-gray-500">
                      {runDetails.length} line{runDetails.length === 1 ? '' : 's'}
                    </td>
                    <td className="px-3 py-2.5" />
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {amount(runDetails.reduce((sum, d) => sum + d.amount, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {amount(runDetails.reduce((sum, d) => sum + d.closingAccumulated, 0))}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {amount(runDetails.reduce((sum, d) => sum + d.netBookValueAfter, 0))}
                    </td>
                    <td className="rounded-r-lg px-4 py-2.5" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- reverse */}
      <Modal isOpen={!!reversing} onClose={() => setReversing(null)} size="md">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-secondaryColor">Reverse Run</h2>
          <p className="mb-4 text-xs text-gray-500">
            Restores every book&apos;s accumulated depreciation and emits a reversing journal
            proposal. Only the latest posted run can be reversed, and only while its period
            is open.
          </p>

          <TextArea
            label="Reason"
            required
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
          />

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReversing(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReverse} disabled={saving}>
              {saving ? 'Reversing…' : 'Reverse'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- proposal */}
      <Modal isOpen={!!viewingProposal} onClose={() => setViewingProposal(null)} size="3xl">
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-secondaryColor">Journal Proposal</h2>

          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4 rounded bg-gray-50 p-3">
            <DetailField
              label="Source"
              value={
                viewingProposal
                  ? PROPOSAL_SOURCE_LABELS[viewingProposal.sourceType]
                  : '—'
              }
            />
            <DetailField
              label="Period"
              value={
                viewingProposal
                  ? `${viewingProposal.fiscalYearCode} · ${viewingProposal.periodOrdinal}`
                  : '—'
              }
            />
            <DetailField
              label="Total Debit"
              value={money(viewingProposal?.totalDebit, viewingProposal?.currencyId)}
            />
            <DetailField
              label="Total Credit"
              value={money(viewingProposal?.totalCredit, viewingProposal?.currencyId)}
            />
          </div>

          <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-gray-100 text-left text-xs text-gray-600">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Account</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {(viewingProposal?.lines ?? []).map((line) => (
                <tr key={line.lineNumber} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-500">{line.lineNumber}</td>
                  <td className="px-3 py-2 font-medium">{line.accountCode}</td>
                  <td className="px-3 py-2 text-gray-600">{line.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right">
                    {line.debit ? money(line.debit, viewingProposal?.currencyId) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {line.credit ? money(line.credit, viewingProposal?.currencyId) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- confirms */}
      <ConfirmationModal
        isOpen={!!confirmAction}
        message={confirmAction?.message ?? ''}
        loading={saving}
        onConfirm={runConfirmedAction}
        onClose={() => setConfirmAction(null)}
      />

      <ConfirmationModal
        isOpen={!!deletingBook}
        message={`Reverse the capitalization of '${deletingBook?.assetCode}'? The asset stays on the register but is no longer capitalized. This is only for correcting a mistake.`}
        loading={saving}
        onConfirm={submitDeleteBook}
        onClose={() => setDeletingBook(null)}
      />
    </div>
  );
}
