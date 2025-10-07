import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProcessedTip {
  id: string;
  amount: number; // in KAS
  sender: string;
  message?: string;
  timestamp: number;
  txid: string;
}

interface UseRealtimeTipsProps {
  streamId?: string;
  onNewTip?: (tip: ProcessedTip) => void;
}

export function useRealtimeTips({ streamId, onNewTip }: UseRealtimeTipsProps) {
  const [tips, setTips] = useState<ProcessedTip[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [processedTipIds, setProcessedTipIds] = useState<Set<string>>(new Set());

  // Load existing tips
  useEffect(() => {
    if (!streamId) return;

    const loadExistingTips = async () => {
      try {
        const { data: existingTips, error } = await supabase
          .from('tips')
          .select('*')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error loading tips:', error);
          return;
        }

        if (existingTips) {
          const processedTips: ProcessedTip[] = existingTips.map(tip => {
            return {
              id: tip.id,
              amount: Math.round(tip.amount_sompi / 100000000), // Convert sompi to KAS
              sender: tip.sender_name || 'Anonymous',
              message: tip.tip_message || tip.decrypted_message,
              timestamp: new Date(tip.created_at).getTime(),
              txid: tip.txid
            };
          });

          setTips(processedTips);
          setProcessedTipIds(new Set(processedTips.map(tip => tip.id)));
          console.log('Loaded existing tips:', processedTips.length);
        }
      } catch (error) {
        console.error('Failed to load existing tips:', error);
      }
    };

    loadExistingTips();
  }, [streamId]);

  // Set up real-time subscription
  useEffect(() => {
    if (!streamId) return;

    console.log('[useRealtimeTips] Setting up realtime subscription for stream:', streamId);

    const channel = supabase
      .channel(`tips:stream_id=eq.${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tips',
          filter: `stream_id=eq.${streamId}`
        },
        (payload) => {
          console.log('[useRealtimeTips] Received new tip:', payload);
          const newTipData = payload.new;
          
          if (processedTipIds.has(newTipData.id)) {
            console.log('[useRealtimeTips] Tip already processed, skipping:', newTipData.id);
            return;
          }

          const processedTip: ProcessedTip = {
            id: newTipData.id,
            amount: Math.round(newTipData.amount_sompi / 100000000), // Convert sompi to KAS
            sender: newTipData.sender_name || 'Anonymous',
            message: newTipData.tip_message || newTipData.decrypted_message,
            timestamp: new Date(newTipData.created_at).getTime(),
            txid: newTipData.txid
          };

          console.log('[useRealtimeTips] Processing new tip:', processedTip);

          // Add to tips list
          setTips(prev => {
            const updated = [processedTip, ...prev].slice(0, 50);
            console.log('[useRealtimeTips] Updated tips list, total tips:', updated.length);
            return updated;
          });
          setProcessedTipIds(prev => new Set([...prev, processedTip.id]));

          // Show toast notification
          toast.success(`💰 New tip: ${processedTip.amount} KAS from ${processedTip.sender}!`);

          // Call callback
          onNewTip?.(processedTip);
        }
      )
      .subscribe((status) => {
        console.log('[useRealtimeTips] Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      console.log('[useRealtimeTips] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [streamId, onNewTip, processedTipIds]);

  return {
    tips,
    isConnected,
    totalTipsReceived: tips.length,
    totalAmountReceived: tips.reduce((sum, tip) => sum + tip.amount, 0)
  };
}