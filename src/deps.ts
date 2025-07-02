import { utils, etc } from 'https://esm.sh/@noble/secp256k1';
import { hmac } from 'https://esm.sh/@noble/hashes/hmac';
import { keccak_256 } from 'https://esm.sh/@noble/hashes/sha3';
import * as forge from 'https://esm.sh/node-forge@1.3.1';
export { getPublicKey, sign, verify } from 'https://esm.sh/@noble/secp256k1';
export const { randomPrivateKey } = utils;
export { RLP } from 'https://esm.sh/@ethereumjs/rlp';
export { keccak256 } from 'https://esm.sh/ethereum-cryptography/keccak';
export {
	utf8ToBytes,
	concatBytes,
} from 'https://esm.sh/ethereum-cryptography/utils';
export const { bytesToHex: uint8ArrayToHex, hexToBytes: hexToUint8Array } = etc;
export const {
	pki: {
		certificateFromAsn1,
		certificateFromPem,
		certificateToPem,
		privateKeyFromAsn1,
		decryptPrivateKeyInfo,
		publicKeyToPem,
		privateKeyToPem,
		privateKeyFromPem,
	},
	asn1: { fromDer },
	util: { createBuffer, bytesToHex, hexToBytes },
	md: { sha256 },
	rsa: { PublicKey, PrivateKey, setPublicKey },
} = forge.default;

etc.hmacSha256Sync = (key, ...msgs) =>
	hmac(keccak_256, key, etc.concatBytes(...msgs));
forge.options.usePureJavaScript = true;
