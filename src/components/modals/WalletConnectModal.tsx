import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletContext";
import { toast } from "sonner";
import KaspaIcon from "@/components/KaspaIcon";

interface WalletConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { connectKasware, connecting } = useWallet();
  const [connecting2, setConnecting2] = useState(false);

  const handleConnect = async () => {
    setConnecting2(true);
    try {
      await connectKasware();
      toast.success("Wallet connected successfully!");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect wallet");
    } finally {
      setConnecting2(false);
    }
  };

  const isConnecting = connecting || connecting2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Connect Your Wallet</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground text-center">
            Connect your Kaspa wallet to continue. You'll need to sign a message to verify ownership.
          </p>

          <div className="space-y-3">
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full h-12 text-base font-medium"
              variant="hero"
            >
              <KaspaIcon className="w-5 h-5 mr-2" />
              {isConnecting ? "Connecting..." : "Connect Kasware"}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground text-center space-y-1">
            <p>• Kasware wallet required</p>
            <p>• Message signing for secure authentication</p>
            <p>• Your private keys never leave your wallet</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};