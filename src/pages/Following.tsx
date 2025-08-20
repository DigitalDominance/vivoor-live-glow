import React from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";

const Following: React.FC = () => {
  const { identity } = useWallet();
  const navigate = useNavigate();

  const { data: following = [], isLoading } = useQuery({
    queryKey: ['following', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return [];
      
      const { data, error } = await supabase
        .from('follows')
        .select(`
          following_id,
          profiles:following_id (
            id,
            handle,
            display_name,
            avatar_url,
            bio
          )
        `)
        .eq('follower_id', identity.id);
      
      if (error) {
        console.error('Error fetching following:', error);
        return [];
      }
      
      return data.map((follow: any) => follow.profiles).filter(Boolean);
    },
    enabled: !!identity?.id
  });

  const handleUnfollow = async (userId: string) => {
    if (!identity?.id) return;
    
    try {
      await supabase
        .from('follows')
        .delete()
        .match({ follower_id: identity.id, following_id: userId });
      
      // Refetch the following list to update UI
      window.location.reload();
    } catch (error) {
      console.error('Error unfollowing:', error);
    }
  };

  if (!identity) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Login Required</h1>
          <p className="text-muted-foreground">Please login to see who you're following.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <Helmet>
        <title>My Following — Vivoor</title>
        <meta name="description" content="View and manage the people you're following on Vivoor." />
      </Helmet>

      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Users className="size-6" />
          <h1 className="text-2xl font-bold">My Following</h1>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 glass rounded-xl">
                <div className="size-12 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                </div>
                <div className="w-20 h-8 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : following.length === 0 ? (
          <div className="text-center py-12">
            <Users className="size-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-medium mb-2">No Following Yet</h2>
            <p className="text-muted-foreground mb-4">
              Start following creators to see them here
            </p>
            <Button onClick={() => navigate('/app')}>
              Discover Creators
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {following.map((profile: any) => (
              <div key={profile.id} className="flex items-center gap-4 p-4 glass rounded-xl">
                <Avatar className="size-12">
                  <AvatarImage src={profile.avatar_url} alt={`@${profile.handle} avatar`} />
                  <AvatarFallback>{profile.handle?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {profile.display_name || profile.handle || 'Unknown User'}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    @{profile.handle || 'unknown'}
                  </div>
                  {profile.bio && (
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {profile.bio}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/profile/${profile.id}`)}
                  >
                    View Profile
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUnfollow(profile.id)}
                  >
                    Unfollow
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default Following;