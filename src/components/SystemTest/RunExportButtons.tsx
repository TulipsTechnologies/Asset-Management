'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Button from '@/components/UI/Button';
import { ISystemTestRun } from '@/interface/ISystemTest';
import { fetchCurrentUser } from '@/services/auth.service';
import {
  exportSystemTestRunToExcel,
  systemTestRunFileStem,
} from '@/utils/systemTestReportExcel';
import { exportSystemTestRunToPdf } from '@/utils/systemTestReportPdf';

/**
 * The three exports every finished run offers (§12.9): the run JSON exactly as the API
 * returned it, and the styled xlsx/pdf rendered client-side from that JSON. Identity for
 * the letterhead comes from /me, same as the schedule exports — the JWT holds a company
 * ID, not its name.
 */
export default function RunExportButtons({ run }: { run: ISystemTestRun }) {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<{ company: string; user: string }>({
    company: '',
    user: '',
  });

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((response) => {
        if (cancelled) return;
        setIdentity({
          company: response?.data?.companyName?.trim() || '',
          user:
            response?.data?.fullName?.trim() ||
            response?.data?.username?.trim() ||
            '',
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const context = () => ({
    // No invented letterhead: an unknown company is stated as unknown.
    companyName: identity.company || '(Company not set)',
    generatedBy:
      identity.user || user?.fullName?.trim() || user?.userName?.trim() || '—',
    generatedOn: new Date(),
  });

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(run, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${systemTestRunFileStem(run)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="toolbar" onClick={downloadJson}>
        <i className="icon icon-download text-xs" />
        <span>JSON</span>
      </Button>
      <Button variant="toolbar" onClick={() => exportSystemTestRunToExcel(run, context())}>
        <i className="icon icon-download text-xs" />
        <span>Excel</span>
      </Button>
      <Button variant="toolbar" onClick={() => exportSystemTestRunToPdf(run, context())}>
        <i className="icon icon-download text-xs" />
        <span>PDF</span>
      </Button>
    </div>
  );
}
