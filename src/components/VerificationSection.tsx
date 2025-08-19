import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useWallet } from "@/context/WalletContext";
import { toast } from "@/hooks/use-toast";
import { Shield, Clock, Copy, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const TREASURY_ADDRESS = "kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80";
const MONTHLY_AMOUNT = 75;
const YEARLY_AMOUNT = 750;

interface VerificationStatus {
  is_verified: boolean;
  expires_at: string | null;
  duration_type: string | null;
}

const VerificationSection: React.FC = () => {
  const { identity } = useWallet();
  const queryClient = useQueryClient();
  
  const [durationType, setDurationType] = useState<'monthly' | 'yearly'>('monthly');
  const [isScanning, setIsScanning] = useState(false);
  const [scanTimeout, setScanTimeout] = useState<NodeJS.Timeout | null>(null);
  const [scanStartTime, setScanStartTime] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  // Fetch verification status
  const { data: verificationStatus } = useQuery({
    queryKey: ['verification', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('get_user_verification', { 
        user_id_param: identity.id 
      });
      return data?.[0] as VerificationStatus || null;
    },
    enabled: !!identity?.id
  });

  // Payment verification mutation
  const verifyPaymentMutation = useMutation({
    mutationFn: async (params: {
      userAddress: string;
      amount: number;
      durationType: 'monthly' | 'yearly';
      startTime: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('verify-kaspa-payment', {
        body: params
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Verification successful!", description: data.message });
        queryClient.invalidateQueries({ queryKey: ['verification', identity?.id] });
        setIsScanning(false);
        if (scanTimeout) clearTimeout(scanTimeout);
        setScanTimeout(null);
      } else {
        console.log('Payment not found yet, continuing to scan...');
      }
    },
    onError: (error: any) => {
      console.error('Verification error:', error);
      toast({ 
        title: "Verification failed", 
        description: error.message || "Failed to verify payment",
        variant: "destructive" 
      });
    }
  });

  const handlePayment = async () => {
    if (!identity?.address || !window.kasware) {
      toast({ title: "Please connect your Kasware wallet first", variant: "destructive" });
      return;
    }

    try {
      const amount = durationType === 'monthly' ? MONTHLY_AMOUNT : YEARLY_AMOUNT;
      const sompi = amount * 100_000_000; // Convert KAS to sompi

      // Send payment
      const txid = await window.kasware.sendKaspa(TREASURY_ADDRESS, sompi);
      console.log('Payment sent:', txid);

      toast({ 
        title: "Payment sent!", 
        description: `Transaction ID: ${txid.substring(0, 20)}...` 
      });

      // Start scanning for verification
      const startTime = new Date().toISOString();
      setScanStartTime(startTime);
      setIsScanning(true);

      // Set 10 minute timeout
      const timeoutId = setTimeout(() => {
        setIsScanning(false);
        setScanTimeout(null);
        toast({ 
          title: "Verification timeout", 
          description: "Payment verification timed out. Please try again.",
          variant: "destructive"
        });
      }, 10 * 60 * 1000); // 10 minutes

      setScanTimeout(timeoutId);

      // Start polling for verification
      const pollForVerification = () => {
        if (!isScanning) return;
        
        verifyPaymentMutation.mutate({
          userAddress: identity.address,
          amount: sompi,
          durationType,
          startTime
        });

        // Continue polling every 10 seconds
        setTimeout(pollForVerification, 10000);
      };

      // Start polling after 30 seconds (give time for transaction to propagate)
      setTimeout(pollForVerification, 30000);

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({ 
        title: "Payment failed", 
        description: error.message || "Failed to send payment",
        variant: "destructive" 
      });
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(TREASURY_ADDRESS);
      setAddressCopied(true);
      toast({ title: "Address copied to clipboard!" });
      setTimeout(() => setAddressCopied(false), 2000);
    } catch (error) {
      toast({ title: "Failed to copy address", variant: "destructive" });
    }
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} remaining`;
    } else {
      return `${hours} hour${hours > 1 ? 's' : ''} remaining`;
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeout) clearTimeout(scanTimeout);
    };
  }, [scanTimeout]);

  if (!identity?.id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Channel Verification
          </CardTitle>
          <CardDescription>
            Please connect your wallet to verify your channel
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isVerified = verificationStatus?.is_verified;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-5" />
          Channel Verification
          {isVerified && <Badge variant="secondary" className="bg-green-100 text-green-800">Verified</Badge>}
        </CardTitle>
        <CardDescription>
          Verify your channel with a KAS payment to show authenticity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isVerified ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <Shield className="size-5" />
              <span className="font-medium">Your channel is verified!</span>
            </div>
            {verificationStatus?.expires_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" />
                <span>{formatTimeRemaining(verificationStatus.expires_at)}</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Your verification will expire on {verificationStatus?.expires_at ? 
                new Date(verificationStatus.expires_at).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-medium">Choose verification period:</Label>
              <RadioGroup 
                value={durationType} 
                onValueChange={(value: 'monthly' | 'yearly') => setDurationType(value)}
                className="mt-3"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span>Monthly verification</span>
                      <Badge variant="outline">{MONTHLY_AMOUNT} KAS</Badge>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="yearly" id="yearly" />
                  <Label htmlFor="yearly" className="flex-1 cursor-pointer">
                    <div className="flex justify-between items-center">
                      <span>Yearly verification</span>
                      <Badge variant="outline">{YEARLY_AMOUNT} KAS</Badge>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm font-medium">Treasury Address:</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input 
                  value={TREASURY_ADDRESS} 
                  readOnly 
                  className="text-xs font-mono"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={copyAddress}
                  className="shrink-0"
                >
                  {addressCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </Button>
              </div>
            </div>

            {isScanning && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                  <span className="font-medium">Scanning for payment...</span>
                </div>
                <p className="text-sm text-blue-600">
                  Please wait while we verify your payment. This can take up to 10 minutes.
                </p>
                {scanTimeout && (
                  <div className="text-xs text-blue-500 mt-1">
                    Scanning will timeout in {Math.ceil((10 * 60 * 1000 - Date.now() + (scanStartTime ? new Date(scanStartTime).getTime() : Date.now())) / 1000 / 60)} minutes
                  </div>
                )}
              </div>
            )}

            <Button 
              onClick={handlePayment} 
              disabled={isScanning || verifyPaymentMutation.isPending}
              className="w-full"
            >
              {isScanning ? 'Verifying Payment...' : `Pay ${durationType === 'monthly' ? MONTHLY_AMOUNT : YEARLY_AMOUNT} KAS to Verify`}
            </Button>

            <p className="text-xs text-muted-foreground">
              Payment will be sent to our treasury address. Once confirmed, your channel will receive a verified badge.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VerificationSection;