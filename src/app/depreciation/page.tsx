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
  IDepreciationRun,
  IDepreciationExclusion,
  IDepreciationRunDetail,
  IDepreciationSchedule,
  IFiscalPeriod,
  IJournalProposal,
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
import { unwrapPaged } from '@/utils/serviceUtils';
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

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : '—';

const money = (amount?: number | null, currency?: string | null) =>
  amount == null
    ? '—'
    : `${amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}${currency ? ` ${currency.trim()}` : ''}`;

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
  const [bookFilters, setBookFilters] = useState<ITableFilters>({
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
  const [runFilters, setRunFilters] = useState<ITableFilters>({
    pageNumber: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });

  // ---------------------------------------------------------------- proposals
  const [proposals, setProposals] = useState<IJournalProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalsTotal, setProposalsTotal] = useState(0);
  const [proposalsPageCount, setProposalsPageCount] = useState(0);
  const [proposalFilters, setProposalFilters] = useState<ITableFilters>({
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
  }, [bookFilters.pageNumber, bookFilters.pageSize, debouncedBookSearch, addToast]);

  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const response = await fetchDepreciationRuns({
        pageNumber: runFilters.pageNumber,
        pageSize: runFilters.pageSize,
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
  }, [runFilters.pageNumber, runFilters.pageSize, addToast]);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const response = await fetchJournalProposals({
        pageNumber: proposalFilters.pageNumber,
        pageSize: proposalFilters.pageSize,
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
  }, [proposalFilters.pageNumber, proposalFilters.pageSize, addToast]);

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
      const response = await fetchFiscalPeriods({
        pageNumber: 1,
        pageSize: 100,
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

  const bookColumns: TTableColumn[] = [
    { key: 'asset', label: 'Asset', width: 200, type: 'string', name: 'asset' },
    { key: 'category', label: 'Category', width: 140, type: 'string', name: 'category' },
    { key: 'cost', label: 'Cost', width: 130, name: 'cost' },
    { key: 'accumulated', label: 'Accumulated', width: 130, name: 'accumulated' },
    { key: 'nbv', label: 'Net Book Value', width: 140, name: 'nbv' },
    { key: 'method', label: 'Method', width: 130, name: 'method' },
    { key: 'convention', label: 'Convention', width: 120, name: 'convention' },
    { key: 'status', label: 'Status', width: 90, name: 'status' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const runColumns: TTableColumn[] = [
    { key: 'period', label: 'Period', width: 160, type: 'string', name: 'period' },
    { key: 'status', label: 'Status', width: 110, name: 'status' },
    { key: 'assetCount', label: 'Assets', width: 80, name: 'assetCount' },
    { key: 'excludedAssetCount', label: 'Excluded', width: 90, name: 'excludedAssetCount' },
    { key: 'totalAmount', label: 'Total', width: 150, name: 'totalAmount' },
    { key: 'runDate', label: 'Run Date', width: 110, name: 'runDate' },
    { key: 'postedOn', label: 'Posted', width: 110, name: 'postedOn' },
    {
      key: 'actions',
      label: <i className="icon icon-actions text-[10px]" />,
      width: 45,
      canToggle: false,
      name: 'actions',
    },
  ];

  const proposalColumns: TTableColumn[] = [
    { key: 'source', label: 'Source', width: 130, name: 'source' },
    { key: 'period', label: 'Period', width: 140, type: 'string', name: 'period' },
    { key: 'debit', label: 'Debit', width: 140, name: 'debit' },
    { key: 'credit', label: 'Credit', width: 140, name: 'credit' },
    { key: 'status', label: 'Status', width: 110, name: 'status' },
    { key: 'proposalDate', label: 'Date', width: 110, name: 'proposalDate' },
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

  // ---------------------------------------------------------------- render

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-gray-800">Depreciation</h1>
        <p className="text-sm text-gray-500">
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
                ? 'border-b-2 border-primary text-primary'
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
            tableHeaderLeft={
              <div className="flex items-center gap-2">
                <Button onClick={openCapitalize}>
                  <i className="icon icon-plus text-xs"></i>
                  <span>Capitalize Asset</span>
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
            updateFilters={(updates) => setBookFilters((prev) => ({ ...prev, ...updates }))}
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
            tableHeaderLeft={
              <div className="flex items-center gap-2">
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
            updateFilters={(updates) => setRunFilters((prev) => ({ ...prev, ...updates }))}
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
          />
          <Pagination
            pageNumber={proposalFilters.pageNumber ?? 1}
            totalPages={proposalsPageCount}
            pageSize={proposalFilters.pageSize ?? DEFAULT_PAGE_SIZE}
            totalCount={proposalsTotal}
            updateFilters={(updates) => setProposalFilters((prev) => ({ ...prev, ...updates }))}
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
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Revise Estimate</h2>
          <p className="mb-4 text-xs text-gray-500">
            Applied <strong>prospectively</strong>: periods already posted keep the numbers
            they were posted with, and the remaining carrying amount is re-spread over the
            remaining life.
          </p>

          <div className="grid grid-cols-2 gap-4">
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
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Calculate Depreciation</h2>
          <p className="mb-4 text-xs text-gray-500">
            Amounts owed from earlier periods that were never run are swept into this one as
            flagged catch-up lines, rather than being lost.
          </p>

          <Select
            label="Period"
            required
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            options={openPeriods.map((p) => ({
              label: `${p.fiscalYearCode} · ${p.monthName} (period ${p.periodOrdinal})`,
              value: p.id,
            }))}
            placeholder={
              openPeriods.length === 0
                ? 'No open periods — create a fiscal year first'
                : 'Select an open period'
            }
            disabled={!!calculateResult}
          />

          {/* What the run is about to do. The basis is per-BOOK, so it is stated as the
              rule rather than claimed as a single value for the whole run. */}
          {selectedPeriod && !calculateResult && (
            <div className="mt-4 rounded bg-gray-50 p-3">
              <div className="grid grid-cols-3 gap-4">
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
              <div className="grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
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
      <Modal isOpen={!!viewingRun} onClose={() => setViewingRun(null)} size="3xl">
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Run — {viewingRun?.fiscalYearCode} · {viewingRun?.monthName}
          </h2>

          <div className="mb-4 grid grid-cols-5 gap-4 rounded bg-gray-50 p-3">
            <DetailField
              label="Status"
              value={viewingRun ? RUN_STATUS_LABELS[viewingRun.status] : '—'}
            />
            <DetailField label="Assets" value={viewingRun?.assetCount} />
            <DetailField label="Excluded" value={viewingRun?.excludedAssetCount ?? 0} />
            <DetailField
              label="Total"
              value={money(viewingRun?.totalAmount, viewingRun?.currencyId)}
            />
            <DetailField label="Posted" value={formatDate(viewingRun?.postedOn)} />
            <DetailField
              label="Historical Catch-up"
              value={money(viewingRun?.priorYearCatchUpTotal ?? 0, viewingRun?.currencyId)}
            />
            <DetailField
              label="Current Fiscal Year"
              value={money(viewingRun?.currentYearTotal ?? 0, viewingRun?.currencyId)}
            />
          </div>

          {/* Books the run considered and charged nothing for. Warnings, not failures. */}
          {runExclusions.length > 0 && (
            <div className="mb-3">
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
            <p className="mb-3 rounded bg-red-50 px-3 py-2 text-xs text-red-800">
              Reversed: {viewingRun.reversalReason}
            </p>
          )}

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2">Asset</th>
                  <th className="px-3 py-2">Convention</th>
                  <th className="px-3 py-2 text-right">Days</th>
                  <th className="px-3 py-2 text-right">Opening NBV</th>
                  <th className="px-3 py-2 text-right">Charge</th>
                  <th className="px-3 py-2 text-right">Accumulated After</th>
                  <th className="px-3 py-2 text-right">NBV After</th>
                  <th className="px-3 py-2 text-right">Residual</th>
                </tr>
              </thead>
              <tbody>
                {runDetails.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                      No lines in this run.
                    </td>
                  </tr>
                )}
                {runDetails.map((detail) => (
                  <tr key={detail.id} className="border-b border-gray-100">
                    <td className="px-3 py-2">
                      <span className="font-medium">{detail.assetCode}</span>
                      <span className="ml-2 text-xs text-gray-500">{detail.assetName}</span>
                      {detail.isCatchUp && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          catch-up
                        </span>
                      )}
                      <p className="mt-0.5 text-[11px] text-gray-400">
                        <span
                          className={`mr-1.5 rounded px-1 py-0.5 text-[10px] font-medium ${
                            detail.startingMode === 'OpeningBalance'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {detail.startingMode === 'OpeningBalance'
                            ? 'Opening balance'
                            : 'Historical catch-up'}
                        </span>
                        In service {formatDate(detail.availableForUseDate)}
                        {detail.lastDepreciationThroughDate
                          ? ` · charged through ${formatDate(
                              detail.lastDepreciationThroughDate
                            )}`
                          : ''}
                      </p>
                      {detail.priorYearCatchUpAmount > 0 && (
                        <p className="mt-0.5 text-[11px] text-amber-700">
                          {money(detail.priorYearCatchUpAmount, detail.currencyId)} prior-year
                          catch-up · {money(detail.currentYearAmount, detail.currencyId)} this
                          year
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {CONVENTION_LABELS[detail.depreciationConvention] ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {/* A whole-month book has no day count — the period IS the unit. */}
                      {detail.chargedDays ?? (
                        <span className="text-xs text-gray-400">Full period</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(detail.netBookValueBefore, detail.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {money(detail.amount, detail.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(detail.closingAccumulated, detail.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(detail.netBookValueAfter, detail.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(detail.residualValue, detail.currencyId)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- reverse */}
      <Modal isOpen={!!reversing} onClose={() => setReversing(null)} size="lg">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Reverse Run</h2>
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
            <Button onClick={submitReverse} disabled={saving}>
              {saving ? 'Reversing…' : 'Reverse'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- proposal */}
      <Modal isOpen={!!viewingProposal} onClose={() => setViewingProposal(null)} size="3xl">
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Journal Proposal</h2>

          <div className="mb-4 grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
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

          <table className="w-full text-sm">
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
