'use client';

import { useCallback, useEffect, useState } from 'react';
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
import Modal from '@/components/UI/Modal';
import Input from '@/components/UI/Input';
import Select from '@/components/UI/Select';
import TextArea from '@/components/UI/TextArea';
import SearchBox from '@/components/SearchBox';
import Pagination from '@/components/UI/Pagination';
import {
  IAssetBook,
  IDepreciationMethod,
  IDepreciationRun,
  IDepreciationRunDetail,
  IDepreciationSchedule,
  IFiscalPeriod,
  IJournalProposal,
} from '@/interface/IDepreciation';
import { IAssetListItem } from '@/interface/IAsset';
import {
  approveRun,
  calculateRun,
  capitalizeAsset,
  deleteAssetBook,
  discardRun,
  fetchAssetBooks,
  fetchBookSchedule,
  fetchDepreciationMethods,
  fetchDepreciationRuns,
  fetchFiscalPeriods,
  fetchJournalProposal,
  fetchJournalProposals,
  fetchRunDetails,
  postRun,
  reverseRun,
  reviseEstimate,
} from '@/services/depreciation.service';
import { fetchAssets } from '@/services/asset.service';
import { unwrapPaged } from '@/utils/serviceUtils';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import {
  BOOK_STATUS_BADGE_CLASSES,
  BOOK_STATUS_LABELS,
  DEPRECIATION_METHOD_CODES,
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

type TCapitalizeForm = {
  assetId: string;
  cost: string;
  currencyId: string;
  residualValue: string;
  usefulLifeMonths: string;
  depreciationMethodId: string;
  decliningBalanceFactor: string;
  depreciationStartDate: string;
  openingAccumulatedDepreciation: string;
  notes: string;
};

const emptyCapitalizeForm: TCapitalizeForm = {
  assetId: '',
  cost: '',
  currencyId: 'NPR',
  residualValue: '0',
  usefulLifeMonths: '60',
  depreciationMethodId: '',
  decliningBalanceFactor: '2',
  depreciationStartDate: new Date().toISOString().slice(0, 10),
  openingAccumulatedDepreciation: '0',
  notes: '',
};

export default function DepreciationPage() {
  const { addToast } = useToast();

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
  const [capitalizeOpen, setCapitalizeOpen] = useState(false);
  const [capitalizeForm, setCapitalizeForm] = useState<TCapitalizeForm>(emptyCapitalizeForm);
  const [assetOptions, setAssetOptions] = useState<IAssetListItem[]>([]);
  const [methods, setMethods] = useState<IDepreciationMethod[]>([]);
  const [saving, setSaving] = useState(false);

  const [viewingBook, setViewingBook] = useState<IAssetBook | null>(null);
  const [schedule, setSchedule] = useState<IDepreciationSchedule[]>([]);

  const [revising, setRevising] = useState<IAssetBook | null>(null);
  const [reviseForm, setReviseForm] = useState({ residualValue: '', usefulLifeMonths: '', reason: '' });

  const [deletingBook, setDeletingBook] = useState<IAssetBook | null>(null);

  const [calculateOpen, setCalculateOpen] = useState(false);
  const [openPeriods, setOpenPeriods] = useState<IFiscalPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');

  const [viewingRun, setViewingRun] = useState<IDepreciationRun | null>(null);
  const [runDetails, setRunDetails] = useState<IDepreciationRunDetail[]>([]);

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

  const openCapitalize = async () => {
    setCapitalizeForm(emptyCapitalizeForm);
    setCapitalizeOpen(true);
    try {
      const [assetsResponse, methodsResponse] = await Promise.all([
        fetchAssets({ pageNumber: 1, pageSize: 200 }),
        fetchDepreciationMethods(),
      ]);
      setAssetOptions(unwrapPaged<IAssetListItem>(assetsResponse).items);
      setMethods(methodsResponse?.data ?? []);
    } catch {
      addToast.error('Could not load assets or depreciation methods.');
    }
  };

  const submitCapitalize = async () => {
    if (!capitalizeForm.assetId || !capitalizeForm.depreciationMethodId) {
      addToast.error('Pick an asset and a depreciation method.');
      return;
    }

    const asset = assetOptions.find((a) => a.id === capitalizeForm.assetId);
    if (!asset?.rowVersion) {
      addToast.error('That asset could not be resolved. Reload and try again.');
      return;
    }

    setSaving(true);
    try {
      const response = await capitalizeAsset({
        assetId: capitalizeForm.assetId,
        cost: Number(capitalizeForm.cost || 0),
        currencyId: capitalizeForm.currencyId.trim().toUpperCase(),
        residualValue: Number(capitalizeForm.residualValue || 0),
        usefulLifeMonths: Number(capitalizeForm.usefulLifeMonths || 0),
        depreciationMethodId: capitalizeForm.depreciationMethodId,
        decliningBalanceFactor: Number(capitalizeForm.decliningBalanceFactor || 2),
        depreciationStartDate: capitalizeForm.depreciationStartDate,
        openingAccumulatedDepreciation: Number(
          capitalizeForm.openingAccumulatedDepreciation || 0
        ),
        notes: capitalizeForm.notes || undefined,
        rowVersion: asset.rowVersion,
      });

      if (response?.success) {
        addToast.success(response.message || 'Asset capitalized.');
        setCapitalizeOpen(false);
        loadBooks();
      } else {
        // Failed workflow action: close and reload rather than retrying a stale token.
        addToast.error(response?.message || 'Could not capitalize the asset.');
        setCapitalizeOpen(false);
        loadBooks();
      }
    } catch {
      addToast.error('Could not capitalize the asset.');
      setCapitalizeOpen(false);
      loadBooks();
    } finally {
      setSaving(false);
    }
  };

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
    setSaving(true);
    try {
      const response = await calculateRun(selectedPeriodId);
      if (response?.success) addToast.success(response.message || 'Run calculated.');
      else addToast.error(response?.message || 'Could not calculate the run.');
    } catch {
      addToast.error('Could not calculate the run.');
    } finally {
      setSaving(false);
      setCalculateOpen(false);
      setActiveTab('runs');
      loadRuns();
    }
  };

  const openRunDetails = async (run: IDepreciationRun) => {
    setViewingRun(run);
    setRunDetails([]);
    try {
      const response = await fetchRunDetails(run.id);
      setRunDetails(response?.data ?? []);
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
    status: (
      <Badge
        label={BOOK_STATUS_LABELS[book.status] ?? String(book.status)}
        classes={BOOK_STATUS_BADGE_CLASSES[book.status] ?? 'bg-gray-100 text-gray-700'}
      />
    ),
    actions: (
      <div className="flex justify-center">
        <Dropdown
          buttonChildren={<i className="icon icon-actions text-[10px]" />}
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
                    icon: <i className="icon icon-refresh text-sm" />,
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
            ...(!book.hasPostedDepreciation
              ? [
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
    totalAmount: money(run.totalAmount, run.currencyId),
    runDate: formatDate(run.runDate),
    postedOn: formatDate(run.postedOn),
    actions: (
      <div className="flex justify-center">
        <Dropdown
          buttonChildren={<i className="icon icon-actions text-[10px]" />}
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
                    icon: <i className="icon icon-refresh text-sm" />,
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
          buttonChildren={<i className="icon icon-actions text-[10px]" />}
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

  const selectedMethodCode = methods.find(
    (m) => m.id === capitalizeForm.depreciationMethodId
  )?.code;

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
              <Button onClick={openCapitalize}>
                <i className="icon icon-plus text-xs"></i>
                <span>Capitalize Asset</span>
              </Button>
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
              <Button onClick={openCalculate}>
                <i className="icon icon-plus text-xs"></i>
                <span>Calculate Run</span>
              </Button>
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

      {/* ---------------------------------------------------------------- capitalize */}
      <Modal isOpen={capitalizeOpen} onClose={() => setCapitalizeOpen(false)} size="2xl">
        <div className="p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-800">Capitalize Asset</h2>
          <p className="mb-4 text-xs text-gray-500">
            Creates the asset book — the authoritative cost record. The book&apos;s cost is
            independent of the asset&apos;s purchase cost from here on.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Asset"
              required
              value={capitalizeForm.assetId}
              onChange={(e) => {
                const assetId = e.target.value;
                const asset = assetOptions.find((a) => a.id === assetId);
                setCapitalizeForm((prev) => ({
                  ...prev,
                  assetId,
                  cost: asset?.purchaseCost ? String(asset.purchaseCost) : prev.cost,
                }));
              }}
              options={assetOptions.map((a) => ({
                label: `${a.assetCode} — ${a.assetName}`,
                value: a.id,
              }))}
              placeholder="Select an asset"
            />
            <Select
              label="Depreciation Method"
              required
              value={capitalizeForm.depreciationMethodId}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({
                  ...prev,
                  depreciationMethodId: e.target.value,
                }))
              }
              options={methods.map((m) => ({ label: m.name, value: m.id }))}
              placeholder="Select a method"
            />
            <Input
              label="Cost"
              type="number"
              required
              value={capitalizeForm.cost}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({ ...prev, cost: e.target.value }))
              }
              helperText="Defaults from the asset's purchase cost, then becomes independent."
            />
            <Input
              label="Currency"
              required
              value={capitalizeForm.currencyId}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({ ...prev, currencyId: e.target.value }))
              }
              helperText="Must match the company base currency."
            />
            <Input
              label="Residual Value"
              type="number"
              value={capitalizeForm.residualValue}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({ ...prev, residualValue: e.target.value }))
              }
            />
            <Input
              label="Useful Life (months)"
              type="number"
              required
              value={capitalizeForm.usefulLifeMonths}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({
                  ...prev,
                  usefulLifeMonths: e.target.value,
                }))
              }
            />
            {selectedMethodCode === DEPRECIATION_METHOD_CODES.DecliningBalance && (
              <Input
                label="Declining Balance Factor"
                type="number"
                value={capitalizeForm.decliningBalanceFactor}
                onChange={(e) =>
                  setCapitalizeForm((prev) => ({
                    ...prev,
                    decliningBalanceFactor: e.target.value,
                  }))
                }
                helperText="2 = double declining. Switches to straight line when that gives more."
              />
            )}
            <Input
              label="Depreciation Start Date"
              type="date"
              required
              value={capitalizeForm.depreciationStartDate}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({
                  ...prev,
                  depreciationStartDate: e.target.value,
                }))
              }
              helperText="The period containing this date depreciates in full."
            />
            <Input
              label="Opening Accumulated Depreciation"
              type="number"
              value={capitalizeForm.openingAccumulatedDepreciation}
              onChange={(e) =>
                setCapitalizeForm((prev) => ({
                  ...prev,
                  openingAccumulatedDepreciation: e.target.value,
                }))
              }
              helperText="For an asset that arrives part-depreciated."
            />
          </div>

          <TextArea
            label="Notes"
            value={capitalizeForm.notes}
            onChange={(e) =>
              setCapitalizeForm((prev) => ({ ...prev, notes: e.target.value }))
            }
            className="mt-4"
          />

          {selectedMethodCode === DEPRECIATION_METHOD_CODES.None && (
            <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Method <strong>None</strong> never depreciates — the asset is carried at cost
              forever. This is the correct choice for land.
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCapitalizeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCapitalize} disabled={saving}>
              {saving ? 'Capitalizing…' : 'Capitalize'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- schedule */}
      <Modal isOpen={!!viewingBook} onClose={() => setViewingBook(null)} size="3xl">
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            {viewingBook?.assetCode} — Depreciation Schedule
          </h2>

          <div className="mb-4 grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
            <DetailField label="Cost" value={money(viewingBook?.cost, viewingBook?.currencyId)} />
            <DetailField
              label="Residual"
              value={money(viewingBook?.residualValue, viewingBook?.currencyId)}
            />
            <DetailField
              label="Accumulated"
              value={money(viewingBook?.accumulatedDepreciation, viewingBook?.currencyId)}
            />
            <DetailField
              label="Net Book Value"
              value={money(viewingBook?.netBookValue, viewingBook?.currencyId)}
            />
            <DetailField label="Method" value={viewingBook?.depreciationMethodName} />
            <DetailField label="Useful Life" value={`${viewingBook?.usefulLifeMonths ?? '—'} months`} />
            <DetailField label="Start Date" value={formatDate(viewingBook?.depreciationStartDate)} />
            <DetailField
              label="Opening Accumulated"
              value={money(viewingBook?.openingAccumulatedDepreciation, viewingBook?.currencyId)}
            />
          </div>

          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100 text-left text-xs text-gray-600">
                <tr>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2 text-right">Charge</th>
                  <th className="px-3 py-2 text-right">Cumulative</th>
                  <th className="px-3 py-2 text-center">Posted</th>
                </tr>
              </thead>
              <tbody>
                {schedule.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                      No schedule rows. A method of None never generates one, and a schedule
                      stops where the seeded fiscal calendar ends.
                    </td>
                  </tr>
                )}
                {schedule.map((row) => (
                  <tr
                    key={`${row.fiscalYearCode}-${row.periodOrdinal}`}
                    className="border-b border-gray-100"
                  >
                    <td className="px-3 py-2">
                      {row.fiscalYearCode} · {row.periodOrdinal}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {money(row.amount, viewingBook?.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(row.cumulativeAmount, viewingBook?.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.isPosted ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

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
          />

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCalculateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCalculate} disabled={saving || !selectedPeriodId}>
              {saving ? 'Calculating…' : 'Calculate'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------------------- run details */}
      <Modal isOpen={!!viewingRun} onClose={() => setViewingRun(null)} size="3xl">
        <div className="p-5">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Run — {viewingRun?.fiscalYearCode} · {viewingRun?.monthName}
          </h2>

          <div className="mb-4 grid grid-cols-4 gap-4 rounded bg-gray-50 p-3">
            <DetailField
              label="Status"
              value={viewingRun ? RUN_STATUS_LABELS[viewingRun.status] : '—'}
            />
            <DetailField label="Assets" value={viewingRun?.assetCount} />
            <DetailField
              label="Total"
              value={money(viewingRun?.totalAmount, viewingRun?.currencyId)}
            />
            <DetailField label="Posted" value={formatDate(viewingRun?.postedOn)} />
          </div>

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
                  <th className="px-3 py-2 text-right">Charge</th>
                  <th className="px-3 py-2 text-right">Accumulated After</th>
                  <th className="px-3 py-2 text-right">NBV After</th>
                </tr>
              </thead>
              <tbody>
                {runDetails.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
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
                    </td>
                    <td className="px-3 py-2 text-right">
                      {money(detail.amount, viewingRun?.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(detail.closingAccumulated, viewingRun?.currencyId)}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      {money(detail.netBookValueAfter, viewingRun?.currencyId)}
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
