import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StreamCard } from "@/components/streams/StreamCard";
import { getCategoryThumbnail } from "@/utils/categoryThumbnails";
import { Users, Calendar, Video } from "lucide-react";

const Profile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { identity } = useWallet();
  const [following, setFollowing] = React.useState(false);

  // Fetch profile data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile', id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data } = await supabase.rpc('get_profile_with_stats', { _user_id: id });
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!id
  });

  // Fetch user's streams and VODs
  const { data: content = [] } = useQuery({
    queryKey: ['user-content', id],
    queryFn: async () => {
      if (!id) return [];
      
      // Get streams
      const { data: streams } = await supabase
        .from('streams')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      
      // Get VODs
      const { data: vods } = await supabase
        .from('vods')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false });
      
      const allContent = [
        ...(streams || []).map(stream => ({ ...stream, type: 'stream' })),
        ...(vods || []).map(vod => ({ ...vod, type: 'vod' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return allContent;
    },
    enabled: !!id
  });

  // Check if following this user
  React.useEffect(() => {
    if (!identity?.id || !id || identity.id === id) return;
    
    const checkFollowing = async () => {
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', identity.id)
        .eq('following_id', id)
        .maybeSingle();
      
      setFollowing(!!data);
    };
    
    checkFollowing();
  }, [identity?.id, id]);

  const handleFollow = async () => {
    if (!identity?.id || !id) return;
    
    try {
      if (following) {
        await supabase
          .from('follows')
          .delete()
          .match({ follower_id: identity.id, following_id: id });
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: identity.id, following_id: id });
      }
      setFollowing(!following);
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  if (profileLoading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-6 mb-8">
            <div className="size-24 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="h-8 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Profile Not Found</h1>
          <p className="text-muted-foreground mb-4">This user profile doesn't exist.</p>
          <Button onClick={() => navigate('/app')}>Back to App</Button>
        </div>
      </main>
    );
  }

  const isOwnProfile = identity?.id === id;
  const liveStreams = content.filter(item => item.type === 'stream' && (item as any).playback_url);
  const recordings = content.filter(item => item.type === 'vod');

  return (
    <main className="container mx-auto px-4 py-8">
      <Helmet>
        <title>{profile.display_name || profile.handle} — Vivoor</title>
        <meta name="description" content={profile.bio || `Check out ${profile.display_name || profile.handle}'s profile on Vivoor`} />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="flex items-start gap-6 mb-8">
          <Avatar className="size-24">
            <AvatarImage src={profile.avatar_url} alt={`@${profile.handle} avatar`} />
            <AvatarFallback className="text-2xl">
              {profile.handle?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-2">
              <h1 className="text-2xl font-bold">
                {profile.display_name || profile.handle || 'Unknown User'}
              </h1>
              {!isOwnProfile && identity && (
                <Button
                  variant={following ? "secondary" : "hero"}
                  onClick={handleFollow}
                >
                  {following ? 'Following' : 'Follow'}
                </Button>
              )}
            </div>
            
            <div className="text-muted-foreground mb-2">
              @{profile.handle || 'unknown'}
            </div>
            
            {profile.bio && (
              <p className="text-sm mb-4">{profile.bio}</p>
            )}
            
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-1">
                <Users className="size-4" />
                <span className="font-medium">{profile.follower_count || 0}</span>
                <span className="text-muted-foreground">followers</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium">{profile.following_count || 0}</span>
                <span className="text-muted-foreground">following</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="size-4" />
                <span className="text-muted-foreground">
                  Joined {new Date(profile.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <div className="space-y-6">
          {/* Live Streams */}
          {liveStreams.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="size-2 rounded-full bg-red-500"></div>
                <h2 className="text-lg font-semibold">Live Now</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {liveStreams.map((stream) => (
                  <StreamCard
                    key={stream.id}
                    stream={{
                      id: stream.id,
                      title: stream.title,
                      category: stream.category || 'IRL',
                      live: true,
                      viewers: (stream as any).viewers || 0,
                      username: profile.handle || 'unknown',
                      userId: stream.user_id,
                      thumbnail: stream.thumbnail_url || getCategoryThumbnail(stream.category || 'IRL'),
                      likeCount: 0,
                      avatar: profile.avatar_url
                    }}
                    isLoggedIn={!!identity}
                    onOpenProfile={() => {}}
                    onRequireLogin={() => {}}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Recordings */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Video className="size-5" />
              <h2 className="text-lg font-semibold">Recordings</h2>
            </div>
            {recordings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="size-12 mx-auto mb-4 opacity-50" />
                <p>No recordings yet</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recordings.map((vod) => (
                  <div
                    key={vod.id}
                    className="group glass rounded-xl overflow-hidden border border-border hover:shadow-lg transition-colors cursor-pointer"
                    onClick={() => navigate(`/vod/${vod.id}`)}
                  >
                    <div className="relative aspect-video bg-muted/40">
                      {vod.thumbnail_url ? (
                        <img
                          src={vod.thumbnail_url}
                          alt={vod.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[length:200%_100%] animate-shimmer bg-gradient-to-r from-foreground/10 via-transparent to-foreground/10" />
                      )}
                      <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-background/80 text-xs">
                        {(vod as any).duration_seconds ? `${Math.floor((vod as any).duration_seconds / 60)}:${((vod as any).duration_seconds % 60).toString().padStart(2, '0')}` : 'VOD'}
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-sm font-medium truncate">{vod.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {vod.category || 'IRL'} • {new Date(vod.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
};

export default Profile;