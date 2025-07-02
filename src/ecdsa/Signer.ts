import { RecoveredSignature, SigLike, Hex } from './utils/types.ts';
import {
	getPublicKey,
	verify as v,
	sign as s,
	uint8ArrayToHex,
	keccak256,
} from '../deps.ts';

export class Signer {
	ecdsa_sign(digest: Uint8Array, key: Uint8Array): RecoveredSignature {
		return s(digest, key);
	}
	ecdsa_verify(
		signature: SigLike | Hex,
		message: Hex,
		key: Uint8Array
	): { valid: boolean; address: string } {
		const pub64 = this.publicKeyFromPrivateKey(key);
		const publicKeyFull = new Uint8Array(65);
		publicKeyFull[0] = 0x04;
		publicKeyFull.set(pub64, 1);
		const valid = v(signature, message, publicKeyFull);
		const address = '0x' + uint8ArrayToHex(keccak256(pub64).slice(-20));

		return { valid, address };
	}

	publicKeyFromPrivateKey(key: Uint8Array) {
		return getPublicKey(key, false).slice(1);
	}
}
