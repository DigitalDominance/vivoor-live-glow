import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import "./donations-history-scrollbar.css";

interface Donation {
  id: string;
  sender: string;
  senderAvatar?: string;
  amount: number;
  message?: string;
  timestamp: number;
}

interface DonationsHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  donations: Donation[];
}

const DonationsHistoryModal: React.FC<DonationsHistoryModalProps> = ({ open, onOpenChange, donations }) => {
  // Sort donations by timestamp (newest first)
  const sortedDonations = React.useMemo(() => {
    return [...donations].sort((a, b) => b.timestamp - a.timestamp);
  }, [donations]);

  const totalAmount = React.useMemo(() => {
    return donations.reduce((sum, donation) => sum + donation.amount, 0);
  }, [donations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-[hsl(var(--brand-cyan)_/_0.15)] via-[hsl(var(--brand-iris)_/_0.15)] to-[hsl(var(--brand-pink)_/_0.15)] backdrop-blur-2xl border border-white/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[hsl(var(--brand-cyan))] via-[hsl(var(--brand-iris))] to-[hsl(var(--brand-pink))] bg-clip-text text-transparent">
            Donations History
          </DialogTitle>
          <div className="text-sm text-foreground/80">
            Total:{" "}
            <span className="font-bold bg-gradient-to-r from-[hsl(var(--brand-cyan))] to-[hsl(var(--brand-iris))] bg-clip-text text-transparent">
              {totalAmount} KAS
            </span>{" "}
            from {donations.length} donation{donations.length !== 1 ? "s" : ""}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4 donations-history-scroll">
          {sortedDonations.length === 0 ? (
            <div className="text-center py-12 text-foreground/60">No donations yet. Be the first to support!</div>
          ) : (
            <div className="space-y-3">
              {sortedDonations.map((donation) => (
                <div
                  key={donation.id}
                  className="p-4 rounded-xl bg-gradient-to-br from-[hsl(var(--brand-cyan)_/_0.1)] via-[hsl(var(--brand-iris)_/_0.1)] to-[hsl(var(--brand-pink)_/_0.1)] border border-white/10 backdrop-blur-xl hover:border-white/30 transition-all shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-[hsl(var(--brand-iris)_/_0.5)] mt-4 ml-3">
                      <AvatarImage src={donation.senderAvatar} alt={donation.sender} />
                      <AvatarFallback className="bg-gradient-to-br from-[hsl(var(--brand-cyan)_/_0.3)] to-[hsl(var(--brand-iris)_/_0.3)] text-foreground font-semibold">
                        {donation.sender.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm truncate text-foreground">{donation.sender}</span>
                        <span className="font-bold bg-gradient-to-r from-[hsl(var(--brand-cyan))] to-[hsl(var(--brand-iris))] bg-clip-text text-transparent whitespace-nowrap">
                          {donation.amount} KAS
                        </span>
                      </div>

                      {donation.message && (
                        <p className="text-sm text-foreground/70 break-words mt-1">{donation.message}</p>
                      )}

                      <div className="text-xs text-foreground/50 mt-2">
                        {new Date(donation.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DonationsHistoryModal;
