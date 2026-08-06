'use client';

import { useEffect, useState } from 'react';
import BackButton from '@/components/UI/BackButton';
import Button from '@/components/UI/Button';
import Input from '@/components/UI/Input';
import SystemTestGate from '@/components/SystemTest/SystemTestGate';
import { useToast } from '@/components/Providers/ToastProvider';
import { Permission } from '@/enum/permissions';
import { COMPANY_PURPOSE_LABELS } from '@/enum/systemTestEnums';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { ISystemTestEnvironment } from '@/interface/ISystemTest';
import {
  changeSystemTestPin,
  fetchSystemTestEnvironment,
} from '@/services/systemTest.service';

const SettingsContent = () => {
  const { addToast } = useToast();
  const { can } = useUserPermissions();

  const [environment, setEnvironment] = useState<ISystemTestEnvironment | null>(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSystemTestEnvironment()
      .then((res) => {
        if (res?.success && res.data) setEnvironment(res.data);
      })
      .catch(() => undefined);
  }, []);

  const canChangePin =
    can(Permission.ManageSystemTest) && can(Permission.ResetCompanyData);

  const submit = async () => {
    setError('');
    if (!currentPin.trim() || !newPin.trim()) {
      setError('Both the current and the new PIN are required.');
      return;
    }
    if (newPin !== confirmPin) {
      setError('The new PIN and its confirmation do not match.');
      return;
    }
    setSaving(true);
    try {
      const res = await changeSystemTestPin(currentPin.trim(), newPin.trim());
      if (res?.success) {
        addToast.success(res.message || 'PIN changed');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      } else {
        // The server's own sentence — wrong current PIN, lockout, policy refusals.
        addToast.error(res?.message || 'The PIN could not be changed');
      }
    } catch {
      addToast.error('An error occurred while changing the PIN');
    } finally {
      setSaving(false);
    }
  };

  const provisioned = environment?.provisionedCompanies ?? [];

  return (
    <div className="px-4 sm:px-6 py-6 max-w-4xl">
      <BackButton className="mb-3" />
      <h1 className="text-lg font-semibold text-secondaryColor">
        System Test Settings
      </h1>
      <p className="text-xs text-gray-500 mt-0.5">
        The PIN that arms every destructive framework operation, and the companies
        registered for them.
      </p>

      {/* ------------------------------------------------------------- change PIN */}
      <section className="mt-7 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-secondaryColor">Change the PIN</h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          The PIN is stored only as a salted hash and verified server-side per call —
          it is never displayed anywhere, including here. Five failed attempts lock it
          for 15 minutes; changing it always requires the current PIN.
        </p>

        {!canChangePin && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Changing the PIN needs the Reset Company Data permission on top of Manage
            System Test.
          </p>
        )}

        <div className="mt-4 grid max-w-md grid-cols-1 gap-4">
          <Input
            label="Current PIN"
            type="password"
            value={currentPin}
            onChange={(e) => setCurrentPin(e.target.value)}
            autoComplete="off"
            disabled={!canChangePin}
          />
          <Input
            label="New PIN"
            type="password"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
            autoComplete="off"
            disabled={!canChangePin}
          />
          <Input
            label="Confirm new PIN"
            type="password"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value)}
            autoComplete="off"
            disabled={!canChangePin}
            error={error || undefined}
          />
        </div>

        <Button
          onClick={submit}
          disabled={!canChangePin || saving}
          loading={saving}
          className="mt-4"
        >
          <i className="icon icon-id text-xs" />
          <span>{saving ? 'Changing…' : 'Change PIN'}</span>
        </Button>
      </section>

      {/* ---------------------------------------------------- registered companies */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-secondaryColor">
          Registered companies
        </h2>
        <p className="text-xs text-gray-500 mt-1 max-w-2xl">
          The only companies destructive framework operations may touch. Registration
          happens exclusively through provisioning — an existing client company can
          never appear here.
        </p>

        {provisioned.length === 0 ? (
          <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600">
            Nothing is registered yet — provision the environment from the Demo &amp;
            Environment page.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-600">Company</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Purpose</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Subdomain</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Code</th>
                </tr>
              </thead>
              <tbody>
                {provisioned.map((company) => (
                  <tr key={company.companyId} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-medium text-secondaryColor">
                      {company.companyName}
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {COMPANY_PURPOSE_LABELS[company.purpose]}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{company.subdomain}</td>
                    <td className="px-3 py-2 text-gray-500">{company.code || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const SystemTestSettingsPage = () => (
  <SystemTestGate>
    <SettingsContent />
  </SystemTestGate>
);

export default SystemTestSettingsPage;
