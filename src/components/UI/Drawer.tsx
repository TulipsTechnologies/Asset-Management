import { FC, ReactNode, useEffect, useRef } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  excludeButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const Drawer: FC<DrawerProps> = ({ isOpen, onClose, children, excludeButtonRef }) => {
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Close the drawer when clicked outside of it
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    
    // Check if click is inside drawer
    if (drawerRef.current && drawerRef.current.contains(target)) {
      return;
    }
    
    // Check if click is on the excluded button
    if (excludeButtonRef?.current && excludeButtonRef.current.contains(target)) {
      return;
    }
    
    // Click is outside both drawer and button, close the drawer
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div
      className={`fixed top-0 right-0 h-full overflow-y-auto bg-white shadow-lg transition-transform duration-300 ease-in-out z-50 transform ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div ref={drawerRef}>{children}</div>
    </div>
  );
};

export default Drawer;
