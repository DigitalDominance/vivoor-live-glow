import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useWallet } from '@/context/WalletContext';
import { toast } from 'sonner';
import { Flag, AlertTriangle, MessageSquareX, Shield, Eye, Zap } from 'lucide-react';

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streamId: string;
  streamTitle: string;
  reportedUserId: string;
  reportedUserHandle: string;
}

const REPORT_TYPES = [
  {
    id: 'inappropriate_content',
    label: 'Inappropriate Content',
    description: 'Nudity, violence, or explicit material',
    icon: AlertTriangle,
    color: 'text-red-400'
  },
  {
    id: 'harassment',
    label: 'Harassment',
    description: 'Bullying, hate speech, or targeting individuals',
    icon: Shield,
    color: 'text-orange-400'
  },
  {
    id: 'spam',
    label: 'Spam',
    description: 'Repetitive or promotional content',
    icon: MessageSquareX,
    color: 'text-yellow-400'
  },
  {
    id: 'copyright',
    label: 'Copyright Violation',
    description: 'Unauthorized use of copyrighted material',
    icon: Eye,
    color: 'text-purple-400'
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Other violations not listed above',
    icon: Flag,
    color: 'text-blue-400'
  }
];

export default function ReportModal({
  open,
  onOpenChange,
  streamId,
  streamTitle,
  reportedUserId,
  reportedUserHandle
}: ReportModalProps) {
  const { identity } = useWallet();
  const [selectedType, setSelectedType] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!identity?.id) {
      toast.error('Please connect your wallet to report');
      return;
    }

    if (!selectedType) {
      toast.error('Please select a report type');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('reports')
        .insert({
          reported_stream_id: streamId,
          reported_user_id: reportedUserId,
          reporter_user_id: identity.id,
          report_type: selectedType,
          description: description.trim() || null
        });

      if (error) throw error;

      toast.success('Report submitted successfully');
      onOpenChange(false);
      setSelectedType('');
      setDescription('');
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto bg-black/95 backdrop-blur-xl border border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/10 via-brand-iris/10 to-brand-pink/10 rounded-lg" />
        <div className="relative">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-2">
              <Flag className="h-5 w-5 text-red-400" />
              Report Stream
            </DialogTitle>
            <div className="text-sm text-muted-foreground">
              <p>Reporting: <span className="text-white font-medium">{streamTitle}</span></p>
              <p>Streamer: <span className="text-white font-medium">@{reportedUserHandle}</span></p>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-6">
            <div>
              <Label className="text-sm font-medium text-white mb-3 block">
                What's the issue?
              </Label>
              <RadioGroup value={selectedType} onValueChange={setSelectedType}>
                <div className="space-y-3">
                  {REPORT_TYPES.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <div
                        key={type.id}
                        className={`flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          selectedType === type.id
                            ? 'border-white/30 bg-white/5'
                            : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
                        }`}
                        onClick={() => setSelectedType(type.id)}
                      >
                        <RadioGroupItem value={type.id} id={type.id} className="mt-1" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <IconComponent className={`h-4 w-4 ${type.color}`} />
                            <Label
                              htmlFor={type.id}
                              className="text-sm font-medium text-white cursor-pointer"
                            >
                              {type.label}
                            </Label>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {type.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-white">
                Additional Details (Optional)
              </Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Provide any additional context about this report..."
                className="bg-black/50 border-white/10 text-white placeholder:text-gray-400 min-h-[80px] resize-none focus:border-white/30"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground text-right">
                {description.length}/500
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="flex-1 border border-white/10 hover:bg-white/5"
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!selectedType || isSubmitting}
                className="flex-1 bg-gradient-to-r from-red-500/90 to-red-600/90 hover:from-red-500 hover:to-red-600 text-white border-0"
              >
                {isSubmitting ? (
                  <>
                    <Zap className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Flag className="h-4 w-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}