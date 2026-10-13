import { createContext, type PropsWithChildren, useContext } from "react";

interface StartupReadyProviderProps extends PropsWithChildren {
  onReady: () => void;
}

const StartupReadyContext = createContext<(() => void) | null>(null);

export function StartupReadyProvider({ children, onReady }: StartupReadyProviderProps) {
  return <StartupReadyContext value={onReady}>{children}</StartupReadyContext>;
}

export function useStartupReady() {
  const markReady = useContext(StartupReadyContext);

  if (!markReady) {
    throw new Error("useStartupReady must be used within StartupReadyProvider");
  }

  return markReady;
}
