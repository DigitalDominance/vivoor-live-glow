import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StreamCard } from "@/components/streams/StreamCard";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { useQuery } from "@tanstack/react-query";
import { Settings } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

const Channel: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { identity } = useWallet();
  const isOwnChannel = identity?.id === userId;

  // Fetch profile data
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.rpc('get_profile_with_stats', { _user_id: userId });
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!userId
  });

  // Check if following
  const [following, setFollowing] = React.useState(false);
  React.useEffect(() => {
    const checkFollowing = async () => {
      if (!userId || !identity?.id || identity.id === userId) {
        setFollowing(false);
        return;
      }
      
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', identity.id)
        .eq('following_id', userId)
        .single();
      
      setFollowing(!!data);
    };
    
    checkFollowing();
  }, [userId, identity?.id]);

  const handleFollow = async () => {
    if (!identity?.id || !userId) {
      toast({ title: "Please connect your wallet first" });
      return;
    }

    try {
      if (following) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', identity.id)
          .eq('following_id', userId);
        setFollowing(false);
        toast({ title: "Unfollowed" });
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: identity.id,
            following_id: userId
          });
        setFollowing(true);
        toast({ title: "Following!" });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: "Failed to update follow status", variant: "destructive" });
    }
  };

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Channel not found</div>
          <Button variant="outline" onClick={() => navigate(-1)} className="mt-4">
            Go back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Helmet>
        <title>{profile.display_name || profile.handle} - Channel | Vivoor</title>
        <meta name="description" content={`Watch ${profile.display_name || profile.handle}'s streams and content on Vivoor. ${profile.bio || ''}`} />
      </Helmet>

      {/* Channel Header */}
      <div className="relative">
        {/* Banner */}
        <div className="h-32 md:h-48 bg-grad-primary relative">
          <div className="absolute inset-0 bg-background/10" />
          {isOwnChannel && (
            <Button
              variant="glass"
              size="sm"
              className="absolute top-4 right-4"
              onClick={() => navigate('/channel/settings')}
            >
              <Settings className="size-4 mr-2" />
              Edit Channel
            </Button>
          )}
        </div>
        
        {/* Profile Section */}
        <div className="container mx-auto px-4">
          <div className="relative -mt-16 pb-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <Avatar className="size-24 md:size-32 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url || ''} alt={`${profile.display_name} avatar`} />
                <AvatarFallback className="text-2xl bg-grad-primary text-[hsl(var(--on-gradient))]">
                  {(profile.display_name || profile.handle || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold">{profile.display_name || profile.handle}</h1>
                    <p className="text-muted-foreground">@{profile.handle}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    {!isOwnChannel && identity?.id && (
                      <Button
                        variant={following ? "secondary" : "hero"}
                        onClick={handleFollow}
                      >
                        {following ? 'Following' : 'Follow'}
                      </Button>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-6 text-sm mb-4">
                  <div>
                    <span className="font-semibold">{profile.follower_count || 0}</span>
                    <span className="text-muted-foreground ml-1">followers</span>
                  </div>
                  <div>
                    <span className="font-semibold">{profile.following_count || 0}</span>
                    <span className="text-muted-foreground ml-1">following</span>
                  </div>
                </div>
                
                {profile.bio && (
                  <p className="text-muted-foreground max-w-2xl">{profile.bio}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content placeholder */}
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <div className="text-muted-foreground">
            {isOwnChannel ? "You haven't streamed yet." : "No streams yet."}
          </div>
          {isOwnChannel && (
            <Button 
              variant="hero" 
              className="mt-4"
              onClick={() => navigate('/go-live')}
            >
              Start Streaming
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Channel;