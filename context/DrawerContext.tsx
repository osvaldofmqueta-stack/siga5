import React, { createContext, useContext, useState, useMemo, ReactNode } from 'react';

interface DrawerContextValue {
  leftOpen: boolean;
  rightOpen: boolean;
  openLeft: () => void;
  closeLeft: () => void;
  openRight: () => void;
  closeRight: () => void;
  closeAll: () => void;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

export function DrawerProvider({ children }: { children: ReactNode }) {
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const value = useMemo<DrawerContextValue>(() => ({
    leftOpen,
    rightOpen,
    openLeft: () => { setRightOpen(false); setLeftOpen(true); },
    closeLeft: () => setLeftOpen(false),
    openRight: () => { setLeftOpen(false); setRightOpen(true); },
    closeRight: () => setRightOpen(false),
    closeAll: () => { setLeftOpen(false); setRightOpen(false); },
  }), [leftOpen, rightOpen]);

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
}

export function useDrawer() {
  const ctx = useContext(DrawerContext);
  if (!ctx) throw new Error('useDrawer must be used within DrawerProvider');
  return ctx;
}
