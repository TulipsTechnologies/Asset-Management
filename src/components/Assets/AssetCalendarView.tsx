'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Button from '@/components/UI/Button';
import {
  AssetCalendarEventTypeEnum,
  IAssetCalendarEvent,
  IAssetFilter,
} from '@/interface/IAsset';
import { fetchAssetCalendar } from '@/services/asset.service';

/**
 * Everything the filtered register owes, on the dates it falls due: services booked,
 * warranties running out, insurance lapsing, counts scheduled.
 *
 * The window is the visible GRID, not the calendar month — a service on the 31st of last
 * month is on screen in the leading row, so it has to be in the data too.
 */

interface IProps {
  filters: IAssetFilter;
  onOpenAsset: (assetId: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EVENT_STYLES: Record<
  AssetCalendarEventTypeEnum,
  { label: string; dot: string; chip: string; icon: string }
> = {
  [AssetCalendarEventTypeEnum.Maintenance]: {
    label: 'Maintenance',
    dot: 'bg-sky-500',
    chip: 'bg-sky-50 text-sky-700 border-sky-100',
    icon: 'setting',
  },
  [AssetCalendarEventTypeEnum.Warranty]: {
    label: 'Warranty',
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: 'documents',
  },
  [AssetCalendarEventTypeEnum.Insurance]: {
    label: 'Insurance',
    dot: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-700 border-violet-100',
    icon: 'briefcase',
  },
  [AssetCalendarEventTypeEnum.Verification]: {
    label: 'Verification',
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: 'clipboard',
  },
};

/** Local-midnight key. Avoids toISOString, which shifts the day for anyone behind UTC. */
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const parseDayKey = (value: string) => dayKey(new Date(value));

const AssetCalendarView = ({ filters, onOpenAsset }: IProps) => {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<IAssetCalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<AssetCalendarEventTypeEnum>>(new Set());

  /** The 42 cells actually on screen — six weeks, Sunday-first. */
  const grid = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(firstOfMonth);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);

  const windowStart = grid[0];
  const windowEnd = grid[grid.length - 1];

  /*
   * A generation token, not a date compare: paging months quickly fires overlapping
   * requests, and a slow earlier one landing last would paint the wrong month's events.
   */
  const generationRef = useRef(0);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    setLoading(true);
    try {
      const response = await fetchAssetCalendar(
        filters,
        dayKey(windowStart),
        dayKey(windowEnd)
      );
      if (generation !== generationRef.current) return;

      if (!response?.success || !Array.isArray(response.data)) {
        setEvents([]);
        setLoadError(response?.message || 'The calendar could not be loaded.');
        return;
      }
      setEvents(response.data);
      setLoadError('');
    } catch {
      if (generation !== generationRef.current) return;
      setEvents([]);
      setLoadError('The calendar could not be loaded.');
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, cursor]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleEvents = useMemo(
    () => events.filter((event) => !hidden.has(event.eventType)),
    [events, hidden]
  );

  const byDay = useMemo(() => {
    const map = new Map<string, IAssetCalendarEvent[]>();
    visibleEvents.forEach((event) => {
      const key = parseDayKey(event.date);
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    });
    return map;
  }, [visibleEvents]);

  const counts = useMemo(() => {
    const tally = new Map<AssetCalendarEventTypeEnum, number>();
    events.forEach((event) =>
      tally.set(event.eventType, (tally.get(event.eventType) ?? 0) + 1)
    );
    return tally;
  }, [events]);

  const toggleType = (type: AssetCalendarEventTypeEnum) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  const shiftMonth = (delta: number) => {
    setSelectedDay(null);
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const todayKey = dayKey(today);
  const selectedEvents = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            className="size-8 rounded-full hover:bg-hoverColor text-gray-600"
            onClick={() => shiftMonth(-1)}
          >
            <i className="icon icon-left text-xs"></i>
          </button>
          <h2 className="text-sm font-bold text-secondaryColor min-w-[150px] text-center">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            className="size-8 rounded-full hover:bg-hoverColor text-gray-600"
            onClick={() => shiftMonth(1)}
          >
            <i className="icon icon-right text-xs"></i>
          </button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedDay(null);
              setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
            }}
          >
            Today
          </Button>
        </div>

