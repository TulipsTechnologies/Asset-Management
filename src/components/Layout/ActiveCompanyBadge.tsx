'use client';

import { useActiveCompany } from '@/hooks/useActiveCompany';

/**
 * Which company you are working in, on every page.
 *
 * The module scopes every request to a cookie the operator cannot see, and the two failure modes
 * it protects against look identical to working normally: reading another company's register, and
 * changing it. This module's Master Data Reset wiped the real tenant twice.
 *
 * Sits in the header BLOCK rather than inside the header bar itself: the shared Header takes a
 * fixed prop list with no slot for host content, and positioning a badge over its row would put
 * this on a collision course with the page title at some width. A strip immediately under it is
 * always visible, never overlaps, and survives any title.
 *
 * Renders nothing when no company is selected — bootstrap already blocks that case with a full
 * "Choose a company" screen, and a second empty chip would be noise.
 */
const ActiveCompanyBadge = () => {
  const company = useActiveCompany();
  if (!company) return null;

  return (
    <div className="no-print flex items-center justify-end gap-x-1.5 border-b border-gray-100 bg-white px-4 py-1">
      {/* icon-company, not icon-building — the latter is not in the font and renders as nothing.
          Grep _fonts.scss before reaching for a glyph name that sounds right. */}
      <i className="icon icon-company text-[11px] text-gray-400" aria-hidden />
      <span className="text-[11px] text-gray-400">Working in</span>
      <span
        className="max-w-[42vw] truncate text-[11px] font-semibold text-secondaryColor"
        // The id is the thing that actually scopes the request, so it stays reachable for anyone
        // checking a screenshot against a cookie or a support report.
        title={`${company.name ?? 'Company'} — ${company.id}`}
      >
        {company.name ?? company.id}
      </span>
    </div>
  );
};

export default ActiveCompanyBadge;
