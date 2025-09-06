import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletContext";
import { WalletConnectModal } from "./WalletConnectModal";

export const LoginModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onContinue: () => void;
}> = ({ open, onOpenChange, onContinue }) => {
  const { identity } = useWallet();
  const [showWalletConnect, setShowWalletConnect] = useState(false);

  const handleConnectWallet = () => {
    setShowWalletConnect(true);
  };

  const handleWalletConnected = () => {
    setShowWalletConnect(false);
    onContinue();
    onOpenChange(false);
  };

  const handleContinue = () => {
    if (identity) {
      onContinue();
      onOpenChange(false);
    } else {
      handleConnectWallet();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {identity 
              ? "You need to authenticate to perform this action."
              : "Connect your wallet to authenticate and access this feature."
            }
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="hero" onClick={handleContinue}>
              {identity ? "Continue" : "Connect Wallet"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WalletConnectModal 
        open={showWalletConnect}
        onOpenChange={setShowWalletConnect}
        onSuccess={handleWalletConnected}
      />
    </>
  );
};
