import { Hex, SigLike } from 'https://esm.sh/@noble/secp256k1';
import { getPublicKey, verify as v, uint8ArrayToHex, keccak256 } from '../../deps.ts';

export function publicKeyFromPrivateKey(key: string) {
	return getPublicKey(key, false).slice(1);
}

export function privateKeyToHex(key: Uint8Array): string {
	return uint8ArrayToHex(key);
}

export function verify(
  signature: SigLike | Hex,
  message: Hex,
  key: Uint8Array
): { valid: boolean; address: string } {
  // Deriva la clave pública sin compresión
  const pub64 = publicKeyFromPrivateKey(uint8ArrayToHex(key));
  const publicKeyFull = new Uint8Array(65);
  publicKeyFull[0] = 0x04;
  publicKeyFull.set(pub64, 1);
  const valid = v(signature, message, publicKeyFull);
  const hash = keccak256(pub64);
  const address = '0x' + uint8ArrayToHex(hash.slice(-20));

  return { valid, address };
}

