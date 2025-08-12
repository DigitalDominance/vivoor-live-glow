import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserProfile } from "@/mock/data";

const ProfileModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile?: UserProfile;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onGoToChannel?: () => void;
}> = ({ open, onOpenChange, profile, isLoggedIn, onRequireLogin, onGoToChannel }) => {
  const [following, setFollowing] = React.useState(false);

  React.useEffect(() => {
    if (!open) setFollowing(false);
  }, [open]);

  if (!profile) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>@{profile.handle}</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-4">
          <div className="size-14 rounded-full p-[2px] bg-grad-primary">
            <div className="size-full rounded-full bg-background" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium">{profile.displayName}</div>
            <div className="text-sm text-muted-foreground mt-1">{profile.bio}</div>
            <div className="text-xs text-muted-foreground mt-2">{profile.followers.toLocaleString()} followers • {profile.following.toLocaleString()} following</div>
            <div className="flex gap-2 mt-3">
              <Button
                variant={following ? "secondary" : "hero"}
                onClick={() => {
                  if (!isLoggedIn) return onRequireLogin?.();
                  setFollowing((v) => !v);
                }}
              >
                {following ? 'Following' : 'Follow'}
              </Button>
              <Button variant="gradientOutline" onClick={onGoToChannel}>Go to channel</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
