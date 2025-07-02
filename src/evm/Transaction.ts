import { keccak256, RLP } from '../deps.ts';
import { hexlifyObject, hexlify, computeV } from './utils/codec.ts';
import {
	EthereumTx,
	EthereumTxHex,
	Type0TxHex,
	Type1TxHex,
	Type2TxHex,
	Type3TxHex,
	Type4TxHex,
	SignedFieldsHex,
	zeroAddress,
	AccessListItemHex,
} from './utils/types.ts';
import { ContractABI } from './abi/Abi.ts';
import { ABIFunction } from './abi/utils/types.ts';
import { SmartTransactionAbi } from "./abis/SmartTransactionAbi.ts";

class SmartTransaction {
	private encoder: ContractABI = new ContractABI(
		SmartTransactionAbi as ABIFunction[]
	);
	public batch: Map<string, EthereumTx[]> = new Map();

	protected newBatch(tx: EthereumTx) {
		const key = hexlify(tx.chainId) as string;
		const newBatch = this.batch.get(key);
		if (newBatch) {
			newBatch.push(tx);
			this.batch.set(key, newBatch);
		} else {
			this.batch.set(key, [tx]);
		}
	}

	setBatch(tx: EthereumTx, index: number) {
		const key = hexlify(tx.chainId) as string;
		const txs = this.batch.get(key);
		if (txs) {
			txs[index] = tx;
			this.batch.set(key, txs);
		} else {
			throw new Error('[Transaction]: Not found or not defined');
		}
	}

	removeBatch(chainId: string, index: number): EthereumTx[] {
		const key = hexlify(chainId) as string;
		const txs = this.batch.get(key);

		if (!txs) {
			throw new Error(`[Transaction]: Batch for chainId ${key} not found`);
		}

		if (index < 0 || index >= txs.length) {
			throw new Error(`[Transaction]: Index ${index} out of bounds`);
		}

		txs.splice(index, 1);
		this.batch.set(key, txs);

		return txs;
	}

	hasBatch(chainId: string): boolean {
		return this.batch.get(chainId) != undefined;
	}

	protected encodeBatch(chain: string | number): string {
		const executeBatch = this.encoder.fn.get('executeBatch');
		if (!executeBatch) {
			throw new Error('[Encoder]: Invalid encoder');
		}

		return executeBatch.encodeWithSelector([
			this.batch
				.get(hexlify(chain) as string)!
				.map((c) => [c.to, c.value, c.data]),
		]);
	}
}

export class Transaction extends SmartTransaction {
	public transactions: EthereumTxHex[] = [];
	public history: EthereumTxHex[] = [];

	constructor(tx?: EthereumTx) {
		super();
		if (tx) {
			this.new(tx);
		}
	}

	new(tx: EthereumTx) {
		const hex = this.toHex(tx);
		const index = this.transactions.findIndex(
			(_t) => _t.chainId == hex.chainId
		);
		if (index >= 0) {
			if (this.batch.has(hex.chainId)) {
				this.newBatch(tx);
				this.set(
					{
						type: hex.type,
						chainId: hex.chainId,
						data: this.encodeBatch(hex.chainId),
						to: zeroAddress,
					},
					index
				);
			} else {
				this.newBatch(this.transactions[index]);
				this.newBatch(tx);
				this.set(
					{
						type: hex.type,
						chainId: hex.chainId,
						data: this.encodeBatch(hex.chainId),
						to: zeroAddress,
					},
					index
				);
			}
		} else {
			this.transactions.push(hex);
		}
	}

	set(tx: EthereumTx, index: number) {
		if (index < 0 || index >= this.transactions.length) {
			throw new Error(`[Transaction]: Index ${index} is out of bounds`);
		}
		this.transactions[index] = this.toHex(tx);
	}

	remove(index: number) {
		if (index >= 0 && index < this.transactions.length) {
			this.transactions.splice(index, 1);
		}
	}

	filter(chain: string): EthereumTx[] {
		return this.transactions.filter((tx) => tx.chainId == chain);
	}

	prepareForSigning(txs: EthereumTxHex[] = this.transactions): Uint8Array[] {
		return txs.map((tx: EthereumTxHex) => {
			const t = tx as EthereumTxHex;
			if (this.hasSignature(t)) {
				throw new Error('Transaction is signed');
			}
			return keccak256(this.rlp(tx));
		});
	}

