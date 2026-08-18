import { ReactNode, useState, useRef, useCallback, RefObject, FC } from "react";
import { createPortal } from "react-dom";
import useAnchoredReposition from "@/hooks/useAnchoredReposition";

interface TooltipProps {
  text: string | ReactNode;
  children: React.ReactNode;
  position?: "top" | "right" | "bottom" | "left";
  className?: string;
  style?: React.CSSProperties;
  ref?: RefObject<HTMLElement>;
}

const Tooltip: FC<TooltipProps> = ({
  text,
  children,
  position = "top",
  className,
  style,
  ref,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{
    top: number;
    left: number;
  }>({
    top: 0,
    left: 0,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const calculatePosition = (triggerRect: DOMRect) => {
    if (!tooltipRef.current) return { top: 0, left: 0 };

    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const margin = 8;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    let top = 0;
    let left = 0;

    // Center horizontally for top/bottom, vertically for left/right
    const centerHorizontal =
      triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const centerVertical =
      triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;

    switch (position) {
      case "top":
        top = triggerRect.top - tooltipRect.height - margin;
        left = centerHorizontal;
        // Flip to bottom if not enough space above
        if (top < 0) {
          top = triggerRect.bottom + margin;
        }
        break;

      case "bottom":
        top = triggerRect.bottom + margin;
        left = centerHorizontal;
        // Flip to top if not enough space below
        if (top + tooltipRect.height > windowHeight) {
          top = triggerRect.top - tooltipRect.height - margin;
        }
        break;

      case "right":
        top = centerVertical;
        left = triggerRect.right + margin;
        // Flip to left if not enough space on right
        if (left + tooltipRect.width > windowWidth) {
          left = triggerRect.left - tooltipRect.width - margin;
        }
        break;

      case "left":
        top = centerVertical;
        left = triggerRect.left - tooltipRect.width - margin;
        // Flip to right if not enough space on left
        if (left < 0) {
          left = triggerRect.right + margin;
        }
        break;
    }

    // Final boundary checks
    left = Math.max(0, Math.min(left, windowWidth - tooltipRect.width));
    top = Math.max(0, Math.min(top, windowHeight - tooltipRect.height));

    // Adjust vertical centering if flipped
    if (
      (position === "top" || position === "bottom") &&
      top !== triggerRect.top - tooltipRect.height - margin &&
      top !== triggerRect.bottom + margin
    ) {
      top = centerVertical;
      // Ensure it still fits vertically
      top = Math.max(0, Math.min(top, windowHeight - tooltipRect.height));
    }

    return { top, left };
  };

  const handleMouseEnter = (e: React.MouseEvent) => {
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const updateTooltipPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setTooltipPosition(calculatePosition(rect));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  // The tooltip is portaled to `document.body` and positioned in viewport
  // coordinates, so it has to be re-anchored whenever anything scrolls.
  useAnchoredReposition(isVisible, updateTooltipPosition);

  return (
    <div
      ref={triggerRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={style}
    >
      {children}

      {isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            className={`fixed z-[1200]`}
            style={{
              top: tooltipPosition.top,
              left: tooltipPosition.left,
            }}
          >
            {/*<div className="bg-white text-black text-sm rounded shadow-md px-2 py-1 max-w-80 whitespace-nowrap">*/}
            <div className="bg-white inline-block text-black text-sm rounded shadow-md px-2 py-1 max-w-80">
              {text}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default Tooltip;
