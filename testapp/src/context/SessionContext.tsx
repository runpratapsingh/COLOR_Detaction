import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserSession } from '../types/jalq';

interface SessionContextType {
  session: UserSession | null;
  setSession: (session: UserSession | null) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<UserSession | null>(null);

  const logout = () => {
    setSession(null);
  };

  return (
    <SessionContext.Provider value={{ session, setSession, logout }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
