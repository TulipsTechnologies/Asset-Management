'use client';

import { IReasonDetail } from '@/interface/IGeneric';
import { reasonLabel, reasonSeverity, TReasonSeverity } from '@/enum/reasonCodes';

/**
 * Renders a structured refusal the way the API meant it: the stable code, the server's own
 * sentence, and whatever subject/field/values the rule attached.
 *
 * A warning and a blocking error look deliberately different. The distinction is real —
 * "this asset has no tax classification" completed the operation, "this pool could not be
 * resolved" abandoned it — and a UI that renders both in red teaches people to ignore both.
 */

const TONE: Record<TReasonSeverity, { box: string; code: string; icon: string }> = {
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-900',
    code: 'bg-amber-100 text-amber-800',
    icon: 'icon-alert text-amber-600',
  },
  error: {
    box: 'border-red-200 bg-red-50 text-red-900',
    code: 'bg-red-100 text-red-800',
    icon: 'icon-alert text-red-600',
  },
};

/** Values arrive already typed — decimals as numbers, dates as ISO. Never reformat a date. */
const renderValue = (value: unknown): string => {
  if (value == null) return '—';
  if (typeof value === 'number')
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return String(value);
};

export interface IReasonBannerProps {
  /** A code on its own, e.g. from the envelope's top-level `reasonCode`. */
  code?: string | null;
  /** The server's human-readable sentence. Shown verbatim. */
  message?: string | null;
  /** Full structured reasons, e.g. `data.reasons` or a preview's `data.blockers`. */
  reasons?: IReasonDetail[];
  /** Force a tone. Otherwise it is looked up from the code. */
  severity?: TReasonSeverity;
  className?: string;
}

const Row = ({
  code,
  message,
  detail,
  severity,
}: {
  code?: string | null;
  message?: string | null;
  detail?: IReasonDetail;
  severity: TReasonSeverity;
}) => {
  const tone = TONE[severity];
  const label = reasonLabel(code);
  const values = detail?.values ? Object.entries(detail.values) : [];

  return (
    <div
      role={severity === 'error' ? 'alert' : 'status'}
      className={`rounded border px-3 py-2 ${tone.box}`}
    >
      <div className="flex items-start gap-2">
        <i className={`icon ${tone.icon} mt-0.5 text-sm leading-none`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {label && <span className="text-xs font-semibold">{label}</span>}
            {code && (
              <code className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tone.code}`}>
                {code}
              </code>
            )}
          </div>
          {message && <p className="mt-0.5 text-xs">{message}</p>}

          {(detail?.subject || detail?.rowNumber != null || detail?.field) && (
            <p className="mt-1 text-[11px] opacity-80">
              {detail?.subject && <span>{detail.subject}</span>}
              {detail?.rowNumber != null && <span> · row {detail.rowNumber}</span>}
              {detail?.field && <span> · field {detail.field}</span>}
            </p>
          )}

          {values.length > 0 && (
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] opacity-90">
              {values.map(([key, value]) => (
                <div key={key} className="flex gap-1">
                  <dt className="font-medium">{key}:</dt>
                  <dd>
                    {renderValue(value)}
                    {detail?.currencyId ? ` ${detail.currencyId.trim()}` : ''}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
};

export default function ReasonBanner({
  code,
  message,
  reasons,
  severity,
  className = '',
}: IReasonBannerProps) {
  const hasStructured = reasons != null && reasons.length > 0;
  if (!hasStructured && !code && !message) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      {hasStructured
        ? reasons!.map((reason, index) => (
            <Row
              key={`${reason.code}-${index}`}
              code={reason.code}
              message={reason.message}
              detail={reason}
              severity={severity ?? reasonSeverity(reason.code)}
            />
          ))
        : (
          <Row
            code={code}
            message={message}
            severity={severity ?? reasonSeverity(code)}
          />
        )}
    </div>
  );
}
