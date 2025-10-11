import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/context/WalletContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import AvatarCropper from "@/components/modals/AvatarCropper";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useKnsDomain } from "@/hooks/useKnsDomain";
import knsLogo from "@/assets/kns-logo.png";

const MyProfileModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onEditUsername: () => void;
}> = ({ open, onOpenChange, onEditUsername }) => {
  const { profile, identity, sessionToken, saveAvatarUrl } = useWallet();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [showKnsBadge, setShowKnsBadge] = useState(profile?.showKnsBadge || false);
  const [syncing, setSyncing] = useState(false);
  const username = profile?.username ? `@${profile.username}` : "@unknown";

  const { data: knsDomain } = useKnsDomain(identity?.id, showKnsBadge);

  const lastChange = profile?.lastAvatarChange ? new Date(profile.lastAvatarChange) : null;
  const now = new Date();
  const remainingMs = lastChange ? lastChange.getTime() + 14 * 24 * 60 * 60 * 1000 - now.getTime() : 0;
  const canChange = remainingMs <= 0;
  const daysLeft = Math.ceil(Math.max(remainingMs, 0) / (24 * 60 * 60 * 1000));

  // Sync state with profile
  React.useEffect(() => {
    setShowKnsBadge(profile?.showKnsBadge || false);
  }, [profile?.showKnsBadge]);


  const handlePick = () => fileInputRef.current?.click();
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (file.size > 5 * 1024 * 1024) {
      setError("Please upload an image under 5MB.");
      return;
    }
    // Open cropper
    const objectUrl = URL.createObjectURL(file);
    setCropSrc(objectUrl);
    setCropOpen(true);
    // reset input value so same file can be re-selected later
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCroppedUpload = async (blob: Blob) => {
    if (!identity || !sessionToken) return;
    try {
      setUploading(true);
      const key = `${identity?.id || "anon"}/${Date.now()}-avatar.png`;
      const { data, error } = await supabase.storage.from("avatars").upload(key, blob, {
        upsert: true,
        contentType: "image/png",
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(data?.path || key);
      if (pub?.publicUrl) saveAvatarUrl(pub.publicUrl);
      setCropOpen(false);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleKnsBadgeToggle = async (checked: boolean) => {
    if (!identity?.id || !sessionToken) return;
    
    setShowKnsBadge(checked);

    if (checked) {
      // Sync KNS domain when enabling
      setSyncing(true);
      try {
        const { data, error } = await supabase.functions.invoke('sync-kns-domain', {
          body: { sessionToken, walletAddress: identity.address }
        });

        if (error) throw error;

        if (!data?.knsDomain) {
          toast({
            title: "No KNS Domain Found",
            description: "Your wallet does not have a primary KNS domain.",
            variant: "destructive"
          });
          setShowKnsBadge(false);
          return;
        }

        toast({
          title: "KNS Domain Synced",
          description: `Connected ${data.knsDomain}`,
        });
      } catch (err: any) {
        console.error('Error syncing KNS domain:', err);
        toast({
          title: "Sync Failed",
          description: err.message || "Failed to sync KNS domain",
          variant: "destructive"
        });
        setShowKnsBadge(false);
        setSyncing(false);
        return;
      } finally {
        setSyncing(false);
      }
    }

    // Update profile setting
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ show_kns_badge: checked })
        .eq('id', identity.id);

      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating KNS badge setting:', err);
      toast({
        title: "Update Failed",
        description: "Failed to save KNS badge setting",
        variant: "destructive"
      });
      setShowKnsBadge(!checked);
    }
  };
  return (
    <>
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
                  <div className="text-xs text-muted-foreground">
                    {canChange ? "You can update your profile photo now" : `You can change your photo in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                    <Button variant="glass" size="sm" onClick={handlePick} disabled={uploading || !canChange}>
                      {uploading ? "Uploading..." : "Change photo"}
                    </Button>
                  </div>
                  {error && <div className="text-xs text-[hsl(var(--destructive))] mt-1">{error}</div>}
                </div>
              </div>

            {/* KNS Badge Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-3 flex-1">
                {/* KNS Logo */}
                <div 
                  className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, hsl(var(--brand-cyan)), hsl(var(--brand-iris)), hsl(var(--brand-pink)))',
                    padding: '2px'
                  }}
                >
                  <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
                    <img 
                      src={knsLogo} 
                      alt="KNS Logo" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                
                <div className="space-y-0.5 flex-1">
                  <Label htmlFor="kns-badge" className="text-sm font-medium">
                    <a 
                      href="https://app.knsdomains.org/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="hover:text-brand-pink transition-colors cursor-pointer"
                    >
                      Show KNS Badge
                    </a>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {knsDomain?.full_name 
                      ? `Display ${knsDomain.full_name} next to your name`
                      : "Display your KNS domain next to your name"}
                  </p>
                </div>
              </div>
              <Switch
                id="kns-badge"
                checked={showKnsBadge}
                onCheckedChange={handleKnsBadgeToggle}
                disabled={syncing}
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="hero" onClick={onEditUsername}>Edit username</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <AvatarCropper
        open={cropOpen}
        src={cropSrc}
        onOpenChange={(v) => {
          setCropOpen(v);
          if (!v && cropSrc) {
            URL.revokeObjectURL(cropSrc);
            setCropSrc(null);
          }
        }}
        onConfirm={handleCroppedUpload}
      />
    </>
  );
};

export default MyProfileModal;
