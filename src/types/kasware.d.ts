declare global {
  interface Window {
    kasware?: {
      requestAccounts: () => Promise<string[]>;
      getAccounts: () => Promise<string[]>;
      getPublicKey: () => Promise<string>;
      getVersion?: () => Promise<string>;
      getNetwork?: () => Promise<string>;
      switchNetwork?: (network: string) => Promise<void>;
      disconnect?: (origin: string) => Promise<void>;
      sendKaspa: (toAddress: string, sompi: number, options?: { priorityFee?: number; payload?: string }) => Promise<string>;
      signMessage: (message: string, type?: "ecdsa" | "bip322-simple") => Promise<string>;
      verifyMessage?: (pubkey: string, message: string, signature: string) => Promise<boolean>;
      // Additional methods may exist; we only type what we use.
    };
  }
}

export {};