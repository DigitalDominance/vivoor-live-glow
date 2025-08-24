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
            let decrypted = null;
            try {
              if (tip.decrypted_message) {
                decrypted = typeof tip.decrypted_message === 'string' 
                  ? JSON.parse(tip.decrypted_message) 
                  : tip.decrypted_message;
              }
            } catch {
              // Ignore parse errors
            }

            return {
              id: tip.id,
              amount: Math.round(tip.amount_sompi / 100000000), // Convert sompi to KAS
              sender: decrypted?.sender || 'Anonymous',
              message: decrypted?.message,
              timestamp: decrypted?.timestamp || Date.now(),
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
          const newTipData = payload.new;
          if (processedTipIds.has(newTipData.id)) {
            return;
          }

          let decrypted = null;
          try {
            if (newTipData.decrypted_message) {
              decrypted = typeof newTipData.decrypted_message === 'string' 
                ? JSON.parse(newTipData.decrypted_message) 
                : newTipData.decrypted_message;
            }
          } catch (error) {
            console.error('Error parsing decrypted message:', error);
          }

          const processedTip: ProcessedTip = {
            id: newTipData.id,
            amount: Math.round(newTipData.amount_sompi / 100000000), // Convert sompi to KAS
            sender: decrypted?.sender || 'Anonymous',
            message: decrypted?.message,
            timestamp: decrypted?.timestamp || Date.now(),
            txid: newTipData.txid
          };

          // Add to tips list
          setTips(prev => [processedTip, ...prev].slice(0, 50)); // Keep last 50 tips
          setProcessedTipIds(prev => new Set([...prev, processedTip.id]));

          // Show toast notification
          toast.success(`💰 New tip: ${processedTip.amount} KAS from ${processedTip.sender}!`);

          // Call callback
          onNewTip?.(processedTip);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
      setIsConnected(false);
    };
  }, [streamId, onNewTip]);

  return {
    tips,
    isConnected,
    totalTipsReceived: tips.length,
    totalAmountReceived: tips.reduce((sum, tip) => sum + tip.amount, 0)
  };
}