        {/* The legend doubles as the filter — each entry carries its own count. */}
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(EVENT_STYLES).map(([key, style]) => {
            const type = Number(key) as AssetCalendarEventTypeEnum;
            const off = hidden.has(type);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={!off}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  off ? 'border-gray-100 bg-white text-gray-300' : style.chip
                }`}
              >
                <span className={`size-2 rounded-full ${off ? 'bg-gray-200' : style.dot}`}></span>
                {style.label}
                <span className="tabular-nums">{counts.get(type) ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {loadError ? (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-amber-800">{loadError}</p>
          <p className="text-xs text-gray-500 mt-1">
            This is not the same as having nothing scheduled.
          </p>
          <button
            type="button"
            className="text-xs font-medium text-primarycolor hover:underline mt-2"
            onClick={load}
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {/*
           * Below sm the month grid is the wrong shape for the screen: seven columns in
           * 375px leaves a 40px cell, where an asset code truncates to a letter and the
           * grid becomes decoration. The same window is rendered as an agenda instead —
           * chronological, one readable row per item. Both are CSS-toggled rather than
           * chosen in JS, so there is no hydration mismatch and no second fetch.
           */}
          <div className="sm:hidden space-y-3">
            {visibleEvents.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {events.length > 0
                  ? 'Every kind is hidden — turn one back on above.'
                  : 'Nothing falls due this month for the current filters.'}
              </p>
            ) : (
              [...byDay.entries()]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, dayEvents]) => (
                  <div key={key} className="rounded-xl border border-gray-100">
                    <p
                      className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide rounded-t-xl ${
                        key === todayKey
                          ? 'bg-primarycolor/10 text-primarycolor'
                          : 'bg-gray-50 text-gray-400'
                      }`}
                    >
                      {new Date(key).toLocaleDateString(undefined, {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'short',
                      })}
                      {key === todayKey ? ' · Today' : ''}
                    </p>
                    <ul className="divide-y divide-gray-50">
                      {dayEvents.map((event, index) => {
                        const style = EVENT_STYLES[event.eventType];
                        return (
                          <li
                            key={`${event.assetId}-${event.eventType}-${index}`}
                            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer active:bg-hoverColor"
                            onClick={() => onOpenAsset(event.assetId)}
                          >
                            <span className={`size-2 rounded-full shrink-0 ${style.dot}`}></span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-semibold text-secondaryColor truncate">
                                {event.assetCode} · {event.assetName}
                              </span>
                              <span className="block text-xs text-gray-500 truncate">
                                {event.title}
                                {event.detail ? ` — ${event.detail}` : ''}
                              </span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
            )}
          </div>

          <div className="hidden sm:grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="bg-gray-50 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-400"
              >
                {day}
              </div>
            ))}

            {grid.map((date) => {
              const key = dayKey(date);
              const inMonth = date.getMonth() === cursor.getMonth();
              const isToday = key === todayKey;
              const dayEvents = byDay.get(key) ?? [];
              const shown = dayEvents.slice(0, 2);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(dayEvents.length ? key : null)}
                  className={`min-h-[92px] bg-white p-1.5 text-left align-top transition-colors ${
                    inMonth ? '' : 'bg-gray-50/60'
                  } ${dayEvents.length ? 'hover:bg-hoverColor cursor-pointer' : 'cursor-default'} ${
                    selectedDay === key ? 'ring-2 ring-inset ring-primarycolor' : ''
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center size-6 rounded-full text-xs ${
                      isToday
                        ? 'bg-primarycolor text-white font-bold'
                        : inMonth
                          ? 'text-secondaryColor font-medium'
                          : 'text-gray-300'
                    }`}
                  >
                    {date.getDate()}
                  </span>

                  <span className="mt-1 block space-y-1">
                    {shown.map((event, index) => {
                      const style = EVENT_STYLES[event.eventType];
                      return (
                        <span
                          key={`${event.assetId}-${event.eventType}-${index}`}
                          className={`block truncate rounded border px-1 py-0.5 text-[10px] leading-tight ${style.chip}`}
                          title={`${event.assetCode} — ${event.title}`}
                        >
                          {event.assetCode}
                        </span>
                      );
                    })}
                    {dayEvents.length > shown.length && (
                      <span className="block text-[10px] text-gray-400">
                        +{dayEvents.length - shown.length} more
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 mt-3">
            <p className="text-xs text-gray-400 tabular-nums">
              {loading
                ? 'Loading…'
                : `${visibleEvents.length} dated item${visibleEvents.length === 1 ? '' : 's'} in view`}
            </p>
            {hidden.size > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primarycolor hover:underline"
                onClick={() => setHidden(new Set())}
              >
                Show all kinds
              </button>
            )}
          </div>

          {selectedDay && (
            <div className="mt-4 rounded-xl border border-gray-100 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                {new Date(selectedDay).toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <ul className="divide-y divide-gray-50">
                {selectedEvents.map((event, index) => {
                  const style = EVENT_STYLES[event.eventType];
                  return (
                    <li
                      key={`${event.assetId}-${event.eventType}-${index}`}
                      className="flex items-center gap-3 py-2 cursor-pointer hover:bg-hoverColor px-2 -mx-2 rounded-lg"
                      onClick={() => onOpenAsset(event.assetId)}
                    >
                      <span className={`size-2 rounded-full shrink-0 ${style.dot}`}></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-secondaryColor truncate">
                          {event.assetCode} · {event.assetName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {event.title}
                          {event.detail ? ` — ${event.detail}` : ''}
                          {event.assetLocationName ? ` · ${event.assetLocationName}` : ''}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${style.chip}`}
                      >
                        {style.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Hidden below sm — the agenda above prints its own empty message there. */}
          {!loading && visibleEvents.length === 0 && (
            <p className="hidden sm:block text-sm text-gray-400 text-center py-6">
              {events.length > 0
                ? 'Every kind is hidden — turn one back on above.'
                : 'Nothing falls due this month for the current filters.'}
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default AssetCalendarView;
