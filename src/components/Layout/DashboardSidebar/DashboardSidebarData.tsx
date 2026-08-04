import { HTMLAttributeAnchorTarget } from 'react';

export interface IMenuItem {
  id: number;
  parentId: number | null;
  displayOrder?: number;
  iconSizeClass: string;
  iconName: string;
  label: string;
  url?: string;
  /** Extra routes this entry owns — the pages its hub links out to. */
  matchUrls?: string[];
  subMenu?: IMenuItem[];
  target?: HTMLAttributeAnchorTarget;
  isExternal?: boolean;
  onClick?: () => void;
  /** Planned for a later phase — shows a badge and links to /coming-soon */
  phase2?: boolean;
}

export interface IMenuData {
  menuTop: IMenuItem[];
  menuBottom: IMenuItem[];
}

/**
 * Static sidebar menu for the Asset Management module: six entries, each opening a
 * hub page whose cards lead to the actual screens — the Settings pattern, applied
 * to every group. Nothing expands in the rail itself. Ids are stable; retired ones
 * (2-10, 13) are never reused.
 *
 * The groups follow the life of an asset: it is REGISTERED, then OPERATED (issued,
 * moved, returned, counted), then carried through its LIFECYCLE (serviced,
 * depreciated, disposed).
 */
export const ASSET_MENU_ITEMS: IMenuItem[] = [
  {
    id: 1,
    parentId: null,
    iconName: 'home',
    iconSizeClass: 'text-[16px]',
    label: 'Dashboard',
    url: '/dashboard',
  },
  {
    id: 20,
    parentId: null,
    iconName: 'briefcase',
    iconSizeClass: 'text-[16px]',
    label: 'Asset Register',
    url: '/asset-register',
    // The hub's own pages live at their own top-level routes, so the menu entry
    // has to claim them explicitly or it unhighlights the moment you open one.
    matchUrls: ['/assets', '/asset-categories', '/employees'],
  },
  {
    id: 21,
    parentId: null,
    iconName: 'stream',
    iconSizeClass: 'text-[16px]',
    label: 'Asset Operations',
    url: '/asset-operations',
    matchUrls: ['/assignments', '/transfers', '/returns', '/physical-verification'],
  },
  {
    id: 22,
    parentId: null,
    iconName: 'hourglass',
    iconSizeClass: 'text-[16px]',
    label: 'Asset Lifecycle',
    url: '/asset-lifecycle',
    matchUrls: ['/maintenance', '/depreciation', '/disposal'],
  },
  {
    id: 11,
    parentId: null,
    iconName: 'bar-chart',
    iconSizeClass: 'text-[16px]',
    label: 'Reports & Analytics',
    url: '/reports',
  },
  {
    id: 12,
    parentId: null,
    iconName: 'setting',
    iconSizeClass: 'text-[16px]',
    label: 'Settings',
    url: '/configuration',
    matchUrls: ['/locations', '/vendors', '/asset-code-format'],
  },
];
