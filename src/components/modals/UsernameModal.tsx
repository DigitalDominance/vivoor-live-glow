import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/context/WalletContext";
import { useProfileCooldowns } from "@/hooks/useProfileCooldowns";

const DAY_MS = 24 * 60 * 60 * 1000;

const UsernameModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => {
  const { profile, saveUsername, identity } = useWallet();
  const [value, setValue] = useState("");
  const { usernameCooldown } = useProfileCooldowns(identity?.id);

  const cooldownLeft = useMemo(() => {
    if (!usernameCooldown.cooldown_ends_at) return 0;
    const endsAt = new Date(usernameCooldown.cooldown_ends_at).getTime();
    const now = Date.now();
    const diff = endsAt - now;
    return diff > 0 ? diff : 0;
  }, [usernameCooldown.cooldown_ends_at]);

  const canEdit = usernameCooldown.can_change || !profile?.username;

  const onSave = async () => {
    const clean = value.trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) return alert("Username must be 3-20 characters (letters, numbers, underscore)");
    try {
      await saveUsername(clean);
      onOpenChange(false);
    } catch (error) {
      alert("Failed to save username. Please try again.");
    }
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
