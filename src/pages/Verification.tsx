import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWallet } from '@/context/WalletContext';
import { useKaspaPaymentVerification, PAYMENT_AMOUNTS } from '@/hooks/useKaspaPaymentVerification';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Zap, Star, Crown } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import VerifiedBadge from '@/components/VerifiedBadge';

const Verification = () => {
  const navigate = useNavigate();
  const { identity } = useWallet();
  const { sendPayment, verifyPayment, isVerifying } = useKaspaPaymentVerification();
  const [pendingTxid, setPendingTxid] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<'monthly_verification' | 'yearly_verification' | null>(null);

  // Check current verification status
  const { data: verificationStatus, refetch } = useQuery({
    queryKey: ['user-verification', identity?.id],
    queryFn: async () => {
      if (!identity?.id) return null;
      const { data } = await supabase.rpc('user_has_active_verification', { 
        user_id_param: identity.id 
      });
      return data?.[0] || null;
    },
    enabled: !!identity?.id
  });

  useEffect(() => {
    if (!identity?.id) {
      navigate('/app');
      return;
    }
  }, [identity, navigate]);

  const handlePayment = async (type: 'monthly_verification' | 'yearly_verification') => {
    if (!identity?.id) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      const txid = await sendPayment(type);
      if (txid) {
        setPendingTxid(txid);
        setPendingType(type);
        toast.info('Payment sent! Waiting for confirmation...');
        
        // Wait a few seconds then try to verify
        setTimeout(() => {
          handleVerifyPayment(txid, type);
        }, 5000);
      }
    } catch (error) {
      toast.error(`Payment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleVerifyPayment = async (txid: string, type: 'monthly_verification' | 'yearly_verification') => {
    if (!identity?.id) return;

    const startTime = Date.now() - 10 * 60 * 1000; // Allow 10 minutes before now
    
    const result = await verifyPayment(identity.id, type, txid, startTime);
    
    if (result.success) {
      toast.success('Verification successful! You are now verified.');
      setPendingTxid(null);
      setPendingType(null);
      refetch();
    } else {
      toast.error(`Verification failed: ${result.error}`);
    }
  };

  if (!identity?.id) {
    return (
      <main className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Wallet Required</h1>
          <p className="text-muted-foreground mb-6">Please connect your Kaspa wallet to access verification.</p>
          <Button onClick={() => navigate('/app')}>Go to App</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-6">
      <Helmet>
        <title>Verification — Vivoor</title>
        <meta name="description" content="Get verified on Vivoor with KAS payments for enhanced features and credibility." />
        <link rel="canonical" href="/verification" />
      </Helmet>

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-brand-cyan via-brand-iris to-brand-pink bg-clip-text text-transparent">
            Get Verified
          </h1>
          <p className="text-muted-foreground">
            Enhance your credibility and unlock premium features with verification
          </p>
        </div>

        {/* Current Status */}
        <Card className="mb-8 border-brand-iris/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Verification Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {verificationStatus?.is_verified ? (
              <div className="flex items-center gap-3">
                <VerifiedBadge size="md" isVerified={true} />
                <div>
                  <p className="font-medium text-green-400">Verified</p>
                  <p className="text-sm text-muted-foreground">
                    Expires: {new Date(verificationStatus.expires_at).toLocaleDateString()}
                  </p>
                  <Badge variant="outline" className="mt-1">
                    {verificationStatus.payment_type === 'monthly_verification' ? 'Monthly' : 'Yearly'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Not Verified</p>
                  <p className="text-sm text-muted-foreground">
                    Choose a verification plan below to get started
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Verification Plans */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Monthly Plan */}
          <Card className="border-brand-cyan/20 hover:border-brand-cyan/40 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-brand-cyan" />
                <CardTitle>Monthly Verification</CardTitle>
              </div>
              <CardDescription>
                Perfect for trying out verification benefits
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-brand-cyan">
                  {PAYMENT_AMOUNTS.monthly_verification.kas} KAS
                </div>
                <p className="text-sm text-muted-foreground">Valid for 30 days</p>
              </div>
              
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Verified badge on profile
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Enhanced credibility
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Priority support
                </li>
              </ul>

              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => handlePayment('monthly_verification')}
                disabled={isVerifying || (pendingType === 'monthly_verification' && !!pendingTxid)}
              >
                {pendingType === 'monthly_verification' && pendingTxid ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Verifying Payment...
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 mr-2" />
                    Get Monthly Verification
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Yearly Plan */}
          <Card className="border-brand-pink/20 hover:border-brand-pink/40 transition-colors relative">
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-brand-iris to-brand-pink text-white">
                Best Value
              </Badge>
            </div>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-brand-pink" />
                <CardTitle>Yearly Verification</CardTitle>
              </div>
              <CardDescription>
                Best value for long-term creators
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-brand-pink">
                  {PAYMENT_AMOUNTS.yearly_verification.kas} KAS
                </div>
                <p className="text-sm text-muted-foreground">Valid for 365 days</p>
                <p className="text-xs text-green-400 font-medium mt-1">
                  Save ~17% vs monthly
                </p>
              </div>
              
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Verified badge on profile
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Enhanced credibility
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  Priority support
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="font-medium">Annual savings</span>
                </li>
              </ul>

              <Button 
                className="w-full bg-gradient-to-r from-brand-iris to-brand-pink hover:from-brand-iris/80 hover:to-brand-pink/80" 
                onClick={() => handlePayment('yearly_verification')}
                disabled={isVerifying || (pendingType === 'yearly_verification' && !!pendingTxid)}
              >
                {pendingType === 'yearly_verification' && pendingTxid ? (
                  <>
                    <Clock className="w-4 h-4 mr-2 animate-spin" />
                    Verifying Payment...
                  </>
                ) : (
                  <>
                    <Crown className="w-4 h-4 mr-2" />
                    Get Yearly Verification
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Section */}
        <Card className="border-brand-iris/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-brand-iris" />
              Verification Benefits
            </CardTitle>
            <CardDescription>
              What you get when you become verified
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Verified Badge</h4>
                    <p className="text-sm text-muted-foreground">
                      Display a verified badge on your profile, streams, and clips
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Enhanced Credibility</h4>
                    <p className="text-sm text-muted-foreground">
                      Build trust with your audience and stand out from the crowd
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Priority Support</h4>
                    <p className="text-sm text-muted-foreground">
                      Get faster response times for support requests
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium">Community Recognition</h4>
                    <p className="text-sm text-muted-foreground">
                      Join the verified creator community on Vivoor
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Verification;