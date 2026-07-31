"use client";
import { useState, useEffect, ReactNode, FC } from "react";

export interface AccordionItem {
  id: string;
  title: ReactNode;
  content: ReactNode;
  hidden?: boolean;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string | string[];
  multiOpen?: boolean;
  className?: string;
  containerClassName?: string;
  titleClassName?: string;
  titleContainerClassName?: string;
  contentClassName?: string;
}

const Accordion: FC<AccordionProps> = ({
  items,
  defaultOpenId,
  multiOpen = false,
  className = "",
  containerClassName = "",
  titleClassName = "",
  titleContainerClassName = "",
  contentClassName = "",
}) => {
  const [openIds, setOpenIds] = useState<Set<string> | string | null>(() => {
    if (multiOpen) {
      if (Array.isArray(defaultOpenId)) {
        return new Set(defaultOpenId);
      } else if (typeof defaultOpenId === "string") {
        return new Set([defaultOpenId]);
      }
      return new Set<string>();
    } else {
      return typeof defaultOpenId === "string" ? defaultOpenId : null;
    }
  });

  // Update openIds when defaultOpenId changes
  useEffect(() => {
    if (multiOpen) {
      if (Array.isArray(defaultOpenId)) {
        setOpenIds(new Set(defaultOpenId));
      } else if (typeof defaultOpenId === "string") {
        setOpenIds(new Set([defaultOpenId]));
      } else {
        setOpenIds(new Set<string>());
      }
    } else {
      setOpenIds(typeof defaultOpenId === "string" ? defaultOpenId : null);
    }
  }, [defaultOpenId, multiOpen]);

  const toggleItem = (id: string) => {
    if (multiOpen) {
      setOpenIds((prev) => {
        const newOpenIds = new Set(prev as Set<string>);
        if (newOpenIds.has(id)) {
          newOpenIds.delete(id);
        } else {
          newOpenIds.add(id);
        }
        return newOpenIds;
      });
    } else {
      setOpenIds((prevId) => (prevId === id ? null : id));
    }
  };

  const isOpen = (id: string) => {
    return multiOpen
      ? (openIds as Set<string>)?.has(id)
      : (openIds as string | null) === id;
  };

  return (
    <div className={`w-full space-y-5 ${className}`}>
      {items
        .filter((item) => !item.hidden)
        .map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-md ${containerClassName}`}
          >
            <div
              onClick={() => toggleItem(item.id)}
              className={`w-full flex justify-between items-center text-left text-gray-800   duration-200 cursor-pointer px-5 py-3 select-none ${titleContainerClassName}`}
            >
              <h2
                className={`font-bold text-lg text-primarycolor ${titleClassName}`}
              >
                {item.title}
              </h2>
              <span
                className={`transform transition-transform duration-300 ${
                  isOpen(item.id) ? "rotate-180" : "rotate-0"
                }`}
              >
                <i className="icon icon-down text-[7px]"></i>
              </span>
            </div>

            {isOpen(item.id) && (
              <div className={`${contentClassName}`}>{item.content}</div>
            )}
          </div>
        ))}
    </div>
  );
};

export default Accordion;
