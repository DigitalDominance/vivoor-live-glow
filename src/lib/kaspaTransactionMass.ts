// Kaspa transaction mass calculation utilities
// Based on the Kaspa consensus transaction mass estimation algorithm

const HASH_SIZE = 32;
const SUBNETWORK_ID_SIZE = 20;
const OUTPOINT_SIZE = 36; // 32 bytes txid + 4 bytes index

// Standard sizes for typical Kaspa transactions with payload
// Based on empirical observation of Kasware wallet transactions
const SIGNATURE_SCRIPT_SIZE = 166; // Kasware standard signature + script
const SCRIPT_PUBLIC_KEY_SIZE = 35; // Typical P2PK script public key

// Kaspa mass includes both storage and compute costs
// Mass = storage_mass + compute_mass (from signature operations)
const COMPUTE_MASS_PER_SIG_OP = 1000; // grams per signature verification
const STORAGE_MASS_MULTIPLIER = 10; // Storage mass multiplier for Kaspa
const BASE_OVERHEAD = 300; // Network processing overhead

export interface TransactionMassEstimate {
  mass: number;
  size: number;
}

/**
 * Calculate the estimated serialized size and mass of a Kaspa transaction with payload
 * @param messageText - The chat message text to include in payload
 * @param streamId - The stream ID to include in payload
 * @param numInputs - Number of transaction inputs (default 2 for typical wallet)
 * @param numOutputs - Number of transaction outputs (default 2: recipient + change)
 */
export function estimateTransactionMass(
  messageText: string,
  streamId: string,
  numInputs: number = 2,
  numOutputs: number = 2
): TransactionMassEstimate {
  let size = 0;

  // Transaction version (u16)
  size += 2;

  // Number of inputs (u64)
  size += 8;

  // Inputs size
  for (let i = 0; i < numInputs; i++) {
    size += OUTPOINT_SIZE; // previous outpoint
    size += 8; // signature script length (u64)
    size += SIGNATURE_SCRIPT_SIZE; // signature script
    size += 8; // sequence (u64)
  }

  // Number of outputs (u64)
  size += 8;

  // Outputs size
  for (let i = 0; i < numOutputs; i++) {
    size += 8; // value (u64)
    size += 8; // script public key length (u64)
    size += SCRIPT_PUBLIC_KEY_SIZE; // script public key
  }

  // Lock time (u64)
  size += 8;

  // Subnetwork ID
  size += SUBNETWORK_ID_SIZE;

  // Gas (u64)
  size += 8;

  // Payload hash
  size += HASH_SIZE;

  // Payload length (u64)
  size += 8;

  // Actual payload size
  // Format: "VIVOOR_STREAM_CHAT:{streamId}:{timestamp}:{message}"
  const timestamp = Date.now().toString();
  const payloadPrefix = "VIVOOR_STREAM_CHAT:";
  const payloadContent = `${payloadPrefix}${streamId}:${timestamp}:${messageText}`;
  const payloadSize = payloadContent.length;
  
  size += payloadSize;

  // In Kaspa, transaction mass includes both storage mass (size * multiplier) and compute mass
  // Compute mass accounts for signature verification operations
  const storageMass = size * STORAGE_MASS_MULTIPLIER;
  const computeMass = numInputs * COMPUTE_MASS_PER_SIG_OP; // Each input has 1 sig op
  const mass = storageMass + computeMass + BASE_OVERHEAD;

  return { mass, size };
}

/**
 * Calculate the fee in KAS for a given message
 * @param messageText - The message to send
 * @param streamId - The stream ID
 * @param feeratePerGram - Fee rate from the network (in sompi per gram)
 * @param numInputs - Number of inputs (default 2)
 * @param numOutputs - Number of outputs (default 2)
 * @returns Fee in KAS
 */
export function calculateMessageFee(
  messageText: string,
  streamId: string,
  feeratePerGram: number,
  numInputs: number = 2,
  numOutputs: number = 2
): number {
  const { mass } = estimateTransactionMass(messageText, streamId, numInputs, numOutputs);
  const feeInSompi = feeratePerGram * mass;
  const feeInKas = feeInSompi / 1e8;
  return feeInKas;
}

/**
 * Format fee for display, removing trailing zeros
 */
export function formatFee(feeInKas: number): string {
  return parseFloat(feeInKas.toFixed(8)).toString();
}
