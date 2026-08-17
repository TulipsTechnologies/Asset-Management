'use client';
import {
  SelectHTMLAttributes,
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useId } from 'react';
import { FIELD_PLACEHOLDER_TEXT_CLASSES } from '@tulipstechnologies/common';

export interface ISelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  options: ISelectOption[];
  placeholder?: string;
  /** Shown when the filter matches nothing. */
  emptyText?: string;
}

/**
 * Searchable single-select, styled to match the underline Input primitive.
 *
 * Two decisions carry this component.
 *
 * A REAL <select> STAYS IN THE DOM. Every call site was written against a native select and
 * reads `e.target.value` off a genuine ChangeEvent. Rather than hand them a synthetic
 * look-alike, choosing an option writes through the native value setter and dispatches a real
 * `change` event, so React delivers exactly the event it always did — and `name`, `id`,
 * `required` and the rest of the spread props keep working. The visible control is a button;
 * the select is hidden from the pointer and the tab order so there is only one focus stop.
 *
 * THE LIST IS PORTALED AND POSITIONED FIXED. Selects sit inside modals and table scroll
 * containers whose `overflow` would clip an absolutely-positioned popover — the same reason
 * Dropdown portals its menu. Anchoring to the trigger's viewport rect escapes the clip, and
 * the list flips above the field when there is no room below.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      helperText,
      required = false,
      className = '',
      options,
      placeholder,
      emptyText = 'No matches',
      disabled,
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const selectRef = useRef<HTMLSelectElement | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const [style, setStyle] = useState<React.CSSProperties>({ opacity: 0 });
    const labelId = useId();

    const selected = options.find((o) => o.value === value);

    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return options;
      return options.filter((o) => o.label.toLowerCase().includes(q));
    }, [options, query]);

    // ---------------------------------------------------------------- position

    const place = useCallback(() => {
      if (!triggerRef.current || !popoverRef.current) return;

      const trigger = triggerRef.current.getBoundingClientRect();
      const height = popoverRef.current.offsetHeight;
      const margin = 8;

      const spaceBelow = window.innerHeight - trigger.bottom;
      const above = spaceBelow < height + margin && trigger.top > spaceBelow;

      setStyle({
        position: 'fixed',
        top: above ? Math.max(margin, trigger.top - height - 4) : trigger.bottom + 4,
        left: Math.max(
          margin,
          Math.min(trigger.left, window.innerWidth - trigger.width - margin)
        ),
        width: trigger.width,
        opacity: 1,
      });
    }, []);

    useLayoutEffect(() => {
      if (open) place();
    }, [open, place, filtered.length]);

    useEffect(() => {
      if (!open) return;
      // The popover is anchored in viewport coordinates, so anything that moves the trigger
      // has to move it too. Capture phase catches scrolling inside modals and tables, not
      // just the window.
      const reposition = () => place();
      window.addEventListener('resize', reposition);
      window.addEventListener('scroll', reposition, true);
      return () => {
        window.removeEventListener('resize', reposition);
        window.removeEventListener('scroll', reposition, true);
      };
    }, [open, place]);

    // ---------------------------------------------------------------- open / close

    const close = useCallback(() => {
      setOpen(false);
      setQuery('');
    }, []);

    useEffect(() => {
      if (!open) return;
      const onPointerDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (wrapperRef.current?.contains(target)) return;
        // Portaled, so the popover is not a DOM descendant of the wrapper.
        if (popoverRef.current?.contains(target)) return;
        close();
      };
      document.addEventListener('mousedown', onPointerDown, true);
      return () => document.removeEventListener('mousedown', onPointerDown, true);
    }, [open, close]);

    useEffect(() => {
      if (!open) return;
      searchRef.current?.focus();
      const index = options.findIndex((o) => o.value === value);
      setActive(index >= 0 ? index : 0);
      // Runs only when the popover opens.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Keep the highlighted row in view while arrowing through a long list.
    useEffect(() => {
      if (!open || !listRef.current) return;
      const node = listRef.current.querySelector(`[data-index="${active}"]`);
      node?.scrollIntoView({ block: 'nearest' });
    }, [active, open]);

    // ---------------------------------------------------------------- selection

    /**
     * Writes through the native setter and fires a real change event, so the consumer's
     * onChange receives the ChangeEvent it was written against.
     */
    const pick = (optionValue: string) => {
      const node = selectRef.current;
      if (node) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value'
        )?.set;
        setter?.call(node, optionValue);
        node.dispatchEvent(new Event('change', { bubbles: true }));
      }
      close();
      triggerRef.current?.focus();
    };

    const onTriggerKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return;
      if (!open && (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown')) {
        event.preventDefault();
        setOpen(true);
      }
    };

    const onSearchKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActive((i) => Math.min(i + 1, filtered.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const option = filtered[active];
        if (option) pick(option.value);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      } else if (event.key === 'Tab') {
        close();
      }
    };

    return (
      <div className={`flex flex-col ${className}`} ref={wrapperRef}>
        {label && (
          <label id={labelId} htmlFor={props.id} className="block text-sm font-medium text-gray-500">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        {/* The real control: hidden from pointer and tab order, but still the element that
            owns the value and emits the change event. */}
        <select
          {...props}
          ref={(node) => {
            selectRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) ref.current = node;
          }}
          value={value}
          onChange={onChange}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only pointer-events-none absolute"
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          onKeyDown={onTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={label ? labelId : undefined}
          className={`flex w-full items-center justify-between gap-2 border-b bg-transparent px-0 py-2 text-left text-base ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <span className={`truncate ${selected ? '' : FIELD_PLACEHOLDER_TEXT_CLASSES}`}>
            {selected?.label ?? placeholder ?? ''}
          </span>
          <i
            className={`icon icon-down shrink-0 text-[10px] text-gray-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        {!error && helperText && (
          <p className="text-gray-500 text-xs mt-1 italic">{helperText}</p>
        )}

        {open &&
          typeof document !== 'undefined' &&
          createPortal(
            <div
              ref={popoverRef}
              style={style}
              // Above the modal layer (z-[10000]) so a select inside a dialog still opens
              // over it rather than behind.
              className="z-[10050] overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg"
            >
              <div className="border-b border-gray-100 p-2">
                <div className="flex items-center gap-2 rounded bg-gray-50 px-2 py-1.5">
                  <i className="icon icon-search text-xs text-gray-400" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActive(0);
                    }}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Search…"
                    aria-label={typeof label === 'string' && label ? `Search ${label}` : 'Search options'}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery('');
                        searchRef.current?.focus();
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <i className="icon icon-close text-[10px]" />
                    </button>
                  )}
                </div>
              </div>

              <ul ref={listRef} role="listbox" className="max-h-60 overflow-y-auto py-1">
                {/* The placeholder is a real choice — it clears the field. Hidden while
                    filtering, where it would just be noise. */}
                {placeholder !== undefined && !query && (
                  <li
                    role="option"
                    aria-selected={!selected}
                    onClick={() => pick('')}
                    className={`cursor-pointer px-3 py-2 text-sm text-gray-400 hover:bg-gray-50 ${
                      !selected ? 'bg-primarycolor/5' : ''
                    }`}
                  >
                    {placeholder}
                  </li>
                )}

                {filtered.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-gray-400">{emptyText}</li>
                )}

                {filtered.map((option, index) => {
                  const isSelected = option.value === value;
                  return (
                    <li
                      key={option.value}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => pick(option.value)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm ${
                        index === active ? 'bg-gray-50' : ''
                      } ${isSelected ? 'font-medium text-primarycolor' : 'text-gray-700'}`}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && <i className="icon icon-check shrink-0 text-[10px]" />}
                    </li>
                  );
                })}
              </ul>
            </div>,
            document.body
          )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;
