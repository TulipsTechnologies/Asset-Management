'use client';

import { useEffect, useMemo, useState } from 'react';
import BackButton from '@/components/UI/BackButton';
import Button from '@/components/UI/Button';
import Select from '@/components/UI/Select';
import RunExportButtons from '@/components/SystemTest/RunExportButtons';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import { useToast } from '@/components/Providers/ToastProvider';
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_LABELS,
  SystemTestRunItemStatusEnum,
} from '@/enum/systemTestEnums';
import {
  ISystemTestModule,
  ISystemTestRun,
  ISystemTestRunItem,
} from '@/interface/ISystemTest';
import {
  fetchSystemTestModules,
  runSystemTestHealthCheck,
} from '@/services/systemTest.service';

type TSeverity = 'critical' | 'warning' | 'info';

/**
 * ReasonBanner's visual contract extended one step: Critical blocks, Warning completed
 * with something to know, Info is a statement of fact — three deliberately different
 * tones so people don't learn to ignore all of them.
 */
const TONE: Record<TSeverity, { box: string; chip: string; icon: string; heading: string }> = {
  critical: {
    box: 'border-red-200 bg-red-50 text-red-900',
    chip: 'bg-red-100 text-red-800',
    icon: 'icon-alert text-red-600',
    heading: 'text-red-700',
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-900',
    chip: 'bg-amber-100 text-amber-800',
    icon: 'icon-alert text-amber-600',
    heading: 'text-amber-700',
  },
  info: {
    box: 'border-blue-200 bg-blue-50 text-blue-900',
    chip: 'bg-blue-100 text-blue-800',
    icon: 'icon-info text-blue-600',
    heading: 'text-blue-700',
  },
};

const SEVERITY_ORDER: TSeverity[] = ['critical', 'warning', 'info'];

const SEVERITY_LABEL: Record<TSeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
};

/** The finding's own severity string wins; the item status is the fallback. */
const severityOf = (item: ISystemTestRunItem): TSeverity => {
  const named = item.severity?.trim().toLowerCase();
  if (named === 'critical') return 'critical';
  if (named === 'warning') return 'warning';
  if (named === 'info') return 'info';
  if (item.status === SystemTestRunItemStatusEnum.Failed) return 'critical';
  if (item.status === SystemTestRunItemStatusEnum.Warning) return 'warning';
  return 'info';
};

const Finding = ({ item }: { item: ISystemTestRunItem }) => {
  const tone = TONE[severityOf(item)];
  return (
    <div className={`rounded border px-3 py-2 ${tone.box}`}>
      <div className="flex items-start gap-2">
        <i className={`icon ${tone.icon} mt-0.5 text-sm leading-none`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold">{item.name}</span>
            {item.reasonCode && (
              <code className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.chip}`}>
                {item.reasonCode}
              </code>
            )}
          </div>
          {item.message && <p className="mt-0.5 text-xs">{item.message}</p>}
          {item.recordReference && (
            <p className="mt-1 text-[11px] opacity-80">{item.recordReference}</p>
          )}
          {item.recommendation && (
            <p className="mt-1 text-[11px] font-medium opacity-90">
              Recommendation: {item.recommendation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const HealthCheckContent = () => {
  const { addToast } = useToast();

  const [modules, setModules] = useState<ISystemTestModule[]>([]);
  const [moduleKey, setModuleKey] = useState('');
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<ISystemTestRun | null>(null);

  useEffect(() => {
    fetchSystemTestModules()
      .then((res) => {
        if (res?.success && res.data) setModules(res.data.healthCheck);
      })
      .catch(() => undefined);
  }, []);

  const execute = async () => {
    setRunning(true);
    try {
      const res = await runSystemTestHealthCheck(moduleKey || null);
      if (res?.success && res.data) {
        setRun(res.data);
        if (res.data.failedCount > 0)
          addToast.error('Health check found critical issues');
        else if (res.data.warningCount > 0)
          addToast.warning('Health check completed with warnings');
        else addToast.success('Health check passed');
      } else {
        addToast.error(res?.message || 'The health check could not be run');
      }
    } catch {
      addToast.error('An error occurred while running the health check');
    } finally {
      setRunning(false);
    }
  };

  /** module → severity → findings, severities in Critical → Warning → Info order. */
  const grouped = useMemo(() => {
    if (!run) return [];
    const byModule = new Map<string, ISystemTestRunItem[]>();
    for (const item of run.items) {
      const list = byModule.get(item.moduleKey) ?? [];
      list.push(item);
      byModule.set(item.moduleKey, list);
    }
    return [...byModule.entries()].map(([key, items]) => ({
      moduleKey: key,
      displayName: modules.find((m) => m.moduleKey === key)?.displayName ?? key,
      severities: SEVERITY_ORDER.map((severity) => ({
        severity,
        items: items.filter((item) => severityOf(item) === severity),
      })).filter((group) => group.items.length > 0),
    }));
  }, [run, modules]);

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      <BackButton className="mb-3" />
      <h1 className="text-lg font-semibold text-secondaryColor">Health Check</h1>
      <p className="text-xs text-gray-500 mt-0.5">
        Read-only diagnosis of the current company — depreciation arithmetic, opening
        balances, fiscal calendar, journals and tax classifications. Writes nothing but
        its own report.
      </p>

      <section className="mt-7 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-end gap-4">
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
          <Button onClick={execute} disabled={running} loading={running}>
            <i className="icon icon-clipboard text-xs" />
            <span>{running ? 'Checking…' : 'Run health check'}</span>
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Runs against the company you are signed into right now. No PIN needed — nothing
          is modified.
        </p>
      </section>

      {run && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-semibold text-secondaryColor">Findings</h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${RUN_STATUS_BADGE[run.status]}`}
              >
                {RUN_STATUS_LABELS[run.status]}
              </span>
              <span className="text-xs text-gray-500">
                {run.passedCount} passed · {run.warningCount} warnings ·{' '}
                {run.failedCount} critical
              </span>
            </div>
            <RunExportButtons run={run} />
          </div>

          {grouped.length === 0 ? (
            <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
              No findings — every rule this check knows about is satisfied.
            </p>
          ) : (
            grouped.map((moduleGroup) => (
              <div key={moduleGroup.moduleKey} className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {moduleGroup.displayName}
                </h3>
                {moduleGroup.severities.map((severityGroup) => (
                  <div key={severityGroup.severity} className="mt-3">
                    <p
                      className={`text-xs font-semibold ${TONE[severityGroup.severity].heading}`}
                    >
                      {SEVERITY_LABEL[severityGroup.severity]} (
                      {severityGroup.items.length})
                    </p>
                    <div className="mt-1.5 space-y-2">
                      {severityGroup.items.map((item) => (
                        <Finding key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
};

const HealthCheckPage = () => (
  <SystemTestGate>
    <HealthCheckContent />
  </SystemTestGate>
);

export default HealthCheckPage;
