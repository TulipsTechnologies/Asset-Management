import { FC, ReactNode } from 'react';

interface CustomCheckboxProps {
  title: string | ReactNode;
  checked: boolean;
  onChange: () => void;
}

const CustomCheckbox: FC<CustomCheckboxProps> = ({
  title,
  checked,
  onChange,
}) => {
  return (
    <div className="flex items-center cursor-pointer" onClick={onChange}>
      {checked ? (
        <i className="icon icon-checked text-primarycolor text-lg" />
      ) : (
        <i className="icon icon-unchecked text-gray-300 text-lg" />
      )}
      <span className="ml-2 text-gray-700">{title}</span>
    </div>
  );
};

export default CustomCheckbox;
