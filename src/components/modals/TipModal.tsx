import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KaspaLogo from "@/components/icons/KaspaLogo";

const TipModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
}> = ({ open, onOpenChange, isLoggedIn, onRequireLogin }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KaspaLogo className="size-5 text-[hsl(var(--brand-cyan))]" /> Tip in KAS
          </DialogTitle>
        </DialogHeader>
        {isLoggedIn ? (
          <p className="text-sm text-muted-foreground">Tipping would be available here. In this mock, no transaction occurs.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Login / connect wallet to tip in Kaspa. This is non-functional.</p>
        )}
        <div className="flex justify-end gap-2 mt-4">
          {!isLoggedIn && <Button variant="hero" onClick={onRequireLogin}>Login</Button>}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TipModal;
