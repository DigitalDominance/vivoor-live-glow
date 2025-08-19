import React from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Upload, Save, ArrowLeft } from "lucide-react";
import AvatarCropper from "@/components/modals/AvatarCropper";
import VerificationSection from "@/components/VerificationSection";
import { validateUsername, validateBio } from "@/lib/badWords";

const ChannelSettings: React.FC = () => {
  const navigate = useNavigate();
  const { identity } = useWallet();
  const queryClient = useQueryClient();
  
  const [displayName, setDisplayName] = React.useState('');
  const [bio, setBio] = React.useState('');
  const [handle, setHandle] = React.useState('');
  
  // Banner states
  const [bannerFile, setBannerFile] = React.useState<File | null>(null);
  const [bannerSrc, setBannerSrc] = React.useState<string | null>(null);
  const [showBannerCropper, setShowBannerCropper] = React.useState(false);

  // Redirect if not logged in
  React.useEffect(() => {
    if (!identity?.id) {
      navigate('/');
    }
  }, [identity, navigate]);

  // Fetch current profile data
  const { data: profile } = useQuery({
    queryKey: ['profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', identity.id)
        .single();
      
      if (data) {
        setDisplayName(data.display_name || '');
        setBio(data.bio || '');
        setHandle(data.handle || '');
      }
      
      return data;
    },
    enabled: !!identity?.id
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { display_name?: string; bio?: string; handle?: string }) => {
      if (!identity?.id) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', identity.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', identity?.id] });
      toast({ title: "Profile updated successfully!" });
    },
    onError: (error) => {
      console.error('Error updating profile:', error);
      toast({ title: "Failed to update profile", variant: "destructive" });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate username
    const usernameValidation = validateUsername(handle);
    if (!usernameValidation.isValid) {
      toast({ title: "Invalid username", description: usernameValidation.error, variant: "destructive" });
      return;
    }
    
    // Validate bio
    const bioValidation = validateBio(bio);
    if (!bioValidation.isValid) {
      toast({ title: "Invalid bio", description: bioValidation.error, variant: "destructive" });
      return;
    }
    
    updateProfileMutation.mutate({
      display_name: displayName,
      bio: bio,
      handle: handle
    });
  };


  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 5MB", variant: "destructive" });
      return;
    }

    setBannerFile(file);
    // Create URL for the file to pass to cropper
    const fileUrl = URL.createObjectURL(file);
    setBannerSrc(fileUrl);
    setShowBannerCropper(true);
  };

  const handleBannerCroppedUpload = async (croppedBlob: Blob) => {
    if (!identity?.id) return;

    try {
      const fileName = `${identity.id}/banner-${Date.now()}.jpg`;
      
      const { error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: publicUrl })
        .eq('id', identity.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ['profile', identity.id] });
      toast({ title: "Banner updated successfully!" });
      setShowBannerCropper(false);
      setBannerFile(null);
      setBannerSrc(null);
      
      // Clean up the blob URL
      if (bannerSrc) {
        URL.revokeObjectURL(bannerSrc);
      }
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({ title: "Failed to upload banner", variant: "destructive" });
    }
  };

  if (!identity?.id) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Helmet>
        <title>Channel Settings | Vivoor</title>
        <meta name="description" content="Customize your channel settings, profile, and appearance on Vivoor." />
      </Helmet>

      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate(`/channel/${profile?.handle || identity.id}`)}
          className="mb-4"
        >
          <ArrowLeft className="size-4 mr-2" />
          Back to Channel
        </Button>
        <h1 className="text-2xl font-bold">Channel Settings</h1>
        <p className="text-muted-foreground">Customize your profile and channel appearance</p>
      </div>

      <div className="space-y-6">
        {/* Channel Banner */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Banner</CardTitle>
            <CardDescription>Upload a banner image for your channel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="aspect-[3/1] w-full max-w-sm bg-grad-primary rounded-lg overflow-hidden">
                {profile?.banner_url ? (
                  <img 
                    src={profile.banner_url} 
                    alt="Channel banner" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-grad-primary flex items-center justify-center text-white">
                    <span className="text-sm">No banner set</span>
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="banner-upload" className="cursor-pointer">
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="size-4 mr-2" />
                      Upload banner
                    </span>
                  </Button>
                </Label>
                <input
                  id="banner-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleBannerChange}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Recommended: 1200x400px, under 5MB
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>Update your public profile details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="handle">Username</Label>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="your-username"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Your unique username for your channel URL
                </p>
              </div>

              <div>
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Display Name"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell your audience about yourself..."
                  className="mt-1 min-h-[80px]"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {bio.length}/200 characters
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={updateProfileMutation.isPending}
              >
                <Save className="size-4 mr-2" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Verification Section */}
        <VerificationSection />
      </div>

      {/* Banner Cropper Modal */}
      <AvatarCropper
        open={showBannerCropper}
        onOpenChange={setShowBannerCropper}
        src={bannerSrc}
        onConfirm={handleBannerCroppedUpload}
        aspect={3} // 3:1 aspect ratio for banners
      />
    </div>
  );
};

export default ChannelSettings;