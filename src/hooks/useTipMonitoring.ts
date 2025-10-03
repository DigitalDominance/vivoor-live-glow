import { useEffect, useRef, useState } from 'react';
import { useKaspaTipScanner, TipEvent } from './useKaspaTipScanner';
import { decryptTipMessage } from '@/lib/crypto';
import { supabase } from '@/integrations/supabase/client';

export interface ProcessedTip {
  id: string;
  amount: number; // in KAS
  sender: string;
  message?: string;
  timestamp: number;
  txid: string;
}

interface UseTipMonitoringProps {
  streamId?: string;
  kaspaAddress?: string;
  streamStartBlockTime?: number;
  onNewTip?: (tip: ProcessedTip) => void;
}

export function useTipMonitoring({
  streamId,
  kaspaAddress,
  streamStartBlockTime,
  onNewTip
}: UseTipMonitoringProps) {
  const [tips, setTips] = useState<ProcessedTip[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const processedTxids = useRef(new Set<string>());

  // Process incoming tip events from Kaspa scanner
  const handleTipEvent = async (tipEvent: TipEvent) => {
    if (processedTxids.current.has(tipEvent.txid)) {
      return; // Already processed
    }

    try {
      const decrypted = await decryptTipMessage(tipEvent.message || '');
      
      if (!decrypted) {
        console.log('Failed to decrypt tip message:', tipEvent.message);
        return;
      }

      const processedTip: ProcessedTip = {
        id: tipEvent.txid,
        amount: Math.round(tipEvent.amountSompi / 100000000), // Convert sompi to KAS
        sender: decrypted.sender,
        message: decrypted.message,
        timestamp: decrypted.timestamp,
        txid: tipEvent.txid
      };

      // Store tip in database if we have stream context
      if (streamId && kaspaAddress) {
        try {
          await supabase.from('tips').insert({
            stream_id: streamId,
            sender_address: 'unknown', // We don't have sender address from tip event
            recipient_address: kaspaAddress,
            amount_sompi: tipEvent.amountSompi,
            txid: tipEvent.txid,
            encrypted_message: tipEvent.message,
            decrypted_message: JSON.stringify(decrypted),
            block_time: tipEvent.daa,
            processed_at: new Date().toISOString()
          });
          
          console.log('Tip stored in database:', processedTip);
        } catch (dbError) {
          console.error('Failed to store tip in database:', dbError);
        }
      }

      // Add to local state
      setTips(prev => [processedTip, ...prev].slice(0, 50)); // Keep last 50 tips
      processedTxids.current.add(tipEvent.txid);
      
      // Notify callback
      onNewTip?.(processedTip);
      
      console.log('New tip processed:', processedTip);
    } catch (error) {
      console.error('Error processing tip:', error);
    }
  };

  // Use Kaspa tip scanner
  useKaspaTipScanner({
    address: kaspaAddress,
    startDaa: streamStartBlockTime || 0,
    enabled: isMonitoring && !!kaspaAddress,
    onTip: handleTipEvent
  });

  // Start/stop monitoring
  useEffect(() => {
    if (kaspaAddress && typeof streamStartBlockTime === 'number') {
      setIsMonitoring(true);
      console.log('Started tip monitoring:', {
        address: kaspaAddress,
        startBlockTime: streamStartBlockTime,
        streamId
      });
    } else {
      setIsMonitoring(false);
      console.log('Not monitoring tips:', {
        hasAddress: !!kaspaAddress,
        hasBlockTime: typeof streamStartBlockTime === 'number',
        streamStartBlockTime,
        streamId
      });
    }

    return () => {
      setIsMonitoring(false);
    };
  }, [kaspaAddress, streamStartBlockTime, streamId]);

  // Load existing tips from database when stream changes
  useEffect(() => {
    if (!streamId) return;

    const loadExistingTips = async () => {
      try {
        const { data: existingTips } = await supabase
          .from('tips')
          .select('*')
          .eq('stream_id', streamId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (existingTips) {
          const processedTips: ProcessedTip[] = existingTips.map(tip => {
            let decrypted = null;
            try {
              decrypted = JSON.parse(tip.decrypted_message || '{}');
            } catch {
              // Ignore parse errors
            }

            return {
              id: tip.txid,
              amount: Math.round(tip.amount_sompi / 100000000),
              sender: decrypted?.sender || 'Anonymous',
              message: decrypted?.message,
              timestamp: decrypted?.timestamp || Date.now(),
              txid: tip.txid
            };
          });

          setTips(processedTips);
          processedTips.forEach(tip => processedTxids.current.add(tip.txid));
          console.log('Loaded existing tips:', processedTips.length);
        }
      } catch (error) {
        console.error('Failed to load existing tips:', error);
      }
    };

    loadExistingTips();
  }, [streamId]);

  return {
    tips,
    isMonitoring,
    totalTipsReceived: tips.length,
    totalAmountReceived: tips.reduce((sum, tip) => sum + tip.amount, 0)
  };
}