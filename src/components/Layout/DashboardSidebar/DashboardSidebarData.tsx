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

/**
 * Static sidebar menu for the Asset Management module (navigation per the
 * technical architecture §3.3). Items flagged phase2 are deferred workflow
 * areas — they render a badge and route to /coming-soon until implemented.
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
    id: 2,
    parentId: null,
    iconName: 'box',
    iconSizeClass: 'text-[16px]',
    label: 'Assets',
    url: '/assets',
  },
  // Asset Categories intentionally has no sidebar entry — like Locations and
  // Vendors it is reachable through the Configuration hub only (id 3 retired,
  // ids are stable — do not reuse).
  {
    id: 4,
    parentId: null,
    iconName: 'checklist',
    iconSizeClass: 'text-[16px]',
    label: 'Assignments',
    url: '/assignments',
  },
  {
    id: 13,
    parentId: null,
    iconName: 'users',
    iconSizeClass: 'text-[16px]',
    label: 'Employees',
    url: '/employees',
  },
  {
    id: 5,
    parentId: null,
    iconName: 'move',
    iconSizeClass: 'text-[16px]',
    label: 'Transfers',
    url: '/transfers',
  },
  {
    id: 6,
    parentId: null,
    iconName: 'refresh',
    iconSizeClass: 'text-[16px]',
    label: 'Returns',
    url: '/returns',
  },
  {
    id: 7,
    parentId: null,
    iconName: 'checklist',
    iconSizeClass: 'text-[16px]',
    label: 'Physical Verification',
    url: '/physical-verification',
  },
  {
    id: 8,
    parentId: null,
    iconName: 'tools',
    iconSizeClass: 'text-[16px]',
    label: 'Maintenance',
    url: '/coming-soon',
    phase2: true,
  },
  {
    id: 9,
    parentId: null,
    iconName: 'graph',
    iconSizeClass: 'text-[16px]',
    label: 'Depreciation',
    url: '/coming-soon',
    phase2: true,
  },
  {
    id: 10,
    parentId: null,
    iconName: 'trash',
    iconSizeClass: 'text-[16px]',
    label: 'Disposal',
    url: '/coming-soon',
    phase2: true,
  },
  {
    id: 11,
    parentId: null,
    iconName: 'report',
    iconSizeClass: 'text-[16px]',
    label: 'Reports',
    url: '/coming-soon',
    phase2: true,
  },
  {
    id: 12,
    parentId: null,
    iconName: 'setting',
    iconSizeClass: 'text-[16px]',
    label: 'Configuration',
    url: '/configuration',
  },
];
