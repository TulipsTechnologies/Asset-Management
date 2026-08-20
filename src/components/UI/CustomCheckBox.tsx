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
    // A <button role="checkbox">, not a <div onClick>. As a div this was invisible to
    // assistive tech (no role, no state — the title read as static prose) and impossible to
    // operate by keyboard: WCAG 2.1.1, 4.1.2 and 1.3.1 all failed on the same element.
    // The glyphs are aria-hidden so the title is the sole accessible name.
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className="flex items-center cursor-pointer text-left"
    >
      {checked ? (
        <i aria-hidden="true" className="icon icon-checked text-primarycolor text-lg" />
      ) : (
        <i aria-hidden="true" className="icon icon-unchecked text-gray-300 text-lg" />
      )}
      <span className="ml-2 text-gray-700">{title}</span>
    </button>
  );
};

export default CustomCheckbox;
