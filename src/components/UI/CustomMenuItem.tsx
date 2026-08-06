import { FC, ReactNode } from 'react';

interface CustomMenuItemProps {
  onClick: () => void;
  icon?: ReactNode;
  label: string | ReactNode;
  customStyles?: Record<string, any>;
  className?: string;
  border?: boolean;
  /** Render the item in a destructive (red) style. Auto-on for a "Delete" label. */
  danger?: boolean;
}

const CustomMenuItem: FC<CustomMenuItemProps> = ({
  onClick,
  icon,
  label,
  className = '',
  border = true,
  danger,
}) => {
  const isDanger =
    danger ??
    (typeof label === 'string' && label.trim().toLowerCase() === 'delete');

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onClick();
        }
      }}
      className={`flex items-center py-3 px-3 cursor-pointer ${
        isDanger ? 'hover:bg-red-50' : 'hover:bg-gray-50'
      } ${border ? 'border-b border-gray-200' : ''} ${
        className ? className : ''
      }`}
    >
      {icon && (
        <span
          className={`mr-2 w-5 ${
            isDanger ? 'text-red-500' : 'text-gray-500'
          }`}
        >
          {icon}
        </span>
      )}
      <span
        className={`text-sm whitespace-nowrap ${isDanger ? 'text-red-500' : ''}`}
      >
        {label}
      </span>
    </div>
  );
};

export default CustomMenuItem;
