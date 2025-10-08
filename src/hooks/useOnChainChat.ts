import { useState, useCallback } from "react";
import { useWallet } from "@/context/WalletContext";
import { supabase } from "@/integrations/supabase/client";
import { encryptChatMessage } from "@/lib/crypto";
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
      // Get username from profile
      const username = profile?.username || 'Anonymous';

      // Encrypt the message payload: {username}:{streamID}:{messageContent}:{timestamp}
      const encryptedPayload = await encryptChatMessage(
        username,
        streamId,
        messageText.trim()
      );

      console.log('[OnChainChat] Sending message transaction:', {
        to: identity.address,
        amount: '1.2 KAS',
        payloadLength: encryptedPayload.length
      });

      // Send 1.2 KAS to sender's own address with encrypted payload
      const txResponse = await window.kasware.sendKaspa(
        identity.address, // Send to self
        120000000, // 1.2 KAS in sompi
        { payload: encryptedPayload }
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
      const { data, error } = await supabase.functions.invoke('verify-chat-message', {
        body: {
          txid,
          streamId,
          senderAddress: identity.address,
          sessionToken,
          walletAddress: identity.address
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