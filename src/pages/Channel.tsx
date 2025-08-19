import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StreamCard } from "@/components/streams/StreamCard";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { useQuery } from "@tanstack/react-query";
import { Settings, Users, Video, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";

const Channel: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { identity } = useWallet();
  const [following, setFollowing] = React.useState(false);
  const isOwnChannel = identity?.id === userId;

  // Fetch channel profile data
  const { data: profile } = useQuery({
    queryKey: ['channel-profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase.rpc('get_profile_with_stats', { _user_id: userId });
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!userId
  });

  // Fetch channel streams
  const { data: streams = [] } = useQuery({
    queryKey: ['channel-streams', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('streams')
        .select(`
          id, title, category, is_live, viewers, thumbnail_url, created_at, playback_url,
          profiles!inner(handle, display_name, avatar_url)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching channel streams:', error);
        return [];
      }

      return (data || []).map((stream: any) => ({
        id: stream.id,
        title: stream.title,
        category: stream.category || 'IRL',
        live: !!stream.playback_url,
        viewers: stream.viewers || 0,
        username: stream.profiles?.handle || stream.profiles?.display_name || 'user',
        userId: userId,
        thumbnail: stream.thumbnail_url,
        startedAt: stream.created_at,
        likeCount: 0, // TODO: Add like count
        avatar: stream.profiles?.avatar_url
      }));
    },
    enabled: !!userId
  });

  // Check if following
  React.useEffect(() => {
    const checkFollowing = async () => {
      if (!identity?.id || !userId || isOwnChannel) return;
      
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', identity.id)
        .eq('following_id', userId)
        .single();
      
      setFollowing(!!data);
    };
    
    checkFollowing();
  }, [identity?.id, userId, isOwnChannel]);

  const handleFollow = async () => {
    if (!identity?.id) {
      toast({ title: "Connect your wallet to follow creators" });
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

  if (!userId || !profile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-4">Channel not found</h1>
          <Button onClick={() => navigate('/app')}>Back to Directory</Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen">
      <Helmet>
        <title>{profile.display_name || profile.handle} - Vivoor Channel</title>
        <meta name="description" content={`Watch ${profile.display_name || profile.handle}'s live streams and videos on Vivoor`} />
        <link rel="canonical" href={`/channel/${userId}`} />
      </Helmet>

      {/* Channel Header */}
      <section className="relative">
        {/* Banner */}
        <div className="h-32 md:h-48 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 relative">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_25%,rgba(255,255,255,0.05)_50%,transparent_50%,transparent_75%,rgba(255,255,255,0.05)_75%)] bg-[length:20px_20px] opacity-30" />
          {isOwnChannel && (
            <Button
              variant="glass"
              size="sm"
              className="absolute top-4 right-4"
              onClick={() => navigate('/channel/edit')}
            >
              <Settings className="size-4 mr-2" />
              Edit Channel
            </Button>
          )}
        </div>

        {/* Profile Info */}
        <div className="container mx-auto px-4 -mt-16 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
            <Avatar className="size-24 md:size-32 border-4 border-background shadow-lg">
              <AvatarImage src={profile.avatar_url} alt={`${profile.display_name || profile.handle} avatar`} />
              <AvatarFallback className="text-2xl">
                {(profile.display_name || profile.handle || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold">{profile.display_name || profile.handle}</h1>
              <p className="text-muted-foreground">@{profile.handle}</p>
              {profile.bio && (
                <p className="mt-2 text-sm max-w-2xl">{profile.bio}</p>
              )}
              
              <div className="flex items-center gap-6 mt-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="size-4" />
                  <span>{profile.follower_count?.toLocaleString() || 0} followers</span>
                </div>
                <div className="flex items-center gap-1">
                  <Video className="size-4" />
                  <span>{streams.length} streams</span>
                </div>
              </div>
              
              {!isOwnChannel && (
                <div className="mt-4">
                  <Button
                    variant={following ? "secondary" : "hero"}
                    onClick={handleFollow}
                    className="min-w-[100px]"
                  >
                    {following ? 'Following' : 'Follow'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Channel Content */}
      <section className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold">Recent Streams</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            <span>Latest first</span>
          </div>
        </div>

        {streams.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Video className="size-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No streams yet</h3>
            <p>This channel hasn't streamed anything yet.</p>
            {isOwnChannel && (
              <Button className="mt-4" onClick={() => navigate('/go-live')}>
                Start your first stream
              </Button>
            )}
          </div>
        ) : (
          <motion.div 
            className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {streams.map((stream, index) => (
              <motion.div
                key={stream.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <StreamCard 
                  stream={stream} 
                  isLoggedIn={!!identity}
                  onRequireLogin={() => toast({ title: "Connect your wallet to interact" })}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </section>
    </main>
  );
};

export default Channel;