import React from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Save } from "lucide-react";
import { motion } from "framer-motion";

const ChannelEdit: React.FC = () => {
  const navigate = useNavigate();
  const { identity } = useWallet();
  const [bio, setBio] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Fetch current profile data
  const { data: profile, refetch } = useQuery({
    queryKey: ['my-profile', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_profile_with_stats', { _user_id: identity.id });
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!identity?.id
  });

  // Initialize form with profile data
  React.useEffect(() => {
    if (profile) {
      setBio(profile.bio || "");
    }
  }, [profile]);

  // Redirect if not logged in
  React.useEffect(() => {
    if (!identity) {
      navigate('/app');
      toast({ title: "Connect your wallet to edit your channel", variant: "destructive" });
    }
  }, [identity, navigate]);

  const handleSave = async () => {
    if (!identity?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          bio: bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', identity.id);

      if (error) {
        throw error;
      }

      toast({ title: "Channel updated successfully!" });
      await refetch();
      navigate(`/channel/${identity.id}`);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ 
        title: "Failed to update channel", 
        description: "Please try again later.",
        variant: "destructive" 
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !identity?.id) return;

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${identity.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Use the database function that enforces cooldown
      const { error: updateError } = await supabase.rpc('update_avatar', {
        user_id_param: identity.id,
        new_avatar_url: publicUrl
      });

      if (updateError) throw updateError;

      toast({ title: "Avatar updated successfully!" });
      await refetch();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      
      let errorMessage = "Please try again.";
      if (error instanceof Error) {
        // Format the cooldown message nicely
        if (error.message.includes("Next change available at:")) {
          const dateMatch = error.message.match(/Next change available at: (.+)$/);
          if (dateMatch) {
            const nextChangeDate = new Date(dateMatch[1]);
            const formattedDate = nextChangeDate.toLocaleDateString() + " at " + nextChangeDate.toLocaleTimeString();
            errorMessage = `Avatar can only be changed once every 24 hours. You can change it again on ${formattedDate}.`;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({ 
        title: "Failed to upload avatar", 
        description: errorMessage,
        variant: "destructive" 
      });
    }
  };

  if (!identity) {
    return null;
  }

  return (
    <main className="container mx-auto px-4 py-8 max-w-2xl">
      <Helmet>
        <title>Edit Channel - Vivoor</title>
        <meta name="description" content="Customize your Vivoor channel profile" />
        <link rel="canonical" href="/channel/edit" />
      </Helmet>

      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-bold">Edit Channel</h1>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Channel Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="flex items-center gap-6">
              <Avatar className="size-20">
                <AvatarImage src={profile?.avatar_url} alt="Channel avatar" />
                <AvatarFallback className="text-lg">
                  {(profile?.display_name || profile?.handle || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <Label htmlFor="avatar-upload" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="size-4 mr-2" />
                      Change Avatar
                    </span>
                  </Button>
                </Label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell viewers about yourself..."
                  className="mt-1 min-h-[100px]"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {bio.length}/500 characters
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="size-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
};

export default ChannelEdit;