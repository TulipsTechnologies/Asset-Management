'use client';

import { useEffect, useState } from 'react';
import cookies from 'js-cookie';
import BackButton from '@/components/UI/BackButton';
import Button from '@/components/UI/Button';
import Select from '@/components/UI/Select';
import DestructiveConfirmModal from '@/components/SystemTest/DestructiveConfirmModal';
import RunExportButtons from '@/components/SystemTest/RunExportButtons';
import RunItemsTable from '@/components/SystemTest/RunItemsTable';
import RunProgressPanel from '@/components/SystemTest/RunProgressPanel';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import { useToast } from '@/components/Providers/ToastProvider';
import { Permission } from '@/enum/permissions';
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_LABELS,
  SystemTestCompanyPurposeEnum,
} from '@/enum/systemTestEnums';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  ISystemTestEnvironment,
  ISystemTestModule,
  ISystemTestRun,
} from '@/interface/ISystemTest';
import {
  fetchSystemTestEnvironment,
  fetchSystemTestModules,
  runSystemTestRegression,
} from '@/services/systemTest.service';

/** The registered company whose id matches the active-tenant cookie, if any. */
const currentRegisteredCompany = (env: ISystemTestEnvironment | null) => {
  const activeId = cookies.get('ActiveCompanyId')?.toLowerCase();
  if (!activeId || !env) return null;
  return (
    env.provisionedCompanies.find(
      (company) => company.companyId.toLowerCase() === activeId
    ) ?? null
  );
};

const RegressionContent = () => {
  const { addToast } = useToast();
  const { can } = useUserPermissions();

  const [environment, setEnvironment] = useState<ISystemTestEnvironment | null>(null);
  const [modules, setModules] = useState<ISystemTestModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [result, setResult] = useState<ISystemTestRun | null>(null);

  const load = () => {
    fetchSystemTestEnvironment()
      .then((res) => {
        if (res?.success && res.data) setEnvironment(res.data);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    fetchSystemTestModules()
      .then((res) => {
        if (res?.success && res.data) setModules(res.data.regression);
      })
      .catch(() => undefined);
  }, []);

  // §12.1: the POST executes the whole suite synchronously; while it is in flight the
  // environment endpoint reveals the Running row's id so the progress panel can attach.
  useEffect(() => {
    if (!busy || activeRunId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetchSystemTestEnvironment();
        if (res?.success && res.data?.runningRunId)
          setActiveRunId(res.data.runningRunId);
      } catch {
        // keep trying while the run is in flight
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [busy, activeRunId]);

  const registered = currentRegisteredCompany(environment);
  const inTestCompany =
    environment?.currentCompanyPurpose === SystemTestCompanyPurposeEnum.TestCompany;
  // The backend stacks ResetCompanyData on top of ManageSystemTest for this endpoint.
  const canRun = can(Permission.ManageSystemTest) && can(Permission.ResetCompanyData);

  const execute = async ({
    confirmationPhrase,
    pin,
  }: {
    confirmationPhrase: string;
    pin: string;
  }) => {
    setBusy(true);
    setResult(null);
    setActiveRunId(null);
    try {
      const res = await runSystemTestRegression({
        moduleKey: moduleKey || null,
        confirmationPhrase,
        pin,
      });
      if (res?.success && res.data) {
        setConfirmOpen(false);
        setResult(res.data);
        if (res.data.failedCount > 0)
          addToast.error('Regression finished with failures');
        else if (res.data.warningCount > 0)
          addToast.warning('Regression passed with warnings');
        else addToast.success('Regression passed');
      } else {
        setConfirmOpen(false);
        addToast.error(res?.message || 'The regression run was refused');
      }
    } catch {
      setConfirmOpen(false);
      addToast.error('An error occurred while running the regression suite');
    } finally {
      setBusy(false);
      setActiveRunId(null);
      load();
    }
  };

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      <BackButton className="mb-3" />
      <h1 className="text-lg font-semibold text-secondaryColor">Regression</h1>
      <p className="text-xs text-gray-500 mt-0.5">
        Resets the registered test company, reseeds it and runs the deterministic
        scenarios under a fixed clock. Expected values are pinned constants — a drifted
        figure is a defect, not noise.
      </p>

      <section className="mt-7 rounded-xl border border-red-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-red-700">Run the suite</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Destructive to the test company&apos;s data by design: its register is wiped and
          rebuilt every run. Only the registered{' '}
          <span className="font-medium text-secondaryColor">test</span> company qualifies —
          never the demo company, never a client company.
        </p>

        {environment && !inTestCompany && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You are not inside the registered test company. Open it from the{' '}
            <a href="/system-test/demo" className="font-medium underline">
              Demo &amp; Environment page
            </a>{' '}
            first — the suite runs against the company you are signed into.
          </p>
        )}
        {!canRun && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Running the suite needs the Reset Company Data permission on top of Manage
            System Test.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="w-full max-w-xs">
            <Select
              label="Module"
              placeholder="All modules"
              options={modules.map((m) => ({
                value: m.moduleKey,
                label: m.displayName,
              }))}
              value={moduleKey}
              onChange={(e) => setModuleKey(e.target.value)}
            />
          </div>
          <Button
            variant="danger"
            onClick={() => setConfirmOpen(true)}
            disabled={busy || !inTestCompany || !canRun}
          >
            <i className="icon icon-redo text-xs" />
            <span>Run regression…</span>
          </Button>
        </div>
      </section>

      {busy && activeRunId && (
        <div className="mt-6">
          <RunProgressPanel runId={activeRunId} />
        </div>
      )}
      {busy && !activeRunId && (
        <p className="mt-6 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
          Starting the run…
        </p>
      )}

      {result && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-secondaryColor">Results</h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[result.status]}`}
              >
                {RUN_STATUS_LABELS[result.status]}
              </span>
              <span className="text-xs text-gray-500">
                {result.passedCount} passed · {result.warningCount} warnings ·{' '}
                {result.failedCount} failed
                {result.clockInstant
                  ? ` · fixed clock ${result.clockInstant.replace('T', ' ').slice(0, 16)}`
                  : ''}
              </span>
            </div>
            <RunExportButtons run={result} />
          </div>
          <div className="mt-4">
            <RunItemsTable items={result.items} />
          </div>
        </section>
      )}

      <DestructiveConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Reset the test company and run the suite?"
        consequence={
          <p>
            Every asset record in{' '}
            <span className="font-medium">
              {registered?.companyName ?? 'the registered test company'}
            </span>{' '}
            will be wiped, reseeded and asserted. This is what the test company is for —
            but it cannot be undone.
          </p>
        }
        confirmationPhrase={registered?.companyName ?? null}
        confirmLabel={busy ? 'Running…' : 'Run regression'}
        busy={busy}
        onConfirm={execute}
      />
    </div>
  );
};

const RegressionPage = () => (
  <SystemTestGate>
    <RegressionContent />
  </SystemTestGate>
);

export default RegressionPage;
