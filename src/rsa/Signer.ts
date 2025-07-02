import { certificateFromPem, privateKeyFromPem, sha256 } from '../deps.ts';

export class Signer {
	rsa_sign(key: string, message: string) {
		const signer = privateKeyFromPem(key);
		const md = sha256.create();
		md.update(message);
		return signer.sign(md);
	}
	rsa_verify(cert: string, message: string, signature: string) {
		const publicKey = this.certificate(cert).publicKey;
		const md = sha256.create();
		md.update(message);
		return publicKey.verify(md.digest().bytes(), signature);
	}

	rsa_encrypt(cert: string, message: string) {
		const publicKey = this.certificate(cert).publicKey;
		return publicKey.encrypt(message, 'RSA-OAEP', {
			md: sha256.create(),
		});
	}

	rsa_decrypt(key: string, message: string) {
		const privateKey = privateKeyFromPem(key);
		return privateKey.decrypt(message, 'RSA-OAEP', {
			md: sha256.create(),
		});
	}

	certificate(cert: string) {
		return certificateFromPem(cert);
	}
}
