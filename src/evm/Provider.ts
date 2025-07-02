import { EthereumTxHex, AccessListItem, Type2TxHex } from './utils/types.ts';

// provider.ts
type JsonRpcRequest = {
	jsonrpc: '2.0';
	method: string;
	params: unknown[];
	id: number;
};

type JsonRpcResponse<T = any> = {
	jsonrpc: '2.0';
	id: number;
	result?: T;
	error?: {
		code: number;
		message: string;
		data?: any;
	};
};

type NewestBlock = 'earliest' | 'finalized' | 'safe' | 'latest' | 'pending';

export class Provider extends EventTarget {
	private url: string;
	public chain: string;
	private id = 0;

	constructor(url: string, _chain: string) {
		super();
		this.url = url;
		this.chain = _chain;
	}

	// --- Event System ---
	on(event: string, handler: (ev: CustomEvent) => void) {
		this.addEventListener(event, handler as EventListener);
	}

	off(event: string, handler: (ev: CustomEvent) => void) {
		this.removeEventListener(event, handler as EventListener);
	}

	emit(event: string, detail?: any) {
		this.dispatchEvent(new CustomEvent(event, { detail }));
	}

	private async request<T = any>(
		method: string,
		params: unknown[] = []
	): Promise<T> {
		const body: JsonRpcRequest = {
			jsonrpc: '2.0',
			method,
			params,
			id: this.id++,
		};

		const response = await fetch(this.url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		});

		const json: JsonRpcResponse<T> = await response.json();

		if (json.error) {
			throw new Error(`[${json.error.code}] ${json.error.message}`);
		}

