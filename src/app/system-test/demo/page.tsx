'use client';

import { useEffect, useState } from 'react';
import cookies from 'js-cookie';
import BackButton from '@/components/UI/BackButton';
import Button from '@/components/UI/Button';
import Select from '@/components/UI/Select';
import CustomCheckbox from '@/components/UI/CustomCheckBox';
import DestructiveConfirmModal from '@/components/SystemTest/DestructiveConfirmModal';
import RunExportButtons from '@/components/SystemTest/RunExportButtons';
import RunItemsTable from '@/components/SystemTest/RunItemsTable';
import RunProgressPanel from '@/components/SystemTest/RunProgressPanel';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import { useToast } from '@/components/Providers/ToastProvider';
import { Permission } from '@/enum/permissions';
import {
  COMPANY_PURPOSE_LABELS,
  RUN_STATUS_BADGE,
  RUN_STATUS_LABELS,
  SystemTestCompanyPurposeEnum,
} from '@/enum/systemTestEnums';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  ISystemTestEnvironment,
  ISystemTestModule,
  ISystemTestProvisionedCompany,
  ISystemTestRun,
} from '@/interface/ISystemTest';
import {
  fetchSystemTestEnvironment,
  fetchSystemTestModules,
  provisionSystemTestCompanies,
  runSystemTestDemoData,
} from '@/services/systemTest.service';

const PURPOSE_BADGE: Record<SystemTestCompanyPurposeEnum, string> = {
  [SystemTestCompanyPurposeEnum.TestCompany]: 'bg-blue-50 text-blue-700',
  [SystemTestCompanyPurposeEnum.DemoCompany]: 'bg-green-100 text-green-800',
};

