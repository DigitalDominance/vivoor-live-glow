import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ClipVerifiedBadge from "@/components/ClipVerifiedBadge";
import { useUserVerification } from "@/hooks/useUserVerification";

export type UserProfile = {
  id: string;
  handle: string;
  displayName: string;
  bio: string;
  followers: number;
  following: number;
  tags: string[];
  avatar?: string;
  socials?: { twitter?: string; youtube?: string; tiktok?: string };
};

const ProfileModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile?: UserProfile;
  isLoggedIn?: boolean;
  onRequireLogin?: () => void;
  onGoToChannel?: () => void;
}> = ({ open, onOpenChange, profile, isLoggedIn, onRequireLogin, onGoToChannel }) => {
  const navigate = useNavigate();
  const { identity, sessionToken } = useWallet();
  const [following, setFollowing] = React.useState(false);
  const { data: verificationData } = useUserVerification(profile?.id);

  // Check if user is following this profile
  React.useEffect(() => {
    const checkFollowing = async () => {
      if (!open || !profile || !identity?.id || identity.id === profile.id) {
        setFollowing(false);
        return;
      }
      
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', identity.id)
        .eq('following_id', profile.id)
        .single();
      
      setFollowing(!!data);
    };
    
    checkFollowing();
  }, [open, profile, identity?.id]);

  const handleFollow = async () => {
    if (!isLoggedIn || !identity?.id || !sessionToken) {
      onRequireLogin?.();
      return;
    }

    if (!profile) return;

    try {
      const { data, error } = await supabase.rpc('toggle_follow_secure', {
        session_token_param: sessionToken,
        wallet_address_param: identity.address,
        following_id_param: profile.id
      });

      if (error) throw error;

      const result = data?.[0];
      if (result) {
        setFollowing(result.action === 'followed');
        toast({ title: result.action === 'followed' ? "Followed" : "Unfollowed" });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: "Failed to update follow status", variant: "destructive" });
    }
  };

  const handleGoToChannel = () => {
    if (profile) {
      // Navigate using handle/username instead of ID
      navigate(`/channel/${profile.handle || profile.id}`);
      onOpenChange(false);
    }
  };

  if (!profile) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>@{profile.handle}</DialogTitle>
        </DialogHeader>
        <div className="flex items-start gap-4">
          <Avatar className="size-14">
            <AvatarImage src={profile.avatar || ''} alt={`${profile.displayName} avatar`} />
            <AvatarFallback className="bg-grad-primary text-[hsl(var(--on-gradient))]">
              {(profile.displayName || profile.handle || 'U')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{profile.displayName}</span>
              <ClipVerifiedBadge userId={profile.id} size="sm" />
            </div>
            {verificationData?.isVerified && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">This Account Is Verified!</span>
              </div>
            )}
            <div className="text-sm text-muted-foreground mt-1">{profile.bio}</div>
            <div className="text-xs text-muted-foreground mt-2">{profile.followers.toLocaleString()} followers • {profile.following.toLocaleString()} following</div>
            <div className="flex gap-2 mt-3">
              {identity?.id !== profile.id && (
                <Button
                  variant={following ? "secondary" : "hero"}
                  onClick={handleFollow}
                >
                  {following ? 'Following' : 'Follow'}
                </Button>
              )}
              <Button variant="gradientOutline" onClick={handleGoToChannel}>Go to channel</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileModal;
