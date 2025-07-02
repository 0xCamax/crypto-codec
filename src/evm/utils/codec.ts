export function hexlify(
	input:
		| string
		| number
		| bigint
		| Uint8Array
		| boolean
		| null
		| undefined
		| Array<object>
): string | object[] {
	try {
		if (typeof input === 'string') {
			if (input.startsWith('0x')) return input.toLowerCase();
			const encoder = new TextEncoder();
			const bytes = encoder.encode(input);
			return (
				'0x' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
			);
		}

		if (typeof input === 'number') {
			if (!Number.isSafeInteger(input) || input < 0) {
				throw new Error(
					'Only safe positive integers are supported for hexlify.'
				);
			}
			return '0x' + (input == 0 ? '0' : input.toString(16));
		}

		if (typeof input === 'bigint') {
			if (input < 0n) throw new Error('Negative bigints are not supported.');
			return '0x' + (input == 0n ? '0' : input.toString(16));
		}

		if (input instanceof Uint8Array) {
			const hex = Array.from(input)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');
			return '0x' + (hex === '00' ? '0' : hex);
		}

		if (typeof input === 'boolean') {
			return input ? '0x1' : '0x0';
		}

		if (input === null || input === undefined) {
			return '0x';
		}

		if (Array.isArray(input)) {
			return input.map(hexlifyObject);
		}
		return '0x';
	} catch (error) {
		throw new Error(`Unsupported type for hexlify: ${error}`);
	}
}

export function hexlifyObject(tx: object): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	Object.entries(tx).forEach(([k, v]) => {
		result[k] = hexlify(v);
	});
	return result;
}

export function computeV(
	chainId: string,
	yParity: string 
): string {
	if (!chainId) throw new Error('chainId is required to compute v');

	const recovery = BigInt(yParity ?? '0x0');
	const id = BigInt(chainId);
	const v = id * 2n + 35n + recovery;
	return '0x' + v.toString(16);
}
