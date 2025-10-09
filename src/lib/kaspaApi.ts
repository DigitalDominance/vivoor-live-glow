// Kaspa REST API client utilities
// Minimal fetcher for address transactions with full details

export type KaspaTx = {
  transaction_id: string;
  accepting_block_blue_score: number; // DAA score
  block_time: number;
  payload?: string; // Hex-encoded transaction payload where tips are stored
  inputs: Array<{
    signature_script?: string | null;
  }>;
  outputs: Array<{
    amount: number;
    script_public_key_address?: string | null;
  }>;
};

const BASE = "https://api.kaspa.org";

export async function fetchAddressFullTxs(address: string, limit = 50) : Promise<KaspaTx[]> {
  const url = `${BASE}/addresses/${encodeURIComponent(address)}/full-transactions-page?limit=${limit}&before=0&after=0&resolve_previous_outpoints=no`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kaspa API error ${res.status}`);
  return (await res.json()) as KaspaTx[];
}

export function asciiToHex(str: string) {
  return Array.from(str)
    .map(c => c.charCodeAt(0).toString(16).padStart(2,'0'))
    .join("");
}

export function sumOutputsToAddress(tx: KaspaTx, address: string) {
  return tx.outputs
    .filter(o => o.script_public_key_address === address)
    .reduce((acc, o) => acc + (o.amount || 0), 0);
}

export type FeeEstimate = {
  priorityBucket: { feerate: number; estimatedSeconds: number };
  normalBuckets: Array<{ feerate: number; estimatedSeconds: number }>;
  lowBuckets: Array<{ feerate: number; estimatedSeconds: number }>;
};

export async function fetchFeeEstimate(): Promise<FeeEstimate> {
  const url = `${BASE}/info/fee-estimate`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Kaspa API error ${res.status}`);
  return (await res.json()) as FeeEstimate;
}
