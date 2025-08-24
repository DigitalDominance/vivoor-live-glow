import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import KaspaIcon from "@/components/KaspaIcon";
import { toast } from "sonner";
import { encryptTipMessage } from "@/lib/crypto";
import { containsBadWords, cleanText } from "@/lib/badWords";

interface TipModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  toAddress?: string | null;
  senderHandle?: string;
  streamId?: string;
  senderProfile?: {
    display_name?: string;
    handle?: string;
    avatar_url?: string;
  } | null;
}

const TipModal: React.FC<TipModalProps> = React.memo(({ open, onOpenChange, isLoggedIn, onRequireLogin, toAddress, senderHandle, streamId, senderProfile }) => {
  const [amount, setAmount] = React.useState<string>("1");
  const [message, setMessage] = React.useState<string>("");
  const [sending, setSending] = React.useState(false);

  const sendTip = async () => {
    if (!toAddress) {
      toast.error("Streamer not tip-enabled - No Kaspa address found.");
      return;
    }
    if (!streamId) {
      toast.error("Stream not found - Cannot process tip.");
      return;
    }

    // Validate tip message for bad words
    if (message && containsBadWords(message)) {
      toast.error("Tip message contains inappropriate language. Please revise your message.");
      return;
    }
    
    const kas = Math.max(1, Number(amount) || 1); // Minimum 1 KAS
    const sompi = kas * 100000000; // Convert KAS to sompi (1e8)
    
    try {
      setSending(true);
      
      if (!window.kasware?.sendKaspa) {
        throw new Error("Kasware wallet not available");
      }
      
      // Create encrypted payload for tips
      const encryptedPayload = await encryptTipMessage(
        message || "Thanks for the stream!", 
        kas, 
        senderHandle || "Anonymous"
      );
      
      // Send the transaction
      const txResponse = await window.kasware.sendKaspa(toAddress, sompi, {
        priorityFee: 10000,
        payload: encryptedPayload
      });
      
      // Extract transaction ID from response
      let txid: string;
      console.log('Kasware response:', txResponse);
      
      if (typeof txResponse === 'string') {
        // If it's a string, it might be JSON or just the txid
        try {
          const parsed = JSON.parse(txResponse);
          txid = parsed.id || parsed.transaction_id || parsed.txid;
        } catch {
          // If parsing fails, assume it's the txid directly
          txid = txResponse;
        }
      } else if (txResponse && typeof txResponse === 'object') {
        // If it's an object, extract the id
        txid = (txResponse as any).id || (txResponse as any).transaction_id || (txResponse as any).txid;
      } else {
        console.error('Unexpected transaction response format:', txResponse);
        throw new Error('Invalid transaction response format');
      }
      
      if (!txid || typeof txid !== 'string') {
        console.error('Could not extract transaction ID from response:', txResponse);
        throw new Error('Failed to extract transaction ID');
      }
      
      toast.success(`Tip sent! Transaction: ${txid.slice(0, 8)}...`);
      
      // Now verify the transaction with our backend (with progressive retry logic)
      const maxRetries = 5;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const retryDelay = attempt * 1000; // Progressive delay: 1s, 2s, 3s, 4s, 5s
        try {
          console.log(`Tip verification attempt ${attempt}/${maxRetries} for txid:`, txid);
          
          const response = await fetch(`https://qcowmxypihinteajhnjw.supabase.co/functions/v1/verify-tip-transaction`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjb3dteHlwaWhpbnRlYWpobmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwNDI4MTMsImV4cCI6MjA3MDYxODgxM30.KrSQYsOzPPhErffzdLzMS_4pC2reuONNc134tdtVPbA`
            },
            body: JSON.stringify({
              txid: txid, // Send only the transaction ID string
              streamId,
              expectedAmount: sompi,
              recipientAddress: toAddress,
              senderAddress: senderHandle || 'Anonymous',
              senderName: senderProfile?.display_name || senderProfile?.handle || senderHandle || 'Anonymous',
              senderAvatar: senderProfile?.avatar_url,
              tipMessage: cleanText(message || "Thanks for the stream!") // Clean the message before storing
            })
          });
          
          const result = await response.json();
          
          if (result.success) {
            toast.success(`Tip verified! ${kas} KAS sent successfully.`);
            break; // Success, exit retry loop
          } else {
            if (attempt === maxRetries) {
              toast.error(`Tip verification failed: ${result.error}`);
            } else {
              console.log(`Verification failed on attempt ${attempt}, retrying in ${attempt * 1000}ms...`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          }
        } catch (verificationError) {
          console.error(`Tip verification error on attempt ${attempt}:`, verificationError);
          if (attempt === maxRetries) {
            toast.warning('Tip sent but verification failed - it may take a moment to appear.');
          } else {
            console.log(`Verification error on attempt ${attempt}, retrying in ${attempt * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          }
        }
      }
      
      setMessage("");
      setAmount("1");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(`Failed to send tip: ${e?.message || "Try again."}`);
    } finally {
      setSending(false);
    }
  };

  const ModalContent = React.memo(() => (
    <div className="relative p-[2px] bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink border-0 max-w-md rounded-lg">
      <div className="bg-black/95 backdrop-blur-md rounded-lg p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <KaspaIcon size={20} /> Tip in KAS
          </DialogTitle>
        </DialogHeader>
        {isLoggedIn ? (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-white/70">Choose an amount and add a message. Your wallet will open to confirm.</p>
            <div className="flex gap-2 flex-wrap">
              {["1","5","10"].map(v => (
                <Button 
                  key={v} 
                  variant="outline" 
                  onClick={() => setAmount(v)} 
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20 transition-all duration-300 hover:scale-105"
                  aria-label={`Tip ${v} KAS`}
                >
                  {v} KAS
                </Button>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/90">Custom amount (minimum 1 KAS)</label>
              <input 
                value={amount} 
                onChange={(e)=>setAmount(e.target.value)} 
                type="number" 
                min="1" 
                step="1" 
                className="w-full rounded-md bg-white/10 backdrop-blur-sm px-3 py-2 text-sm border border-white/20 text-white placeholder-white/50 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all duration-300" 
                placeholder="Enter amount..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/90">Message (optional)</label>
              <Textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                placeholder="Say something nice to the streamer..."
                className="resize-none bg-white/10 backdrop-blur-sm border-white/20 text-white placeholder-white/50 focus:border-brand-cyan focus:ring-1 focus:ring-brand-cyan transition-all duration-300"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-white/50">{message.length}/200 characters</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                disabled={sending} 
                onClick={sendTip}
                className="bg-gradient-to-r from-brand-cyan to-brand-iris text-white border-0 hover:scale-105 transition-all duration-300 shadow-lg"
              >
                {sending ? "Sending..." : "Send Tip"}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-white/70">Login / connect wallet to tip in Kaspa.</p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={onRequireLogin}
                className="bg-gradient-to-r from-brand-cyan to-brand-iris text-white border-0 hover:scale-105 transition-all duration-300"
              >
                Login
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="text-white/70 hover:text-white hover:bg-white/10 transition-all duration-300"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  ));

  // Always use centered modal for stability
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 border-0 bg-transparent shadow-none max-w-md">
        <ModalContent />
      </DialogContent>
    </Dialog>
  );
});

TipModal.displayName = 'TipModal';

export default TipModal;