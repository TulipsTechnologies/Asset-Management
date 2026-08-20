'use client';

import { RefObject, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useActiveCompany } from '@/hooks/useActiveCompany';

/**
 * Which company you are working in, shown inside the header bar.
 *
 * The module scopes every request to a cookie the operator cannot see, and the two failure modes
 * it protects against look identical to working normally: reading another company's register, and
 * changing it. The register-clearing reset (now under System Test & Demo) wiped the real tenant twice.
 *
 * PORTALLED into the shared Header's own row, because that component takes a fixed prop list with
 * no slot for host content. Portalling rather than positioning absolutely over it is what keeps
 * this off a collision course with the page title: as a real flex child of a `justify-between`
 * row whose title group is `flex-1`, the badge is laid out by the same rules as everything else
 * in there and simply sits beside the controls at every width.
 *
 * If the row cannot be found it falls back to a strip directly beneath the header rather than
 * disappearing. An indicator whose whole purpose is telling you which company you are about to
 * change must never fail silently.
 */
const ActiveCompanyBadge = ({
  headerHost,
}: {
  /** Anchor rendered just before the shared Header; the header row is its next sibling. */
  headerHost: RefObject<HTMLDivElement | null>;
}) => {
  const company = useActiveCompany();
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const row = headerHost.current?.nextElementSibling;
    // Only a flex row is a safe host. When the header is not rendered at all the next sibling is
    // the page container, which is a block — rejecting it takes the visible fallback instead of
    // dropping the badge into the middle of the content area.
    if (
      !(row instanceof HTMLElement) ||
      getComputedStyle(row).display !== 'flex' ||
      !row.lastElementChild
    ) {
      return;
    }

    // A container of OUR OWN, inserted before the row's last child (the user/actions cluster),
    // because a portal can only ever append — and appended, the badge lands to the right of the
    // avatar, where nothing else in this product sits. React never sees this node: it is created,
    // positioned and removed here, so React's own children stay entirely its business.
    const mount = document.createElement('div');
    mount.className = 'contents';
    row.insertBefore(mount, row.lastElementChild);
    setSlot(mount);

    return () => {
      mount.remove();
      setSlot(null);
    };
  }, [headerHost, company]);

  if (!company) return null;

  const label = company.name ?? company.id;
  // The id is what actually scopes the request, so it stays reachable for anyone checking a
  // screenshot against a cookie or a support report.
  const title = `${company.name ?? 'Company'} — ${company.id}`;

  // icon-company, not icon-building — the latter is not in the font and renders as nothing.
  // Grep _fonts.scss before trusting a glyph name that merely sounds right.
  const icon = (
    <i className="icon icon-company text-xs text-gray-400" aria-hidden />
  );

  if (slot) {
    return createPortal(
      <div
        className="mr-3 flex shrink-0 items-center gap-x-1.5 border-e border-gray-200 pe-3"
        title={title}
      >
        {icon}
        <span className="hidden text-[11px] text-gray-400 lg:inline">
          Working in
        </span>
        <span className="max-w-[26vw] truncate text-xs font-semibold text-secondaryColor">
          {label}
        </span>
      </div>,
      slot
    );
  }

  return (
    <div
      className="no-print flex items-center justify-end gap-x-1.5 border-b border-gray-100 bg-white px-4 py-1"
      title={title}
    >
      {icon}
      <span className="text-[11px] text-gray-400">Working in</span>
      <span className="max-w-[42vw] truncate text-[11px] font-semibold text-secondaryColor">
        {label}
      </span>
    </div>
  );
};

export default ActiveCompanyBadge;
