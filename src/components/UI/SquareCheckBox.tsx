import { FC, ReactNode } from 'react';

interface SquareCheckBoxProps {
  title: string | ReactNode;
  checked: boolean;
  onChange: () => void;
  isDisabled?: boolean;
}

const SquareCheckBox: FC<SquareCheckBoxProps> = ({
  title,
  checked,
  onChange,
  isDisabled = false,
}) => {
  return (
    <div
      className="flex items-center cursor-pointer"
      onClick={isDisabled ? undefined : onChange}
    >
      {checked ? (
        <i className="icon icon-checked text-primarycolor text-xl" />
      ) : (
        <i className="icon icon-unchecked text-gray-300 text-xl" />
      )}
      <span className="ml-2 text-gray-700">{title}</span>
    </div>
  );
};

export default SquareCheckBox;
