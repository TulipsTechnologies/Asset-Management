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
    // See CustomCheckBox for why this is a button. This one also drives the per-column
    // visibility toggles inside CustomTable's Columns drawer, so as a div it made column
    // visibility mouse-only on every table in the app.
    //
    // `disabled` rather than dropping the handler: an inert div still announced as though it
    // were operable, because nothing exposed the disabled state.
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={isDisabled}
      onClick={onChange}
      className="flex items-center cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      {checked ? (
        <i aria-hidden="true" className="icon icon-checked text-primarycolor text-xl" />
      ) : (
        <i aria-hidden="true" className="icon icon-unchecked text-gray-300 text-xl" />
      )}
      <span className="ml-2 text-gray-700">{title}</span>
    </button>
  );
};

export default SquareCheckBox;
