import { keccak256 } from '../deps.ts';
import { Signer as ecdsa_signer } from '../ecdsa/Signer.ts';
import { RecoveredSignature } from '../ecdsa/utils/types.ts';
import { Provider } from './Provider.ts';
import { Transaction } from './Transaction.ts';
import {
	EthereumTx,
	EthereumTxHex,
	SignedAuthorizationEntry,
	zeroAddress,
} from './utils/types.ts';
import { hexlify, hexlifyObject } from './utils/codec.ts';
import { RLP } from '../deps.ts';

export class Account extends ecdsa_signer {
	providers: Map<string, Provider> = new Map();
	transactions: Transaction = new Transaction();
	constructor(_providers: Provider[]) {
		super();
		_providers.forEach((p) => this.providers.set(p.chain, p));
	}

	getAddress(key: Uint8Array): string {
		const publicKey = this.publicKeyFromPrivateKey(key);
		return ('0x' + hexlify(keccak256(publicKey)).slice(-40)) as string;
	}

	async upgradeAccount(
		target: string,
		key: Uint8Array,
		chainId: string | number
	) {
		const { nonce } = await this.getContext(key, hexlify(chainId) as string);
		const authNonce = hexlify(parseInt(nonce, 16) + 1) as string;
		const authorizationDigest = keccak256(
			Uint8Array.from([0x05, ...RLP.encode([chainId, target, authNonce])])
		);
		const authorizationSignature = this.ecdsa_sign(authorizationDigest, key);
		const { s, r, recovery } = authorizationSignature;
		const authorization: SignedAuthorizationEntry = {
			chainId,
			address: target,
			nonce: authNonce,
			r,
			s,
			yParity: recovery,
			v: recovery + 27,
		};
		return authorization;
	}

	async signTransaction(
		key: Uint8Array,
		tx: EthereumTx,
		index: number = 0
	): Promise<string> {
		const { address, provider } = await this.getContext(
			key,
			hexlify(tx.chainId) as string
		);
		if (tx.to == "0xSELF") tx.to = address;
		const populatedTx = await provider.populateTransaction(
			hexlifyObject(tx) as unknown as EthereumTxHex,
			address
		);
		const t = new Transaction(populatedTx);
		const hash = t.prepareForSigning()[index];
		const signature = this.ecdsa_sign(hash, key);
		const { r, s, recovery } = signature;
		t.set(
			{
				...populatedTx,
				r,
				s,
				yParity: recovery,
				v: recovery + 27,
			} as unknown as EthereumTx,
			index
		);
		return t.rawTransaction(index);
	}

	async signAll(
		key: Uint8Array,
		tx: Transaction
	): Promise<
		{
			chain: string;
			raw: string;
			signed: EthereumTxHex;
			signature: RecoveredSignature;
			hash: Uint8Array;
		}[]
	> {
		try {
			const address = this.getAddress(key) as string;
			for (let i = 0; i < tx.transactions.length; i++) {
				const t = tx.transactions[i];
				if (t.to == "0xSELF") {
					t.to = address;
				}
				const chain = t.chainId;
				const provider = this.providers.get(chain);
				if (!provider) {
					throw new Error('[Provider]: Chain not supported');
				}
				const populatedTx = await provider!.populateTransaction(
					hexlifyObject(t) as unknown as EthereumTxHex,
					address
				);
				tx.set(populatedTx, i);
			}

			const hashes = tx.prepareForSigning();
			const signatures = hashes.map((hash) => {
				return this.ecdsa_sign(hash, key);
			});

			return signatures.map((sig, i) => {
				const { r, s, recovery } = sig;
				tx.set(
					{
						...tx.transactions[i],
						r,
						s,
						yParity: recovery,
						v: recovery + 27,
					},
					i
				);
				tx.rawTransaction(i);
				return {
					chain: tx.transactions[i].chainId,
					raw: tx.rawTransaction(i),
					signed: tx.transactions[i],
					signature: sig,
					hash: hashes[i],
				} as {
					chain: string;
					raw: string;
					signed: EthereumTxHex;
					hash: Uint8Array;
					signature: RecoveredSignature;
				};
			});
		} catch (error) {
			throw new Error(`[Signature error]: ${(error as Error).message}`);
		}
	}

	protected async getContext(
		key: Uint8Array,
		chainId: string
	): Promise<{
		address: string;
		provider: Provider;
		nonce: string;
	}> {
		const address = this.getAddress(key);
		const provider = this.providers.get(chainId);
		if (!provider) {
			throw new Error('[Provider]: Chain not supported');
		}
		const nonce = await provider.eth_getTransactionCount(address);

		return {
			address,
			nonce,
			provider,
		};
	}
}
