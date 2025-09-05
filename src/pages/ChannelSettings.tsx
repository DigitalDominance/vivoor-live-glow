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
import { useSecureWallet } from "@/context/SecureWalletContext";
import { useAuth } from "@/context/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Upload, Save, ArrowLeft } from "lucide-react";
import AvatarCropper from "@/components/modals/AvatarCropper";
import { validateBio } from "@/lib/badWords";

const ChannelSettings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { identity, profile: walletProfile, updateBio, updateBanner, authenticated } = useSecureWallet();
  const queryClient = useQueryClient();
  
  const [bio, setBio] = React.useState('');
  
  // Banner states
  const [bannerFile, setBannerFile] = React.useState<File | null>(null);
  const [bannerSrc, setBannerSrc] = React.useState<string | null>(null);
  const [showBannerCropper, setShowBannerCropper] = React.useState(false);

  // Authentication check - redirect if not logged in
  React.useEffect(() => {
    if (!authenticated || !user) {
      navigate('/auth');
      toast({ 
        title: "Authentication required", 
        description: "Please sign in to access channel settings",
        variant: "destructive" 
      });
    }
  }, [authenticated, user, navigate]);

  // Authentication check - redirect if wallet not connected
  React.useEffect(() => {
    if (authenticated && user && !identity) {
      navigate('/');
      toast({ 
        title: "Wallet required", 
        description: "Please connect your wallet to access channel settings",
        variant: "destructive" 
      });
    }
  }, [authenticated, user, identity, navigate]);

  // Fetch current profile data
  const { data: profile } = useQuery({
    queryKey: ['profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', identity.id)
        .maybeSingle();
      
      if (data) {
        setBio(data.bio || '');
      }
      
      return data;
    },
    enabled: !!identity?.id && !!authenticated
  });

  // Initialize bio from wallet profile if available
  React.useEffect(() => {
    if (walletProfile?.bio) {
      setBio(walletProfile.bio);
    }
  }, [walletProfile?.bio]);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!authenticated || !identity) {
      toast({ title: "Authentication required", variant: "destructive" });
      return;
    }
    
    // Validate bio
    const bioValidation = validateBio(bio);
    if (!bioValidation.isValid) {
      toast({ title: "Invalid bio", description: bioValidation.error, variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      await updateBio(bio);
      
      // Invalidate profile queries
      queryClient.invalidateQueries({ queryKey: ['profile', identity.id] });
    } catch (error) {
      console.error('Failed to update bio:', error);
      toast({ 
        title: "Failed to update bio", 
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
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

      // Use the secure banner update function
      await updateBanner(publicUrl);

      // Invalidate ALL profile-related queries to ensure banner shows up everywhere
      queryClient.invalidateQueries({ queryKey: ['profile', identity.id] });
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          // Invalidate any query that might contain profile data
          return query.queryKey[0] === 'profile-by-username' || 
                 query.queryKey[0] === 'profile' ||
                 (query.queryKey[0] === 'user-content' && query.queryKey[1] === identity.id);
        }
      });
      
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
                disabled={isSubmitting}
              >
                <Save className="size-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
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