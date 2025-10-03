import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

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

const DonationsHistoryModal: React.FC<DonationsHistoryModalProps> = ({
  open,
  onOpenChange,
  donations
}) => {
  // Sort donations by timestamp (newest first)
  const sortedDonations = React.useMemo(() => {
    return [...donations].sort((a, b) => b.timestamp - a.timestamp);
  }, [donations]);

  const totalAmount = React.useMemo(() => {
    return donations.reduce((sum, donation) => sum + donation.amount, 0);
  }, [donations]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-card/95 via-card/90 to-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
            Donations History
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            Total: <span className="font-semibold text-primary">{totalAmount} KAS</span> from {donations.length} donation{donations.length !== 1 ? 's' : ''}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {sortedDonations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No donations yet. Be the first to support!
            </div>
          ) : (
            <div className="space-y-3">
              {sortedDonations.map((donation) => (
                <div
                  key={donation.id}
                  className="p-4 rounded-lg bg-gradient-to-br from-background/60 to-background/40 border border-border/40 backdrop-blur-sm hover:border-primary/30 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-primary/20">
                      <AvatarImage src={donation.senderAvatar} alt={donation.sender} />
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20">
                        {donation.sender.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{donation.sender}</span>
                        <span className="font-bold text-primary whitespace-nowrap">
                          {donation.amount} KAS
                        </span>
                      </div>
                      
                      {donation.message && (
                        <p className="text-sm text-muted-foreground break-words mt-1">
                          {donation.message}
                        </p>
                      )}
                      
                      <div className="text-xs text-muted-foreground/70 mt-2">
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
