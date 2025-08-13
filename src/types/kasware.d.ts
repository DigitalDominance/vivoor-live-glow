declare global {
  interface Window {
    kasware?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      getVersion?: () => Promise<string>;
      getNetwork?: () => Promise<string>;
      switchNetwork?: (network: string) => Promise<void>;
      // Additional methods may exist; we only type what we use.
    };
  }
}

export {};
