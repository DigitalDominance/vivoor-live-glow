declare global {
  interface Window {
    kasware?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      getVersion?: () => Promise<string>;
      getNetwork?: () => Promise<string>;
      switchNetwork?: (network: string) => Promise<void>;
      sendKaspa: (toAddress: string, sompi: number, options?: { priorityFee?: number; payload?: string }) => Promise<string>;
      // Additional methods may exist; we only type what we use.
    };
  }
}

export {};
