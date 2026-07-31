'use client';
import {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from 'react';

type DashboardContextType = {
  isMenuExtended: boolean;
  toggleMenu: (value?: boolean) => void;
  setIsMenuExtended: (value: boolean) => void;
  /** Off-canvas sidebar drawer state for < lg viewports. */
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (value: boolean) => void;
};

const DashboardContext = createContext<DashboardContextType | undefined>(
  undefined
);

export const DashboardCtxProvider = ({ children }: { children: ReactNode }) => {
  const [isMenuExtended, setIsMenuExtended] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('menuOpen', JSON.stringify(isMenuExtended));
  }, [isMenuExtended]);

  const toggleMenu = (value?: boolean) => {
    if (value) {
      setIsMenuExtended(value);
    } else {
      setIsMenuExtended((extended) => !extended);
    }
  };

  return (
    <DashboardContext.Provider
      value={{
        isMenuExtended,
        toggleMenu,
        setIsMenuExtended,
        isMobileMenuOpen,
        setIsMobileMenuOpen,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashbordCtx = () => {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error('useDashbordCtx must be used within a DashboardCtxProvider');
  }
  return context;
};
