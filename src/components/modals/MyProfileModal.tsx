import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
const MyProfileModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditUsername: () => void;
}> = ({ open, onOpenChange, onEditUsername }) => {
  const { profile, identity, saveAvatarUrl } = useWallet();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const username = profile?.username ? `@${profile.username}` : "@unknown";

  const handlePick = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("Please upload an image under 5MB.");
      return;
    }
    const key = `${identity?.id || "anon"}/${Date.now()}-${file.name}`;
    try {
      setUploading(true);
      const { data, error } = await supabase.storage.from("avatars").upload(key, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(data?.path || key);
      if (pub?.publicUrl) saveAvatarUrl(pub.publicUrl);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-10">
                <AvatarImage src={profile?.avatarUrl} alt={`${username} profile image`} />
                <AvatarFallback>{profile?.username ? profile.username[0].toUpperCase() : "?"}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{username}</div>
                <div className="text-xs text-muted-foreground">Edit your profile every 14 days</div>
                <div className="mt-2 flex items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                  <Button variant="glass" size="sm" onClick={handlePick} disabled={uploading}>
                    {uploading ? "Uploading..." : "Change photo"}
                  </Button>
                </div>
                {error && <div className="text-xs text-[hsl(var(--destructive))] mt-1">{error}</div>}
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
