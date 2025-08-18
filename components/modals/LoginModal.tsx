import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const LoginModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onContinue: () => void;
}> = ({ open, onOpenChange, onContinue }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Login required</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">You need to login or connect a wallet to perform this action. This is a mock flow only.</p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" onClick={onContinue}>Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
