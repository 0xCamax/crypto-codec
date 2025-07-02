
import {
	createBuffer,
	fromDer,
	certificateFromAsn1,
	privateKeyFromAsn1,
	decryptPrivateKeyInfo,
	PublicKey,
	PrivateKey,
	setPublicKey,
	privateKeyToPem,
	privateKeyFromPem
} from '../../deps.ts';


export function publicKeyPemToHex(pem: string): string {
	const base64 = pem
		.replace('-----BEGIN PUBLIC KEY-----', '')
		.replace('-----END PUBLIC KEY-----', '')
		.replace(/\s/g, '');

	const binaryString = atob(base64);
	let hex = '';
	for (let i = 0; i < binaryString.length; i++) {
		const byte = binaryString.charCodeAt(i);
		hex += byte.toString(16).padStart(2, '0');
	}
	return hex;
}

export function fileToPrivateKey(keyDer: Uint8Array, password: string) {
	const decryptedKey = decryptPrivateKeyInfo(
		fromDer(createBuffer(keyDer)),
		password
	);
	if (!decryptedKey)
		throw new Error('No se pudo desencriptar la clave privada.');
	return privateKeyFromAsn1(decryptedKey);
}

export function privateKeytoPem(privKey: typeof PrivateKey): string {
	return privateKeyToPem(privKey);
}

export function pemToPrivateKey(pem: string): typeof PrivateKey {
	return privateKeyFromPem(pem);
}

export function fileToCertificate(der: Uint8Array) {
	return certificateFromAsn1(fromDer(createBuffer(der)));
}

export function publicKeyFromPrivateKey(
	privKey: typeof PrivateKey
): typeof PublicKey {
	return setPublicKey(privKey.n, privKey.e);
}
