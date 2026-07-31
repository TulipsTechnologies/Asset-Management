'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, ReactNode, useEffect, FC } from 'react';

type TabProps = {
  id: string;
  label: string;
  buttonContent: ReactNode;
  children: ReactNode;
  disabled?: boolean;
};

type TabsProps = {
  tabs: TabProps[];
  defaultTabId?: string;
  className?: string;
  autoActive?: boolean;
  containerClassName?: string;
  tabButtonInactiveClassName?: string;
  tabButtonActiveClassName?: string;
  tabButtonClassName?: string;
  contentClassName?: string;
  errorTab?:string
};

export const Tabs: FC<TabsProps> = ({
  tabs,
  defaultTabId,
  className = '',
  autoActive = true,
  containerClassName = '',
  tabButtonInactiveClassName = '',
  tabButtonActiveClassName = '',
  tabButtonClassName = '',
  contentClassName = '',
  errorTab = '',
}) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTabId, setActiveTabId] = useState(
    defaultTabId || tabs[0]?.id || '',
  );

  useEffect(() => {
    setActiveTabId(defaultTabId || tabs[0]?.id || '');
  }, [defaultTabId]);

  useEffect(() => {
    if (autoActive) {
      const initialTab = searchParams.get('tab');

      if (initialTab) {
        const matchingTab = tabs.find(
          (tab) => tab.label.toLowerCase() === initialTab.toLowerCase(),
        );
        if (matchingTab) {
          setActiveTabId(matchingTab.id);
        }
      } else if (defaultTabId && tabs.some((tab) => tab.id === defaultTabId)) {
        setActiveTabId(defaultTabId);
      } else {
        setActiveTabId(tabs[0]?.id || '');
      }
    }
  }, [autoActive, searchParams, defaultTabId, tabs]);

  const updateUrlParam = (tabLabel: string | ReactNode) => {
    if (typeof tabLabel === 'string') {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', tabLabel.toLowerCase());
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  // const handleKeyDown = (
  //   event: React.KeyboardEvent<HTMLButtonElement>,
  //   index: number,
  // ) => {
  //   if (event.key === 'ArrowRight') {
  //     setActiveIndex((prev) => (prev + 1) % tabs.length);
  //   } else if (event.key === 'ArrowLeft') {
  //     setActiveIndex((prev) => (prev - 1 + tabs.length) % tabs.length);
  //   }
  // };

  return (
    <div className={`tabs-container ${className}`}>
      <div className={`tab-list flex border-b gap-x-10 ${containerClassName}`}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            className={`tab-item pb-3 border-b-2 ${
              tab.id === activeTabId
                ? `border-primarycolor ${tabButtonActiveClassName}`
                : `text-gray-500 border-transparent ${tabButtonInactiveClassName}`
            } ${
              tab.disabled ? 'opacity-30' : 'opacity-100'
            }   ${tabButtonClassName}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTabId(tab.id);
              autoActive && updateUrlParam(tab.label);
            }}
            // onKeyDown={(e) => handleKeyDown(e, index)}
            disabled={tab.disabled ?? false}
            role="tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={tab.id === activeTabId ? 0 : -1}
          >
            {tab.buttonContent}
          </button>
        ))}
      </div>
      <div className={`tab-content mt-5 ${contentClassName}`} role="tabpanel">
        {activeTab?.children}
      </div>
    </div>
  );
};
