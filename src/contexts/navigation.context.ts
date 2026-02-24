import { createContext } from 'react';

export interface NavigationContextType {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
}

export const NavigationContext = createContext<
  NavigationContextType | undefined
>(undefined);
