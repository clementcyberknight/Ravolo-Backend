import { getAddress, isAddress, isHex, verifyMessage } from "viem";

/**
 * Verifies an EIP-191 personal_sign signature over the exact UTF-8 message bytes.
 */
export async function verifyEip191Signature(
  messageUtf8: string,
  signatureHex: string,
  walletAddress: string,
): Promise<boolean> {
  if (!isAddress(walletAddress)) return false;
  const address = getAddress(walletAddress);
  const sig = signatureHex.trim();
  if (!isHex(sig)) return false;
  try {
    return await verifyMessage({
      address,
      message: messageUtf8,
      signature: sig as `0x${string}`,
    });
  } catch {
    return false;
  }
}
