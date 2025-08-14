import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import KaspaLogo from "@/components/icons/KaspaLogo";
import { useToast } from "@/components/ui/use-toast";

const TipModal: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isLoggedIn: boolean;
  onRequireLogin: () => void;
  toAddress?: string | null; // Streamer's Kaspa address (not displayed)
}> = ({ open, onOpenChange, isLoggedIn, onRequireLogin, toAddress }) => {
  const { toast } = useToast();
  const [amount, setAmount] = React.useState<string>("1");
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
      
      // Create payload with unique identifier for tips
      const payload = `KSTREAM_TIP:${kas}KAS:from_viewer`;
      
      const txid = await window.kasware.sendKaspa(toAddress, sompi, {
        priorityFee: 10000,
        payload
      });
      
      toast({ title: "Tip sent successfully!", description: `${kas} KAS sent. Txid: ${txid.slice(0, 8)}...` });
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
            <p className="text-sm text-muted-foreground">Choose an amount. Your wallet will open to confirm.</p>
            <div className="flex gap-2 flex-wrap">
              {["1","5","10"].map(v => (
                <Button key={v} variant="glass" onClick={() => setAmount(v)} aria-label={`Tip ${v} KAS`}>{v} KAS</Button>
              ))}
            </div>
            <div>
              <label className="text-sm">Custom amount (minimum 1 KAS)</label>
              <input value={amount} onChange={(e)=>setAmount(e.target.value)} type="number" min="1" step="1" className="mt-1 w-full rounded-md bg-background px-3 py-2 text-sm border border-border" />
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
