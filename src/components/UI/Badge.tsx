interface ParentProps {
    label: string;
    color?: string;
    className?: string;
    textColor?: string;
}

/**
 * `color` is an optional bare hex (with or without `#`). It is only applied when
 * actually supplied — this used to emit `backgroundColor: "#undefined"` for every
 * caller that relied on `className` for its colors instead.
 */
const Badge = ({ label, color, className = '', textColor }: ParentProps) => {
    const style = color
        ? { backgroundColor: `#${color.replace(/^#/, '')}`, color: textColor ?? 'black' }
        : textColor
            ? { color: textColor }
            : undefined;

    return <span
        className={`inline-flex max-w-full items-center truncate rounded-md px-2.5 py-1 text-xs font-medium leading-none me-2 ${className || (style ? '' : 'bg-gray-100 text-gray-800')}`}
        style={style}
    >
        {label}
    </span>
}

export default Badge;
