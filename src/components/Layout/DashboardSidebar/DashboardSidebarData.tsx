import { HTMLAttributeAnchorTarget } from 'react';

export interface IMenuItem {
  id: number;
  parentId: number | null;
  displayOrder?: number;
  iconSizeClass: string;
  iconName: string;
  label: string;
  url?: string;
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

/** Children carry a right chevron, matching the platform's parent-menu pattern. */
const CHILD_ICON = 'right';

/**
 * Static sidebar menu for the Asset Management module, grouped the way the module
 * appears once it is mounted inside the main TulipsHRM shell: a handful of parent
 * menus that expand into their pages, rather than one flat list. Ids are stable —
 * retired ones (3) are never reused.
 *
 * Groups follow the lifecycle of an asset: it is REGISTERED, then OPERATED
 * (issued, moved, returned, counted), then carried through its LIFECYCLE
 * (serviced, depreciated, disposed).
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
    subMenu: [
      {
        id: 2,
        parentId: 20,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Assets',
        url: '/assets',
      },
      {
        id: 3,
        parentId: 20,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Categories',
        url: '/asset-categories',
      },
      {
        id: 13,
        parentId: 20,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Employees',
        url: '/employees',
      },
    ],
  },
  {
    id: 21,
    parentId: null,
    iconName: 'stream',
    iconSizeClass: 'text-[16px]',
    label: 'Asset Operations',
    subMenu: [
      {
        id: 4,
        parentId: 21,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Assignments',
        url: '/assignments',
      },
      {
        id: 5,
        parentId: 21,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Transfers',
        url: '/transfers',
      },
      {
        id: 6,
        parentId: 21,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Returns',
        url: '/returns',
      },
      {
        id: 7,
        parentId: 21,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Physical Verification',
        url: '/physical-verification',
      },
    ],
  },
  {
    id: 22,
    parentId: null,
    iconName: 'hourglass',
    iconSizeClass: 'text-[16px]',
    label: 'Asset Lifecycle',
    subMenu: [
      {
        id: 8,
        parentId: 22,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Maintenance',
        url: '/maintenance',
      },
      {
        id: 9,
        parentId: 22,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Depreciation',
        url: '/depreciation',
      },
      {
        id: 10,
        parentId: 22,
        iconName: CHILD_ICON,
        iconSizeClass: 'text-[11px]',
        label: 'Disposal',
        url: '/disposal',
      },
    ],
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
  },
];
