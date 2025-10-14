import { createContext, useContext, useState, ReactNode } from "react";

interface HalloweenContextType {
  isHalloweenMode: boolean;
  toggleHalloweenMode: () => void;
}

const HalloweenContext = createContext<HalloweenContextType | undefined>(undefined);

export const HalloweenProvider = ({ children }: { children: ReactNode }) => {
  const [isHalloweenMode, setIsHalloweenMode] = useState(true);

  const toggleHalloweenMode = () => {
    setIsHalloweenMode((prev) => !prev);
  };

  return (
    <HalloweenContext.Provider value={{ isHalloweenMode, toggleHalloweenMode }}>
      {children}
    </HalloweenContext.Provider>
  );
};

export const useHalloween = () => {
  const context = useContext(HalloweenContext);
  if (!context) {
    throw new Error("useHalloween must be used within a HalloweenProvider");
  }
  return context;
};
