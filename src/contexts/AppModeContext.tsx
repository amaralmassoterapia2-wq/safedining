import { createContext, useContext, useState, ReactNode } from 'react';

type UserMode = 'guest' | 'restaurant';

interface AppModeContextType {
  userMode: UserMode;
  setUserMode: (mode: UserMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [userMode, setUserMode] = useState<UserMode>('guest');

  return (
    <AppModeContext.Provider value={{ userMode, setUserMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
