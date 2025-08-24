import { useState, useCallback } from 'react';
import { fetchAddressFullTxs, sumOutputsToAddress, KaspaTx } from '@/lib/kaspaApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentVerificationResult {
  success: boolean;
  txid?: string;
  error?: string;
}

export interface PaymentAmounts {
  stream_start: { sompi: number; kas: number };
  monthly_verification: { sompi: number; kas: number };
  yearly_verification: { sompi: number; kas: number };
}

export const PAYMENT_AMOUNTS: PaymentAmounts = {
  stream_start: { sompi: 120000000, kas: 1.2 }, // 1.2 KAS
  monthly_verification: { sompi: 10000000000, kas: 100 }, // 100 KAS
  yearly_verification: { sompi: 100000000000, kas: 1000 } // 1000 KAS
};

const TREASURY_ADDRESS = 'kaspa:qzs7mlxwqtuyvv47yhx0xzhmphpazxzw99patpkh3ezfghejhq8wv6jsc7f80';

export function useKaspaPaymentVerification() {
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyPayment = useCallback(async (
    userAddress: string,
    paymentType: keyof PaymentAmounts,
    txid: string,
    startTime: number
  ): Promise<PaymentVerificationResult> => {
    setIsVerifying(true);
    
    try {
      console.log('=== PAYMENT VERIFICATION DEBUG ===');
      console.log('User Address:', userAddress);
      console.log('Payment Type:', paymentType);
      console.log('Transaction ID:', txid);
      console.log('Transaction ID Type:', typeof txid);
      console.log('Transaction ID Length:', txid?.length);
      console.log('Start Time:', startTime);
      console.log('Expected Amount:', PAYMENT_AMOUNTS[paymentType]);
      
      const payload = {
        userAddress,
        paymentType,
        txid,
        startTime
      };
      
      console.log('Sending to edge function:', payload);
      
      // Use edge function for verification
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: payload
      });
      
      console.log('Edge function response:', { data, error });
      
      if (error) {
        console.error('Edge function error:', error);
        return { success: false, error: error.message };
      }
      
      if (data?.error) {
        console.error('Edge function returned error:', data.error);
        return { success: false, error: data.error };
      }
      
      console.log('Verification successful:', data);
      return { success: true, txid };
    } catch (error) {
      console.error('Payment verification error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Verification failed' 
      };
    } finally {
      setIsVerifying(false);
    }
  }, []);

  const sendPayment = useCallback(async (
    paymentType: keyof PaymentAmounts
  ): Promise<string | null> => {
    if (!window.kasware?.sendKaspa) {
      throw new Error("Kasware wallet not available");
    }
    
    const amount = PAYMENT_AMOUNTS[paymentType];
    
    try {
      const txid = await window.kasware.sendKaspa(TREASURY_ADDRESS, amount.sompi, {
        priorityFee: 10000,
        payload: `VIVOOR_${paymentType.toUpperCase()}:${Date.now()}`
      });
      
      toast.success(`Payment sent! Transaction ID: ${txid.slice(0, 8)}...`);
      return txid;
    } catch (error) {
      console.error('Payment failed:', error);
      throw error;
    }
  }, []);

  return {
    verifyPayment,
    sendPayment,
    isVerifying,
    PAYMENT_AMOUNTS,
    TREASURY_ADDRESS
  };
}