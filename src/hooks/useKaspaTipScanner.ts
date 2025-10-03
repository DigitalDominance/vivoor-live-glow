import { useEffect, useMemo, useRef } from "react";
import { asciiToHex, fetchAddressFullTxs, KaspaTx, sumOutputsToAddress } from "@/lib/kaspaApi";
import { extractTipFromSignature } from "@/lib/crypto";

export type TipEvent = {
  txid: string;
  daa: number;
  amountSompi: number;
  message?: string; // extracted tip payload
};

const TIP_PREFIX = "VIVR-TIP1:";
const TIP_PREFIX_HEX = asciiToHex(TIP_PREFIX);

function extractTipPayloadFromHex(hexPayload?: string | null): string | undefined {
  if (!hexPayload) return undefined;
  
  // Convert hex to string to check for our prefix
  try {
    const bytes: number[] = [];
    for (let i = 0; i < hexPayload.length; i += 2) {
      const byte = parseInt(hexPayload.slice(i, i + 2), 16);
      if (!Number.isNaN(byte)) bytes.push(byte);
    }
    const txt = new TextDecoder().decode(new Uint8Array(bytes));
    
    // Check if it contains our tip prefix
    if (txt.includes(TIP_PREFIX)) {
      const idx = txt.indexOf(TIP_PREFIX);
      if (idx !== -1) {
        return txt.slice(idx); // Return from prefix onwards
      }
    }
  } catch {
    // If direct decode fails, try to find hex-encoded prefix
    const idx = hexPayload.toLowerCase().indexOf(TIP_PREFIX_HEX.toLowerCase());
    if (idx !== -1) {
      const afterPrefixHex = hexPayload.slice(idx);
      return TIP_PREFIX + afterPrefixHex.slice(TIP_PREFIX_HEX.length);
    }
  }
  
  return undefined;
}

export function useKaspaTipScanner(params: {
  address: string | null | undefined;
  startDaa: number | null | undefined;
  enabled?: boolean;
  onTip?: (tip: TipEvent) => void;
}) {
  const { address, startDaa, enabled = true, onTip } = params;
  const seen = useRef<Set<string>>(new Set());
  const running = enabled && !!address && typeof startDaa === 'number';

  const minDaa = useMemo(() => (typeof startDaa === 'number' ? startDaa : 0), [startDaa]);

  useEffect(() => {
    if (!running) return;

    let stopped = false;

    async function tick() {
      if (!address) return;
      try {
        console.log(`Checking transactions for ${address} with minDaa: ${minDaa}`);
        const txs: KaspaTx[] = await fetchAddressFullTxs(address, 50);
        console.log(`Found ${txs.length} transactions for address`);
        
        for (const tx of txs) {
          const daa = tx.accepting_block_blue_score || 0;
          
          // Check if transaction is too old
          if (daa <= minDaa) {
            console.log(`Skipping old transaction ${tx.transaction_id} (daa: ${daa} <= ${minDaa})`);
            continue;
          }

          // Must be incoming (has output to our address)
          const amt = sumOutputsToAddress(tx, address);
          if (!amt) {
            console.log(`No output to our address in tx ${tx.transaction_id}`);
            continue;
          }

          console.log(`Processing transaction ${tx.transaction_id} with amount ${amt} and payload:`, tx.payload?.substring(0, 100));

          // Look for our prefix in the transaction payload (this is where tips are stored)
          const tipPayload = extractTipPayloadFromHex(tx.payload);
          if (!tipPayload) {
            console.log(`No tip payload found in tx ${tx.transaction_id}`);
            continue;
          }

          if (seen.current.has(tx.transaction_id)) {
            console.log(`Already processed tx ${tx.transaction_id}`);
            continue;
          }
          
          seen.current.add(tx.transaction_id);

          console.log('🎉 Found NEW tip transaction:', {
            txid: tx.transaction_id,
            daa,
            amount: amt,
            payload: tipPayload.substring(0, 100) + '...'
          });

          onTip?.({ txid: tx.transaction_id, daa, amountSompi: amt, message: tipPayload });
        }
      } catch (e) {
        console.error("Kaspa scan error:", e);
      }
    }

    // initial & interval
    tick();
    const id = setInterval(() => {
      if (!stopped) tick();
    }, 5000);

    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [address, minDaa, running, onTip]);
}
