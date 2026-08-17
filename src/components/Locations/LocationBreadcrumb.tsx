'use client';

import { ILocationPathSegment } from '@/interface/IReports';

/**
 * The selected hierarchy, always visible and always navigable:
 * `Main Building > Ground Floor > Reception`. Every ancestor is a button that widens
 * the scope to that level — the one-click "up" the old report never had. The current
 * segment renders as text: clicking where you already are is not navigation.
 *
 * No shared trail component exists in Common or Employee (their "breadcrumb" is the
 * menu-driven header line), so this stays deliberately tiny and app-local.
 */
const LocationBreadcrumb = ({
  path,
  onNavigate,
  rootLabel = 'All locations',
  onRoot,
}: {
  path: ILocationPathSegment[];
  onNavigate: (segment: ILocationPathSegment) => void;
  /** The scope above every building; omit `onRoot` to render the trail without it. */
  rootLabel?: string;
  onRoot?: () => void;
}) => (
  <nav aria-label="Location path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
    {onRoot && (
      <>
        <button
          type="button"
          onClick={onRoot}
          className={
            path.length === 0
              ? 'font-medium text-secondaryColor'
              : 'text-gray-500 hover:text-primarycolor hover:underline'
          }
        >
          {rootLabel}
        </button>
        {path.length > 0 && <i className="icon icon-right text-[9px] text-gray-300" />}
      </>
    )}
    {path.map((segment, index) => {
      const isCurrent = index === path.length - 1;
      return (
        <span key={segment.id} className="flex min-w-0 items-center gap-1">
          {isCurrent ? (
            <span className="truncate font-medium text-secondaryColor" aria-current="location">
              {segment.name}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate(segment)}
              className="truncate text-gray-500 hover:text-primarycolor hover:underline"
            >
              {segment.name}
            </button>
          )}
          {!isCurrent && <i className="icon icon-right text-[9px] text-gray-300" />}
        </span>
      );
    })}
  </nav>
);

export default LocationBreadcrumb;