		return json.result!;
	}

	web3_sha3(data: string) {
		return this.request('web3_sha3', [data]);
	}

	net_version() {
		return this.request('net_version');
	}
	net_listening() {
		return this.request('net_listening');
	}
	net_peerCount() {
		return this.request('net_peerCount');
	}

	eth_protocolVersion() {
		return this.request('eth_protocolVersion');
	}
	eth_syncing() {
		return this.request('eth_syncing');
	}
	eth_coinbase() {
		return this.request('eth_coinbase');
	}
	eth_mining() {
		return this.request('eth_mining');
	}
	eth_hashrate() {
		return this.request('eth_hashrate');
	}
	eth_gasPrice() {
		return this.request('eth_gasPrice');
	}
	eth_accounts() {
		return this.request('eth_accounts');
	}
	eth_blockNumber() {
		return this.request('eth_blockNumber');
	}

	eth_getBalance(address: string, block: string = 'latest') {
		return this.request('eth_getBalance', [address, block]);
	}

	eth_getStorageAt(
		address: string,
		position: string,
		block: string = 'latest'
	) {
		return this.request('eth_getStorageAt', [address, position, block]);
	}

	eth_getTransactionCount(
		address: string,
		block: string = 'latest'
	): Promise<string> {
		return this.request('eth_getTransactionCount', [address, block]);
	}

	eth_getBlockTransactionCountByHash(hash: string) {
		return this.request('eth_getBlockTransactionCountByHash', [hash]);
	}

	eth_getBlockTransactionCountByNumber(number: string) {
		return this.request('eth_getBlockTransactionCountByNumber', [number]);
	}

	eth_getCode(address: string, block: string = 'latest') {
		return this.request('eth_getCode', [address, block]);
	}

	eth_sendRawTransaction(signedTx: string) {
		return this.request('eth_sendRawTransaction', [signedTx]);
	}

	eth_call(callObject: any, block: string = 'latest') {
		return this.request('eth_call', [callObject, block]);
	}

	eth_estimateGas(txObject: any) {
		return this.request('eth_estimateGas', [txObject]);
	}
	eth_feeHistory(
		blockCount: string = '0xa',
		block: NewestBlock = 'latest',
		percetil: number[] = [50]
	) {
		return this.request('eth_feeHistory', [blockCount, block, percetil]);
	}

	eth_getBlockByHash(hash: string, full = false) {
		return this.request('eth_getBlockByHash', [hash, full]);
	}

	eth_getBlockByNumber(number: string, full = false) {
		return this.request('eth_getBlockByNumber', [number, full]);
	}

	eth_getTransactionByHash(hash: string) {
		return this.request('eth_getTransactionByHash', [hash]);
	}

	eth_getTransactionByBlockHashAndIndex(hash: string, index: string) {
		return this.request('eth_getTransactionByBlockHashAndIndex', [hash, index]);
	}

	eth_getTransactionByBlockNumberAndIndex(number: string, index: string) {
		return this.request('eth_getTransactionByBlockNumberAndIndex', [
			number,
			index,
		]);
	}

	eth_getTransactionReceipt(hash: string) {
		return this.request('eth_getTransactionReceipt', [hash]);
	}

	eth_getLogs(filter: any) {
		return this.request('eth_getLogs', [filter]);
	}

	eth_newFilter(filter: any) {
		return this.request('eth_newFilter', [filter]);
	}

	eth_newBlockFilter() {
		return this.request('eth_newBlockFilter');
	}

	eth_newPendingTransactionFilter() {
		return this.request('eth_newPendingTransactionFilter');
	}

	eth_uninstallFilter(id: string) {
		return this.request('eth_uninstallFilter', [id]);
	}

	eth_getFilterChanges(id: string) {
		return this.request('eth_getFilterChanges', [id]);
	}

	eth_getFilterLogs(id: string) {
		return this.request('eth_getFilterLogs', [id]);
	}
	eth_createAccessList(
		tx: EthereumTxHex,
		blocktag: NewestBlock = 'latest'
	): Promise<{ accessList: AccessListItem[]; gasUsed: string }> {
		return this.request('eth_createAccessList', [tx, blocktag]);
	}

	async populateTransaction(
		tx: EthereumTxHex,
		address: string
	): Promise<EthereumTxHex> {
		let gasParams;
		const accessList: any[] = [];
		const type = tx.type ?? '0x0';
		tx.from = address;

		if (type === '0x0' || type === '0x1') {
			const { gasLimit, gasPrice } = await this.estimateGas(tx);
			gasParams = { gasLimit, gasPrice };
		} else if (type === '0x2') {
			tx.accessList = await this.eth_createAccessList(tx);
		} else {
			const { gasLimit, maxFeePerGas, maxPriorityFeePerGas } =
				await this.estimateGas(tx);
			gasParams = { gasLimit, maxFeePerGas, maxPriorityFeePerGas };
		}

		const nonce = await this.eth_getTransactionCount(address);
		return {
			...tx,
			...gasParams,
			accessList,
			nonce,
		} as EthereumTxHex;
	}

	async estimateGas(tx: EthereumTxHex): Promise<{
		gasPrice: string;
		gasLimit: string;
		maxFeePerGas: string;
		maxPriorityFeePerGas: string;
	}> {
		const gasLimitHex = await this.eth_estimateGas(tx);
		let gasLimitNum = BigInt(gasLimitHex);

		gasLimitNum = gasLimitNum + gasLimitNum / 5n;
		let maxFeePerGas, maxPriorityFeePerGas, gasPrice;
		try {
			const fee = await this.eth_feeHistory();

			const baseFee =
				fee && fee.baseFeePerGas && fee.baseFeePerGas.length > 0
					? BigInt(fee.baseFeePerGas[0])
					: 0n;
			const priorityFee =
				fee && fee.reward && fee.reward.length > 0 && fee.reward[0].length > 0
					? BigInt(fee.reward[0][0])
					: 1_500_000_000n;

			gasPrice = await this.eth_gasPrice();
			maxPriorityFeePerGas = '0x' + priorityFee.toString(16);
			maxFeePerGas = '0x' + (baseFee + priorityFee * 2n).toString(16);
		} catch {
			const gasPriceHex = await this.eth_gasPrice();
			maxFeePerGas = gasPriceHex;
			maxPriorityFeePerGas = '0x59682f00';
		}
		return {
			gasPrice,
			gasLimit: '0x' + gasLimitNum.toString(16),
			maxFeePerGas,
			maxPriorityFeePerGas,
		};
	}
}
