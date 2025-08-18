import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/context/WalletContext";
import { validateUsername } from "@/lib/validation";
import { toast } from "sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

const UsernameModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => {
  const { profile, saveUsername } = useWallet();
  const [value, setValue] = useState("");

  const cooldownLeft = useMemo(() => {
    if (!profile?.lastUsernameChange) return 0;
    const last = new Date(profile.lastUsernameChange).getTime();
    const now = Date.now();
    const diff = 14 * DAY_MS - (now - last);
    return diff > 0 ? diff : 0;
  }, [profile?.lastUsernameChange]);

  const canEdit = cooldownLeft === 0 || !profile?.username;

  const onSave = () => {
    const validation = validateUsername(value);
    if (!validation.isValid) {
      toast.error(validation.error || 'Invalid username');
      return;
    }
    
    saveUsername(validation.sanitized);
    onOpenChange(false);
    toast.success('Username saved successfully!');
  };

  const fmt = (ms: number) => {
    const d = Math.floor(ms / DAY_MS);
    const h = Math.floor((ms % DAY_MS) / (60 * 60 * 1000));
    return `${d}d ${h}h`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create your username</DialogTitle>
          <DialogDescription>Used for your profile and menu. Unique per wallet.</DialogDescription>
        </DialogHeader>
        {canEdit ? (
          <div className="grid gap-3">
            <Input placeholder="choose a username" value={value} onChange={(e) => setValue(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="hero" onClick={onSave}>Save</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Username can be edited again in {fmt(cooldownLeft)}.</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UsernameModal;
