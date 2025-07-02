import { hexToUint8Array } from '../../../deps.ts';
import { ABIParameter } from './types.ts';
import { isDynamicType } from './utils.ts';

export function encodeParameterType(param: ABIParameter): string {
	if (param.type === 'tuple') {
		const inner = (param.components || []).map(encodeParameterType).join(',');
		return `(${inner})`;
	}
	const arrayMatch = param.type.match(/(.*)(\[.*\])$/);
	if (arrayMatch) {
		const base = arrayMatch[1];
		const suffix = arrayMatch[2];

		if (base === 'tuple') {
			const inner = (param.components || []).map(encodeParameterType).join(',');
			return `(${inner})${suffix}`;
		}
	}

	return param.type; // regular type like "uint256", "address", etc.
}
function padTo32Bytes(data?: Uint8Array): Uint8Array {
	if (!data || data.length === 0) {
		return new Uint8Array(32);
	}
	const padded = new Uint8Array(Math.ceil(data.length / 32) * 32);
	padded.set(data);
	return padded;
}

export function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
	const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
	const result = new Uint8Array(totalLen);

	let offset = 0;
	for (const arr of arrays) {
		result.set(arr, offset);
		offset += arr.length;
	}

	return result;
}

export function encodeDynamic(value: any, param: ABIParameter): Uint8Array {
	const { type, components } = param;

	// === string ===
	if (type === 'string') {
		const data = value ? new TextEncoder().encode(value) : new Uint8Array(0);
		const len = encodeStatic(data.length, { type: 'uint256' });

		if (data.length == 0) {
			return len;
		}
		const padded = padTo32Bytes(data);
		return concatUint8Arrays([len, padded]);
	}

	// === bytes ===
	if (type === 'bytes') {
		let data: Uint8Array;
		if (value instanceof Uint8Array) {
			data = value;
		} else if (typeof value === 'string' && value.startsWith('0x')) {
			data = hexToUint8Array(value.slice(2));
		} else if (value === '' || value === 0) {
			data = new Uint8Array(0);
		} else {
			throw new Error('Invalid bytes value');
		}
		const len = encodeStatic(data.length, { type: 'uint256' });
		if (data.length == 0) {
			return len;
		}
		const padded = padTo32Bytes(data);
		return concatUint8Arrays([len, padded]);
	}

	// === dynamic array ===
	const arrayMatch = type.match(/^(.*)\[(\d*)\]$/);
	if (arrayMatch) {
		const baseType = arrayMatch[1];
		const arrayLengthStr = arrayMatch[2];
		const isDynamicArray = arrayLengthStr === '';

		if (!Array.isArray(value)) {
			throw new Error(`Expected array value for type ${type}`);
		}

		if (isDynamicArray) {
			return encodeDynamicArray(value, param);
		} else {
			// Static-length array (e.g., uint256[3])
			const expectedLength = parseInt(arrayLengthStr, 10);
			if (value.length !== expectedLength) {
				throw new Error(
					`Array length mismatch: expected ${expectedLength}, got ${value.length}`
				);
			}

			const elems = value.map((v, i) =>
				isDynamicType({ type: baseType, components })
					? encodeDynamic(v, {
							type: baseType,
							components: components,
					  })
					: encodeStatic(v, {
							type: baseType,
							components: components,
					  })
			);
			return concatUint8Arrays(elems);
		}
	}

	// === tuple ===
	if (type.startsWith('tuple')) {
		if (!components) {
			throw new Error('Tuple type requires components');
		}
		// Usa encodeTuple
		return encodeTuple(value, components);
	}

	throw new Error(`Unsupported or unimplemented dynamic type: ${type}`);
}

export function encodeStatic(value: any, abi: ABIParameter): Uint8Array {
	if (
		abi.type.startsWith('uint') ||
		abi.type.startsWith('int') ||
		abi.type === 'address' ||
		abi.type === 'bool'
	) {
		let num: bigint;

		if (abi.type === 'bool') {
			num = value ? 1n : 0n;
		} else if (abi.type === 'address') {
			const address = BigInt(value);
			num = address;
		} else {
			num = BigInt(value);
		}

		const hex = num.toString(16).padStart(64, '0');
		return hexToUint8Array(hex);
	}

	if (abi.type.startsWith('bytes')) {
		const match = abi.type.match(/^bytes(\d+)$/);
		if (!match) throw new Error(`Invalid static bytes type: ${abi.type}`);
		const size = Number(match[1]);
		if (size < 1 || size > 32)
			throw new Error(`bytesN must be between 1 and 32`);

		let bytes: Uint8Array;
		if (typeof value === 'string' && value.startsWith('0x')) {
			bytes = hexToUint8Array(value);
		} else if (value instanceof Uint8Array) {
			bytes = value;
		} else {
			throw new Error(`Invalid bytes input: ${value}`);
		}

		if (bytes.length !== size) {
			throw new Error(`Expected ${size} bytes, got ${bytes.length}`);
		}

		const padded = new Uint8Array(32);
		padded.set(bytes);
		return padded;
	}

	if (abi.type === 'tuple') {
		if (!abi.components || !Array.isArray(value)) {
			throw new Error('Invalid tuple input');
		}

		const allStatic = abi.components.every((c) => !isDynamicType(c));
		if (!allStatic) {
			throw new Error(
				'Tuple contains dynamic types — use parseDynamic instead'
			);
		}

		const parts = abi.components.map((comp, i) => encodeStatic(value[i], comp));
		return concatUint8Arrays(parts);
	}

	throw new Error(`Unsupported or dynamic type in encodeStatic: ${abi.type}`);
}