	rawTransaction(
		index: number = 0,
		txs: EthereumTxHex[] = this.transactions
	): string {
		if (!this.hasSignature(txs[index])) {
			throw new Error('Transaction is missing signature fields: yParity, r, s');
		}
		return hexlify(this.rlp(txs[index], true)) as string;
	}

	rlp(tx: EthereumTxHex, signed = false): Uint8Array {
		switch (tx.type) {
			case '0x0':
				return handleTxType0(tx as Type0TxHex, signed);

			case '0x1': {
				const t = tx as Type1TxHex;
				const items = [
					t.chainId,
					t.nonce,
					t.gasPrice,
					t.gasLimit,
					t.to,
					t.value == '0x0' ? undefined : t.value,
					t.data,
					handleAccessList(t.chainId, t.accessList),
				];
				if (signed)
					items.push(t.yParity == '0x0' ? undefined : t.yParity, t.r, t.s);
				return Uint8Array.from([0x01, ...RLP.encode(items)]);
			}

			case '0x2': {
				const t = tx as Type2TxHex;
				const items = [
					t.chainId,
					t.nonce,
					t.maxPriorityFeePerGas,
					t.maxFeePerGas,
					t.gasLimit,
					t.to,
					t.value == '0x0' ? undefined : t.value,
					t.data,
					handleAccessList(t.chainId, t.accessList),
				];
				if (signed)
					items.push(t.yParity == '0x0' ? undefined : t.yParity, t.r, t.s);
				return Uint8Array.from([0x02, ...RLP.encode(items)]);
			}

			case '0x3': {
				const t = tx as Type3TxHex;
				const items = [
					t.chainId,
					t.nonce,
					t.maxPriorityFeePerGas,
					t.maxFeePerGas,
					t.gasLimit,
					t.to,
					t.value == '0x0' ? undefined : t.value,
					t.data,
					handleAccessList(t.chainId, t.accessList),
					t.maxFeePerBlobGas,
					t.blobVersionedHashes,
				];
				if (signed)
					items.push(t.yParity == '0x0' ? undefined : t.yParity, t.r, t.s);
				return Uint8Array.from([0x03, ...RLP.encode(items)]);
			}

			case '0x4': {
				const t = tx as Type4TxHex;
				const items = [
					t.chainId,
					t.nonce,
					t.maxPriorityFeePerGas,
					t.maxFeePerGas,
					t.gasLimit,
					t.to,
					t.value == '0x0' ? undefined : t.value,
					t.data,
					handleAccessList(t.chainId, t.accessList),
					t.authorizationList.map((auth) => [
						auth.chainId,
						auth.address,
						auth.nonce,
						auth.yParity == '0x0' ? undefined : auth.yParity,
						auth.r,
						auth.s,
					]),
				];
				if (signed)
					items.push(t.yParity == '0x0' ? undefined : t.yParity, t.r, t.s);
				console.log(items);
				return Uint8Array.from([0x04, ...RLP.encode(items)]);
			}

			default:
				return handleTxType0(tx as Type0TxHex, signed);
		}
	}

	protected toHex(tx: EthereumTx): EthereumTxHex {
		return hexlifyObject(tx) as unknown as EthereumTxHex;
	}

	private hasSignature(
		tx: EthereumTxHex
	): tx is EthereumTxHex & SignedFieldsHex {
		return (
			typeof tx.yParity === 'string' &&
			typeof tx.r === 'string' &&
			typeof tx.s === 'string' &&
			tx.yParity.startsWith('0x') &&
			tx.r.startsWith('0x') &&
			tx.s.startsWith('0x')
		);
	}
}

function handleTxType0(tx: Type0TxHex, signed: boolean): Uint8Array {
	const t = tx as Type0TxHex;
	const v = computeV(t.chainId, t.yParity!);
	const items = signed
		? [
				t.nonce,
				t.gasPrice,
				t.gasLimit,
				t.to,
				t.value == '0x0' ? undefined : t.value,
				t.data,
				v,
				t.r,
				t.s,
		  ]
		: [
				t.nonce,
				t.gasPrice,
				t.gasLimit,
				t.to,
				t.value == '0x0' ? undefined : t.value,
				t.data,
				t.chainId,
				'0x',
				'0x',
		  ];
	return RLP.encode(items);
}

function handleAccessList(
	chainId: string | undefined,
	accessList: AccessListItemHex[] | undefined
) {
	return chainId === '0xa4b1'
		? []
		: accessList!.map((e) => [e.address, e.storageKeys]) ?? [];
}
