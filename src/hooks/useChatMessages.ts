import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export type ChatMessage = {
  id: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
  text: string;
  time: string;
  timestamp?: number;
};

export function useChatMessages(streamId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Fetch initial messages
  const { data: initialMessages } = useQuery({
    queryKey: ['chat-messages', streamId],
    queryFn: async () => {
      if (!streamId) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          message,
          created_at,
          user_id,
          profiles:user_id (
            id,
            handle,
            display_name,
            avatar_url
          )
        `)
        .eq('stream_id', streamId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) {
        console.error('[ChatMessages] Error fetching messages:', error);
        return [];
      }

      return (data || []).map((msg: any) => ({
        id: msg.id,
        user: {
          id: msg.user_id,
          name: msg.profiles?.display_name || msg.profiles?.handle || 'Anonymous',
          avatar: msg.profiles?.avatar_url
        },
        text: msg.message,
        time: new Date(msg.created_at).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        timestamp: new Date(msg.created_at).getTime()
      }));
    },
    enabled: !!streamId,
    refetchInterval: 5000 // Poll every 5 seconds for new messages
  });

  // Update messages when initial data changes
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!streamId) return;

    console.log('[ChatMessages] Setting up realtime subscription for stream:', streamId);

    const channel = supabase
      .channel(`chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `stream_id=eq.${streamId}`
        },
        async (payload) => {
          console.log('[ChatMessages] New message received:', payload);
          
          // Fetch the complete message with profile data
          const { data: newMsg, error } = await supabase
            .from('chat_messages')
            .select(`
              id,
              message,
              created_at,
              user_id,
              profiles:user_id (
                id,
                handle,
                display_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (error || !newMsg) {
            console.error('[ChatMessages] Error fetching new message:', error);
            return;
          }

          const formattedMessage: ChatMessage = {
            id: newMsg.id,
            user: {
              id: newMsg.user_id,
              name: (newMsg as any).profiles?.display_name || (newMsg as any).profiles?.handle || 'Anonymous',
              avatar: (newMsg as any).profiles?.avatar_url
            },
            text: newMsg.message,
            time: new Date(newMsg.created_at).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            }),
            timestamp: new Date(newMsg.created_at).getTime()
          };

          setMessages((prev) => [...prev, formattedMessage]);
        }
      )
      .subscribe();

    return () => {
      console.log('[ChatMessages] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [streamId]);

  return { messages };
}