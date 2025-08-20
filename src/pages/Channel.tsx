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
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { identity } = useWallet();

  // Fetch profile data by username (handle)
  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile-by-username', username],
    queryFn: async () => {
      if (!username) return null;
      
      // First get the basic profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('handle', username)
        .maybeSingle();
      
      if (!profileData) return null;
      
      // Then get follower counts separately
      const [followerResult, followingResult] = await Promise.all([
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('following_id', profileData.id),
        supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('follower_id', profileData.id)
      ]);
      
      return {
        ...profileData,
        follower_count: followerResult.count || 0,
        following_count: followingResult.count || 0
      };
    },
    enabled: !!username
  });

  const isOwnChannel = identity?.id === profile?.id;

  // Check if following
  const [following, setFollowing] = React.useState(false);
  React.useEffect(() => {
    const checkFollowing = async () => {
      if (!profile?.id || !identity?.id || identity.id === profile.id) {
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
  }, [profile?.id, identity?.id]);

  const handleFollow = async () => {
    if (!identity?.id || !profile?.id) {
      toast({ title: "Please connect your wallet first" });
      return;
    }

    try {
      if (following) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', identity.id)
          .eq('following_id', profile.id);
        setFollowing(false);
        toast({ title: "Unfollowed" });
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: identity.id,
            following_id: profile.id
          });
        setFollowing(true);
        toast({ title: "Following!" });
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({ title: "Failed to update follow status", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Loading channel...</div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-lg font-medium">Channel not found</div>
          <p className="text-muted-foreground mt-2">
            The channel "@{username}" doesn't exist or may have been removed.
          </p>
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
        <div className="h-32 md:h-48 relative">
          {profile?.banner_url ? (
            <img 
              src={profile.banner_url} 
              alt="Channel banner" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-grad-primary" />
          )}
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
                    {profile.bio ? (
                      <p className="text-muted-foreground">{profile.bio}</p>
                    ) : (
                      <p className="text-muted-foreground">@{profile.handle}</p>
                    )}
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
                
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* User's Streams */}
      <ChannelStreams userId={profile.id} isOwnChannel={isOwnChannel} profile={profile} />
    </div>
  );
};

// Component to fetch and display user's streams
const ChannelStreams: React.FC<{ userId: string; isOwnChannel: boolean; profile: any }> = ({ userId, isOwnChannel, profile }) => {
  const navigate = useNavigate();
  
  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['user-streams', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id,
          title,
          category,
          is_live,
          viewers,
          thumbnail_url,
          created_at,
          playback_url
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error('Error fetching streams:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!userId
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 animate-pulse">
              <div className="aspect-video bg-muted rounded-lg mb-3" />
              <div className="h-4 bg-muted rounded mb-2" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (streams.length === 0) {
    return (
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
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold mb-6">
        {isOwnChannel ? 'Your Streams' : 'Recent Streams'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {streams.map((stream: any) => (
          <StreamCard
            key={stream.id}
            stream={{
              id: stream.id,
              title: stream.title,
              category: stream.category || 'General',
              live: stream.is_live || false,
              viewers: stream.viewers || 0,
              username: profile?.handle || profile?.display_name || 'Unknown',
              userId: userId,
              thumbnail: stream.thumbnail_url,
              likeCount: 0,
              avatar: profile?.avatar_url
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Channel;