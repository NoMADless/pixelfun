"use client";

import { createContext, useContext, type ReactNode } from "react";

interface RuntimeConfig {
  mockMode: boolean;
}

const RuntimeConfigContext = createContext<RuntimeConfig>({ mockMode: false });

export function RuntimeConfigProvider({
  mockMode,
  children,
}: {
  mockMode: boolean;
  children: ReactNode;
}) {
  return (
    <RuntimeConfigContext.Provider value={{ mockMode }}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}

export function useRuntimeConfig(): RuntimeConfig {
  return useContext(RuntimeConfigContext);
}
