import { useState, ReactNode } from 'react';
import { NavigationContext } from './navigation.context';

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <NavigationContext.Provider
      value={{ isMenuOpen, setIsMenuOpen, toggleMenu }}
    >
      {children}
    </NavigationContext.Provider>
  );
}
