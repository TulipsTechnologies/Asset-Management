interface ParentProps {
    label: string;
    color?: string;
    className?: string;
    textColor?: string;
}

const Badge = ({ label, color, className, textColor = 'black' }: ParentProps) => {
    return <span className={`text-sm me-2 px-2.5 py-0.5 rounded-full text-gray-700 ${className}`} style={{ backgroundColor: `#${color}`, color: textColor }}>
        {label}
    </span>
}

export default Badge;