const DemoContent = () => {
  const { addToast } = useToast();
  const { can } = useUserPermissions();

  const [environment, setEnvironment] = useState<ISystemTestEnvironment | null>(null);
  const [modules, setModules] = useState<ISystemTestModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [refresh, setRefresh] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [result, setResult] = useState<ISystemTestRun | null>(null);
  const [provisionNotes, setProvisionNotes] = useState<string[]>([]);

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
        if (res?.success && res.data) setModules(res.data.demoData);
      })
      .catch(() => undefined);
  }, []);

  // §12.1: while the synchronous POST is in flight, the environment endpoint reveals the
  // Running row's id so the progress panel can attach mid-run.
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

  const activeId = cookies.get('ActiveCompanyId')?.toLowerCase();
  const currentRegistered =
    environment?.provisionedCompanies.find(
      (company) => company.companyId.toLowerCase() === activeId
    ) ?? null;
  const inRegisteredCompany = environment?.currentCompanyPurpose != null;
  const canDestruct =
    can(Permission.ManageSystemTest) && can(Permission.ResetCompanyData);

  /**
   * "Open" switches the active tenant: the same ActiveCompanyId cookie the http layer
   * sends on every request, then a full reload so every mounted page refetches inside
   * the new company. No backend change involved (§5).
   */
  const openCompany = (company: ISystemTestProvisionedCompany) => {
    cookies.set('ActiveCompanyId', company.companyId);
    window.location.href = '/dashboard';
  };

  const provision = async ({ pin }: { confirmationPhrase: string; pin: string }) => {
    setBusy(true);
    try {
      const res = await provisionSystemTestCompanies(pin);
      if (res?.success && res.data) {
        setProvisionOpen(false);
        setProvisionNotes(res.data.notes ?? []);
        addToast.success(res.message || 'Demo environment provisioned');
        load();
      } else {
        setProvisionOpen(false);
        addToast.error(res?.message || 'Provisioning was refused');
      }
    } catch {
      setProvisionOpen(false);
      addToast.error('An error occurred while provisioning');
    } finally {
      setBusy(false);
    }
  };

  const runDemo = async ({
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
      const res = await runSystemTestDemoData({
        moduleKey: moduleKey || null,
        refresh,
        confirmationPhrase,
        pin,
      });
      if (res?.success && res.data) {
        setLoadOpen(false);
        setResult(res.data);
        if (res.data.failedCount > 0)
          addToast.error('Demo data generation reported failures');
        else addToast.success('Demo data loaded');
      } else {
        setLoadOpen(false);
        addToast.error(res?.message || 'Demo data generation was refused');
      }
    } catch {
      setLoadOpen(false);
      addToast.error('An error occurred while generating demo data');
    } finally {
      setBusy(false);
      setActiveRunId(null);
      load();
    }
  };

  const provisioned = environment?.provisionedCompanies ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      <BackButton className="mb-3" />
      <h1 className="text-lg font-semibold text-secondaryColor">Demo &amp; Environment</h1>
      <p className="text-xs text-gray-500 mt-0.5">
        Provision the dedicated test and demo companies, switch into them, and fill the
        demo company with a realistic register — every row through the module&apos;s own
        services.
      </p>

      {/* ------------------------------------------------------------ environment */}
      <section className="mt-7 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-secondaryColor">Environment</h2>
          <Button
            onClick={() => setProvisionOpen(true)}
            disabled={busy || !canDestruct}
          >
            <i className="icon icon-plus text-xs" />
            <span>Provision companies</span>
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Provisioning creates <span className="font-medium">Asset Test Company</span> and{' '}
          <span className="font-medium">Asset Demo Company</span> as fresh standalone
          tenants (one of each per deployment), registers them for framework operations
          and grants you membership. Client companies can never be registered.
        </p>

        {provisionNotes.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-blue-50 px-4 py-3 text-xs text-blue-800">
            {provisionNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}

        {provisioned.length === 0 ? (
          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            No test or demo company is provisioned yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600">Company</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Purpose</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Subdomain</th>
                  <th className="px-3 py-2 w-40 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {provisioned.map((company) => {
                  const isCurrent =
                    company.companyId.toLowerCase() === activeId;
                  return (
                    <tr key={company.companyId} className="border-t border-gray-50">
                      <td className="px-3 py-2 font-medium text-secondaryColor">
                        {company.companyName}
                        {isCurrent && (
                          <span className="ml-2 rounded-full bg-primarycolor/10 px-2 py-0.5 text-[10px] font-medium text-primarycolor">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${PURPOSE_BADGE[company.purpose]}`}
                        >
                          {COMPANY_PURPOSE_LABELS[company.purpose]}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-500">{company.subdomain}</td>
                      <td className="px-3 py-2 text-right">
                        {!isCurrent && (
                          <Button
                            variant="toolbar"
                            onClick={() => openCompany(company)}
                          >
                            <i className="icon icon-right text-[10px]" />
                            <span>
                              Open{' '}
                              {company.purpose ===
                              SystemTestCompanyPurposeEnum.DemoCompany
                                ? 'Demo'
                                : 'Test'}{' '}
                              Company
                            </span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* -------------------------------------------------------------- demo data */}
      <section className="mt-6 rounded-xl border border-red-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-red-700">Load / refresh demo data</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          Fills the CURRENT company with the demo register — categories, assets,
          custody, capitalized books, tax classes, a posted depreciation run and an
          executed disposal. Runs only inside a registered test or demo company.{' '}
          <span className="font-medium text-secondaryColor">
            Refresh wipes the module&apos;s data first
          </span>{' '}
          and cannot be undone.
        </p>

        {environment && !inRegisteredCompany && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            You are not inside a registered test or demo company — open one above first.
            The server refuses demo generation anywhere else.
          </p>
        )}
        {!canDestruct && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Loading demo data needs the Reset Company Data permission on top of Manage
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
          <div className="pb-2">
            <CustomCheckbox
              title="Refresh (reset the module's data first)"
              checked={refresh}
              onChange={() => setRefresh((prev) => !prev)}
            />
          </div>
          <Button
            variant="danger"
            onClick={() => setLoadOpen(true)}
            disabled={busy || !inRegisteredCompany || !canDestruct}
          >
            <i className="icon icon-modules text-xs" />
            <span>{refresh ? 'Refresh demo data…' : 'Load demo data…'}</span>
          </Button>
        </div>
      </section>

      {busy && activeRunId && (
        <div className="mt-6">
          <RunProgressPanel runId={activeRunId} />
        </div>
      )}

      {result && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-secondaryColor">
                Generation report
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[result.status]}`}
              >
                {RUN_STATUS_LABELS[result.status]}
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
        isOpen={provisionOpen}
        onClose={() => setProvisionOpen(false)}
        title="Provision the test and demo companies?"
        consequence={
          <p>
            Creates the two dedicated companies as fresh tenants and registers them for
            destructive framework operations. Existing companies are never touched — if a
            registered company already exists it is reported, not recreated.
          </p>
        }
        requirePhrase={false}
        confirmLabel={busy ? 'Provisioning…' : 'Provision'}
        busy={busy}
        onConfirm={provision}
      />

      <DestructiveConfirmModal
        isOpen={loadOpen}
        onClose={() => setLoadOpen(false)}
        title={refresh ? 'Reset and reload demo data?' : 'Load demo data?'}
        consequence={
          <p>
            {refresh ? (
              <>
                Every asset record in{' '}
                <span className="font-medium">
                  {currentRegistered?.companyName ?? 'this registered company'}
                </span>{' '}
                will be permanently deleted first, then the demo register is generated
                fresh. This cannot be undone.
              </>
            ) : (
              <>
                The demo register will be generated into{' '}
                <span className="font-medium">
                  {currentRegistered?.companyName ?? 'this registered company'}
                </span>{' '}
                through the module&apos;s own services.
              </>
            )}
          </p>
        }
        confirmationPhrase={currentRegistered?.companyName ?? null}
        confirmLabel={busy ? 'Working…' : refresh ? 'Reset and reload' : 'Load demo data'}
        busy={busy}
        onConfirm={runDemo}
      />
    </div>
  );
};

const DemoPage = () => (
  <SystemTestGate>
    <DemoContent />
  </SystemTestGate>
);

export default DemoPage;
