import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletContext";

const WalletConnectModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => {
  const { connectKasware, connectKastle, connecting } = useWallet();

  const handle = async (fn: () => Promise<void>) => {
    try {
      await fn();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to connect wallet");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect a Kaspa wallet</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Button variant="gradientOutline" disabled={connecting} onClick={() => handle(connectKasware)}>
            {/* Logo could be added here; using text for now */}
            Kasware Wallet
          </Button>
          <Button variant="gradientOutline" disabled={connecting} onClick={() => handle(connectKastle)}>
            Kastle Wallet
          </Button>
          <p className="text-xs text-muted-foreground">
            We’ll never custody funds. You’ll approve actions in your wallet.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WalletConnectModal;
