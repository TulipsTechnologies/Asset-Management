'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { LAST_HUB_STORAGE_KEY } from '@/utils/navigation';

export interface IHubCard {
  label: string;
  description: string;
  iconName: string;
  url: string;
  /** Planned for a later phase — shows a badge and links to /coming-soon. */
  phase2?: boolean;
  /**
   * Kept out of the grid without being deleted. A card announcing a feature nobody can use
   * yet is a promise the hub cannot keep, so it waits here rather than in a commented-out
   * block — flip this to false when the feature ships and the entry is already correct.
   */
  hidden?: boolean;
}

export interface IHubSection {
  /** Optional: a single-group hub reads better without a redundant header. */
  heading?: string;
  cards: IHubCard[];
}

/**
 * The landing page shared by every parent menu (Asset Register, Asset Operations,
 * Asset Lifecycle, Settings): a card grid with the icon in a green-tinted square,
 * a bold title and a one-line description. One component so the four hubs cannot
 * drift apart visually.
 */
const ModuleHub = ({
  title,
  description,
  sections,
}: {
  title: string;
  description: string;
  sections: IHubSection[];
}) => {
  // Record the hub being used, so a page it leads to knows where to send you back —
  // Categories, for one, is offered by two different hubs.
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) sessionStorage.setItem(LAST_HUB_STORAGE_KEY, pathname);
  }, [pathname]);

  return (
  <div className="px-4 sm:px-6 py-6">
    <h1 className="text-lg font-semibold text-secondaryColor">{title}</h1>
    <p className="text-xs text-gray-500 mt-0.5">{description}</p>

    {sections.map((section, index) => (
      <section key={section.heading ?? index} className="mt-7">
        {section.heading && (
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {section.heading}
          </h2>
        )}
        <div
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${
            section.heading ? 'mt-3' : ''
          }`}
        >
          {section.cards
            .filter((card) => !card.hidden)
            .map((card) => (
            <Link
              key={card.label}
              href={card.url}
              className="flex items-start gap-4 rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:bg-hoverColor hover:border-primarycolor/40"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primarycolor/10">
                <i
                  className={`icon icon-${card.iconName} text-[18px] text-primarycolor`}
                />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-secondaryColor">
                  {card.label}
                  {card.phase2 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      Phase 2
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {card.description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    ))}
  </div>
  );
};

export default ModuleHub;
