import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import KasLogo from "@/components/KasLogo";
import { toast } from "sonner";
import { encryptTipMessage } from "@/lib/crypto";

const TipModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  toAddress?: string | null; // Streamer's Kaspa address (not displayed)
  senderHandle?: string; // Sender's handle for encryption
  streamId?: string; // Stream ID for verification
  senderProfile?: {
    display_name?: string;
    handle?: string;
    avatar_url?: string;
  } | null;
}> = ({ open, onOpenChange, isLoggedIn, onRequireLogin, toAddress, senderHandle, streamId, senderProfile }) => {
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
              tipMessage: message || "Thanks for the stream!"
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KasLogo size={20} /> Tip in KAS
          </DialogTitle>
        </DialogHeader>
        {isLoggedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Choose an amount and add a message. Your wallet will open to confirm.</p>
            <div className="flex gap-2 flex-wrap">
              {["1","5","10"].map(v => (
                <Button key={v} variant="glass" onClick={() => setAmount(v)} aria-label={`Tip ${v} KAS`}>{v} KAS</Button>
              ))}
            </div>
            <div>
              <label className="text-sm">Custom amount (minimum 1 KAS)</label>
              <input value={amount} onChange={(e)=>setAmount(e.target.value)} type="number" min="1" step="1" className="mt-1 w-full rounded-md bg-background px-3 py-2 text-sm border border-border" />
            </div>
            <div>
              <label className="text-sm">Message (optional)</label>
              <Textarea 
                value={message} 
                onChange={(e) => setMessage(e.target.value)} 
                placeholder="Say something nice to the streamer..."
                className="mt-1 resize-none"
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground mt-1">{message.length}/200 characters</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="hero" disabled={sending} onClick={sendTip}>Send Tip</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Login / connect wallet to tip in Kaspa.</p>
            <div className="flex justify-end gap-2">
              <Button variant="hero" onClick={onRequireLogin}>Login</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TipModal;
