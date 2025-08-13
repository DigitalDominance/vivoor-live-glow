import { useEffect, useMemo, useRef } from "react";
import { asciiToHex, fetchAddressFullTxs, KaspaTx, sumOutputsToAddress } from "@/lib/kaspaApi";

export type TipEvent = {
  txid: string;
  daa: number;
  amountSompi: number;
  message?: string; // raw payload portion if we can decode
};

const TIP_PREFIX = "VIVR-TIP1:";
const TIP_PREFIX_HEX = asciiToHex(TIP_PREFIX);

function extractTipPayloadFromSigHex(sigHex?: string | null): string | undefined {
  if (!sigHex) return undefined;
  const idx = sigHex.toLowerCase().indexOf(TIP_PREFIX_HEX.toLowerCase());
  if (idx === -1) return undefined;
  const after = sigHex.slice(idx + TIP_PREFIX_HEX.length);
  // Best-effort UTF-8 decode (may include binary). Trim non-printables.
  try {
    const bytes: number[] = [];
    for (let i = 0; i < after.length; i += 2) {
      const byte = parseInt(after.slice(i, i + 2), 16);
      if (!Number.isNaN(byte)) bytes.push(byte);
    }
    const txt = new TextDecoder().decode(new Uint8Array(bytes));
    return txt.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  } catch {
    return undefined;
  }
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
        const txs: KaspaTx[] = await fetchAddressFullTxs(address, 50);
        for (const tx of txs) {
          const daa = tx.accepting_block_blue_score || 0;
          if (daa <= minDaa) continue; // respect baseline

          // Must be incoming (has output to our address)
          const amt = sumOutputsToAddress(tx, address);
          if (!amt) continue;

          // Look for our prefix in any input signature_script
          const hasPrefix = tx.inputs?.some((i) =>
            (i.signature_script || "").toLowerCase().includes(TIP_PREFIX_HEX.toLowerCase())
          );
          if (!hasPrefix) continue;

          if (seen.current.has(tx.transaction_id)) continue;
          seen.current.add(tx.transaction_id);

          const payload = extractTipPayloadFromSigHex(tx.inputs?.[0]?.signature_script);
          onTip?.({ txid: tx.transaction_id, daa, amountSompi: amt, message: payload });
        }
      } catch (e) {
        console.warn("Kaspa scan error:", e);
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
