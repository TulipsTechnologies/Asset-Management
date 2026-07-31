import { IMenuItem } from './DashboardSidebarData';
import { useDashbordCtx } from '../DashboardLayout/Contexts/DashboardContext';

const Phase2Badge = () => (
  <span className="ml-2 shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium leading-4 text-amber-700">
    Phase 2
  </span>
);

const SidebarItem = ({
  item,
  isActive,
  isChild,
  menuExtended,
  onClick,
  isSingleMenu = false,
}: {
  item: IMenuItem;
  menuExtended: boolean;
  isActive?: boolean;
  isChild?: boolean;
  isSingleMenu?: boolean;
  onClick?: () => void;
}) => {
  const { isMenuExtended } = useDashbordCtx();
  return (
    <>
      <div
        className={`flex justify-${
          isChild ? 'between w-full' : 'start'
        } items-center min-w-0`}
        onClick={onClick}
      >
        {!isChild && (
          <span
            className={`flex w-7 shrink-0 justify-center items-center ${
              isMenuExtended ? 'mr-2.5' : ''
            }`}
          >
            <i
              className={`icon icon-${item.iconName} ${item.iconSizeClass} text-primarycolor`}
            ></i>
          </span>
        )}
        {menuExtended && (
          <span className={`flex min-w-0 items-center ${isChild ? 'grow' : ''}`}>
            <span className="truncate text-sm">{item.label}</span>
            {item.phase2 && !isChild && <Phase2Badge />}
          </span>
        )}
        {isChild && menuExtended && item.phase2 && <Phase2Badge />}
        {isChild && (
          <span className="flex w-7 shrink-0 justify-center items-center mr-2.5">
            <i
              className={`icon icon-${item.iconName} ${item.iconSizeClass} text-primarycolor`}
            ></i>
          </span>
        )}
      </div>
      {menuExtended &&
        item.subMenu &&
        item.subMenu.length > 0 &&
        !isSingleMenu && (
          <i
            className={`icon ${isActive ? 'icon-up' : 'icon-down'} text-[6px]`}
          ></i>
        )}

      {isSingleMenu && <i className={`icon icon-right text-[11px]`}></i>}
    </>
  );
};

export default SidebarItem;
