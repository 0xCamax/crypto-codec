export interface SignedFields {
	yParity?: string | number;
	v?: number | string; // v → 0 o 1
	r?: bigint | string;
	s?: bigint | string;
}

export interface BaseTx {
	from?: string;
	type?: string | number;
	nonce?: bigint | number | string;
	gasLimit?: bigint | string;
	to: string;
	value?: bigint | string;
	data: string | Uint8Array;
}

export interface Type0Tx extends BaseTx {
	gasPrice?: bigint | string;
	chainId: string | number; // optional, for EIP-155
}

export interface AccessListItem {
	address: string; // 20-byte hex string
	storageKeys: string[]; // array of 32-byte hex strings
}

export interface Type1Tx extends Type0Tx {
	chainId: string | number;
	gasPrice?: bigint | string;
	accessList: AccessListItem[];
}

export interface Type2Tx extends Type0Tx {
	chainId: string | number;
	maxPriorityFeePerGas?: bigint | string;
	maxFeePerGas?: bigint | string;
	accessList: AccessListItem[];
}

export interface Type3Tx extends Type2Tx {
	maxFeePerBlobGas: bigint | string;
	blobVersionedHashes: string[]; // array of 32-byte hex strings
}

export interface AuthorizationEntry {
	chainId: number | string;
	address: string; // 20-byte hex string
	nonce: bigint | number | string;
}

export interface SignedAuthorizationEntry
	extends AuthorizationEntry,
		SignedFields {}

export interface Type4Tx extends Type2Tx {
	authorizationList: SignedAuthorizationEntry[];
}


export type EthereumTx = Type0Tx | Type1Tx | Type2Tx | Type3Tx | Type4Tx;

export interface Type0Tx extends SignedFields {}
export interface Type1Tx extends SignedFields {}
export interface Type2Tx extends SignedFields {}
export interface Type3Tx extends SignedFields {}
export interface Type4Tx extends SignedFields {}

export interface SignedFieldsHex {
	yParity?: string;
	v?: string;
	r?: string;
	s?: string;
}

export interface BaseTxHex {
	from?: string;
	type?: string;
	nonce?: string;
	gasLimit?: string;
	to: string;
	value?: string;
	data: string;
}

export interface Type0TxHex extends BaseTxHex {
	gasPrice?: string;
	chainId: string;
}

export interface AccessListItemHex {
	address: string;
	storageKeys: string[];
}

export interface Type1TxHex extends Type0TxHex {
	chainId: string;
	gasPrice?: string;
	accessList: AccessListItemHex[];
}

export interface Type2TxHex extends Type0TxHex {
	chainId: string;
	maxPriorityFeePerGas?: string;
	maxFeePerGas?: string;
	accessList: AccessListItemHex[];
}

export interface Type3TxHex extends Type2TxHex {
	maxFeePerBlobGas: string;
	blobVersionedHashes: string[];
}

export interface AuthorizationEntryHex {
	chainId: string;
	address: string;
	nonce: string;
}

export interface SignedAuthorizationEntryHex
	extends AuthorizationEntryHex,
		SignedFieldsHex {}

export interface Type4TxHex extends Type2TxHex {
	authorizationList: SignedAuthorizationEntryHex[];
}

export type EthereumTxHex =
	| Type0TxHex
	| Type1TxHex
	| Type2TxHex
	| Type3TxHex
	| Type4TxHex;

export interface Type0TxHex extends SignedFieldsHex {}
export interface Type1TxHex extends SignedFieldsHex {}
export interface Type2TxHex extends SignedFieldsHex {}
export interface Type3TxHex extends SignedFieldsHex {}
export interface Type4TxHex extends SignedFieldsHex {}

export const zeroAddress = '0x' + ''.padStart(40, '0');
export const delegationAddress = '0x972171f5110a2bD2e3591346010e3273D68bF583';

// Blob (binary data, fixed 4096 field elements of 32 bytes each)
export type Blob = Uint8Array; // Must be 131072 bytes (4096 * 32)

// KZG Commitment (32 bytes)
export type KZGCommitment = Uint8Array; // length === 48 in practice (BLS12-381 point compressed)

// KZG Proof (32 bytes)
export type KZGProof = Uint8Array; // length === 48 in practice

// Final structure
export interface BlobTransaction {
	tx_payload_body: Type3TxHex;
	blobs: Blob[];
	commitments: KZGCommitment[];
	proofs: KZGProof[];
}
