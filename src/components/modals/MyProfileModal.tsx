import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletContext";

const MyProfileModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditUsername: () => void;
}> = ({ open, onOpenChange, onEditUsername }) => {
  const { profile } = useWallet();
  const username = profile?.username ? `@${profile.username}` : "@unknown";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {profile?.username ? profile.username[0].toUpperCase() : "?"}
            </div>
            <div>
              <div className="font-medium">{username}</div>
              <div className="text-xs text-muted-foreground">Edit your profile every 14 days</div>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <div className="text-muted-foreground">Total Likes</div>
              <div className="font-semibold">0</div>
            </div>
            <div>
              <div className="text-muted-foreground">Total Followers</div>
              <div className="font-semibold">0</div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="hero" onClick={onEditUsername}>Edit username</Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyProfileModal;
