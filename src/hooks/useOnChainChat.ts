import { useState, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { createChatMessagePayload } from "@/lib/crypto";
import { toast } from "sonner";

export function useOnChainChat(streamId: string) {
  const { identity, sessionToken, profile } = useWallet();
  const [isSending, setIsSending] = useState(false);

  const sendMessage = useCallback(async (
    messageText: string, 
    onTxCreated?: (txid: string) => void
  ) => {
    if (!identity?.address || !sessionToken || !streamId) {
      toast.error("Please connect your wallet to send messages");
      return false;
    }

    if (!window.kasware) {
      toast.error("Kasware wallet not found");
      return false;
    }

    if (!messageText.trim()) {
      return false;
    }

    setIsSending(true);

    try {
      // Strip emojis for on-chain payload (to reduce size/cost)
      const stripEmojis = (str: string) => {
        return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}]/gu, '').trim();
      };
      
      const onChainMessage = stripEmojis(messageText.trim());
      const displayMessage = messageText.trim();
      
      // Create plain text payload (NO ENCRYPTION): ciph_msg:1:bcast:{streamID}:{message}
      // Use stripped message for on-chain to reduce transaction size
      const payload = createChatMessagePayload(
        streamId,
        onChainMessage
      );

      console.log('[OnChainChat] Sending transaction with payload:', {
        to: identity.address,
        amount: '1.2 KAS',
        streamId,
        onChainMessage,
        displayMessage,
        payload: payload,
        payloadLength: payload.length
      });

      // Send 1.2 KAS to sender's own address with plain text payload
      const txResponse = await window.kasware.sendKaspa(
        identity.address, // Send to self
        120000000, // 1.2 KAS in sompi
        { payload: payload }
      );

      console.log('[OnChainChat] Raw txResponse:', txResponse);

      // Extract txid from response (kasware can return string, object, or stringified JSON)
      let txid: string;
      if (typeof txResponse === 'string') {
        // Try to parse if it's a JSON string
        try {
          const parsed = JSON.parse(txResponse);
          txid = parsed.id || txResponse;
        } catch {
          // Not JSON, use as-is
          txid = txResponse;
        }
      } else if (txResponse && typeof txResponse === 'object' && 'id' in txResponse) {
        txid = (txResponse as any).id;
      } else {
        throw new Error('Invalid transaction response from wallet');
      }
      
      console.log('[OnChainChat] Extracted txid:', txid);

      // Call the callback right after getting txid
      onTxCreated?.(txid);

      // Verify and save message via Supabase edge function
      // Pass displayMessage to store the version with emojis
      const { data, error } = await supabase.functions.invoke('verify-chat-message', {
        body: {
          txid,
          streamId,
          senderAddress: identity.address,
          sessionToken,
          walletAddress: identity.address,
          displayMessage // Include emoji version for storage
        }
      });

      if (error) {
        console.error('[OnChainChat] Verification error:', error);
        toast.error("Failed to verify message");
        return false;
      }

      if (!data?.success) {
        toast.error(data?.error || "Failed to send message");
        return false;
      }

      console.log('[OnChainChat] Message verified and saved');
      toast.success("Message sent on-chain!");
      return true;

    } catch (error: any) {
      console.error('[OnChainChat] Error sending message:', error);
      
      if (error.message?.includes('User rejected')) {
        toast.error("Transaction cancelled");
      } else {
        toast.error("Failed to send message: " + error.message);
      }
      return false;
    } finally {
      setIsSending(false);
    }
  }, [identity, sessionToken, streamId, profile]);

  return {
    sendMessage,
    isSending
  };
}