function encodeTuple(
	value: any[],
	components: ABIParameter[],
	baseOffset: number = 0
): Uint8Array {
	const headChunks: Uint8Array[] = [];
	const tailChunks: Uint8Array[] = [];
	let dynamicOffset = 0;
	for (const abi of components) {
		if (isDynamicType(abi)) {
			dynamicOffset += 32;
		} else {
			dynamicOffset += staticSizeInWords(abi) * 32;
		}
	}

	for (let i = 0; i < components.length; i++) {
		const abi = components[i];
		const v = value[i];

		if (isDynamicType(abi)) {
			// Head: referencia al offset relativo al inicio de la tupla
			headChunks.push(encodeStatic(dynamicOffset, { type: 'uint256' }));

			// Tail: valor codificado dinámicamente
			let tailEncoded: Uint8Array;
			if (abi.type === 'string' || abi.type === 'bytes') {
				tailEncoded = encodeDynamic(v, abi);
			} else if (abi.type.endsWith('[]')) {
				tailEncoded = encodeDynamicArray(v, abi);
			} else if (abi.type.startsWith('tuple')) {
				tailEncoded = encodeTuple(
					v,
					abi.components!,
					baseOffset + dynamicOffset
				);
			} else {
				throw new Error(`Unsupported dynamic type in tuple: ${abi.type}`);
			}

			tailChunks.push(tailEncoded);
			dynamicOffset += tailEncoded.length;
		} else {
			// Campo estático directamente en el head
			headChunks.push(encodeStatic(v, abi));
		}
	}

	return concatUint8Arrays([...headChunks, ...tailChunks]);
}

function encodeDynamicArray(values: any[], abi: ABIParameter): Uint8Array {
	if (!abi.type.endsWith('[]')) {
		throw new Error(`Type ${abi.type} is not a dynamic array`);
	}

	// Tipo base (por ejemplo, para "tuple[]" → "tuple")
	const baseType = abi.type.slice(0, -2);
	const componentAbi: ABIParameter = abi.components
		? { type: baseType, components: abi.components }
		: { type: baseType };

	const headChunks: Uint8Array[] = [];
	const tailChunks: Uint8Array[] = [];

	let dynamicOffset = values.length * 32;

	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		if (isDynamicType(componentAbi)) {
			headChunks.push(encodeStatic(dynamicOffset, { type: 'uint256' }));

			let tail: Uint8Array;

			if (componentAbi.type === 'string' || componentAbi.type === 'bytes') {
				const raw = new TextEncoder().encode(value);
				tail = concatUint8Arrays([
					encodeStatic(raw.length, { type: 'uint256' }),
					padTo32Bytes(raw),
				]);
			} else if (componentAbi.type.startsWith('tuple')) {
				tail = encodeTuple(value, componentAbi.components!);
			} else if (componentAbi.type.endsWith('[]')) {
				tail = encodeDynamicArray(value, componentAbi);
			} else {
				throw new Error(
					`Unsupported dynamic element type in array: ${componentAbi.type}`
				);
			}

			tailChunks.push(tail);
			dynamicOffset += tail.length;
		} else {
			const encoded = encodeStatic(value, componentAbi);
			headChunks.push(encoded);
		}
	}

	const lengthEncoded = encodeStatic(values.length, { type: 'uint256' });
	return concatUint8Arrays([lengthEncoded, ...headChunks, ...tailChunks]);
}

export function staticSizeInWords(param: ABIParameter): number {
	if (isDynamicType(param)) return 0;

	const { type, components } = param;

	// Casos base: tipos primitivos estáticos
	if (
		type.startsWith('uint') ||
		type.startsWith('int') ||
		type === 'bool' ||
		type === 'address' ||
		/^bytes([1-9]|1[0-9]|2[0-9]|3[0-2])$/.test(type)
	) {
		return 1;
	}

	// Tupla de sólo campos estáticos
	if (type === 'tuple') {
		if (!components || components.length === 0) return 0;
		return components.reduce((sum, c) => {
			if (isDynamicType(c)) {
				throw new Error(`Tuple has dynamic component: ${c.type}`);
			}
			return sum + staticSizeInWords(c);
		}, 0);
	}

	// Array de tamaño fijo, ej: uint256[3]
	const match = type.match(/^(.*)\[(\d+)\]$/);
	if (match) {
		const baseType = match[1];
		const length = parseInt(match[2], 10);
		if (isNaN(length))
			throw new Error(`Invalid fixed array length in type: ${type}`);

		const baseParam: ABIParameter = {
			type: baseType,
			components: param.components,
		};

		if (isDynamicType(baseParam)) {
			throw new Error(`Fixed array with dynamic base type: ${baseType}`);
		}

		return length * staticSizeInWords(baseParam);
	}

	throw new Error(
		`Unsupported or non-static type in staticSizeInWords: ${type}`
	);
}
