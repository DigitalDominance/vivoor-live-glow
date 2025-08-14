import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import KaspaLogo from "@/components/icons/KaspaLogo";
import { useToast } from "@/components/ui/use-toast";
import { encryptTipMessage } from "@/lib/crypto";

const TipModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  toAddress?: string | null; // Streamer's Kaspa address (not displayed)
  senderHandle?: string; // Sender's handle for encryption
}> = ({ open, onOpenChange, isLoggedIn, onRequireLogin, toAddress, senderHandle }) => {
  const { toast } = useToast();
  const [amount, setAmount] = React.useState<string>("1");
  const [message, setMessage] = React.useState<string>("");
  const [sending, setSending] = React.useState(false);

  const sendTip = async () => {
    if (!toAddress) {
      toast({ title: "Streamer not tip-enabled", description: "No Kaspa address found.", variant: "destructive" });
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
      
      const txid = await window.kasware.sendKaspa(toAddress, sompi, {
        priorityFee: 10000,
        payload: encryptedPayload
      });
      
      toast({ title: "Tip sent successfully!", description: `${kas} KAS sent. Txid: ${txid.slice(0, 8)}...` });
      setMessage("");
      setAmount("1");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Failed to send tip", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KaspaLogo className="size-5 text-[hsl(var(--brand-cyan))]" /> Tip in KAS
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
