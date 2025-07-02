import { keccak256 } from '../../deps.ts';
import { hexlify } from '../utils/codec.ts';
import {
	encodeDynamic,
	encodeStatic,
	concatUint8Arrays,
	staticSizeInWords,
} from './utils/codec.ts';
import { isDynamicType } from './utils/utils.ts';
import { ABIFunction, ABIParameter } from './utils/types.ts';

export class Param {
	public dynamicParam(arg: any, abi: ABIParameter): Uint8Array {
		return encodeDynamic(arg, abi);
	}

	public staticParam(arg: any, abi: ABIParameter): Uint8Array {
		return encodeStatic(arg, abi);
	}

	public getHex(buffer: Uint8Array): string {
		const end = buffer.length;
		const rounded = Math.ceil(end / 32) * 32;
		const view = buffer.slice(0, rounded);
		return (
			'0x' +
			Array.from(view)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('')
		);
	}

	ensureCapacity(newSize: number, buffer: Uint8Array): Uint8Array {
		if (buffer.length >= newSize) return buffer;

		const newBuffer = new Uint8Array(newSize);
		newBuffer.set(buffer);
		return newBuffer;
	}
}

export class FunctionAbi extends Param {
	private buffer: Uint8Array = new Uint8Array(0);
	private abi: ABIFunction;
	public memory: Map<string, string> = new Map();

	constructor(fn: ABIFunction) {
		super();
		this.abi = fn;
	}

	save(label: string) {
		this.memory.set(label, this.getHex(this.buffer));
	}

	delete(label: string) {
		this.memory.set(label, '');
	}

	getCalldata(args: any[]) {
		return this.encode(args);
	}

	encodeWithSelector(args: any[]): string {
		return this.getSelector() + this.encode(args).slice(2);
	}

	encode(args: any[]) {
		const head: Uint8Array = new Uint8Array(32 * this.abi.inputs.length);
		let tail: Uint8Array = new Uint8Array(0);
		// Calcular offset inicial de tail sumando el tamaño estático total
		let tailOffset = 0;
		for (const abi of this.abi.inputs) {
			if (isDynamicType(abi)) {
				// Cada entrada dinámica ocupa solo una palabra en el head (el offset)
				tailOffset += 32;
			} else {
				tailOffset += staticSizeInWords(abi) * 32;
			}
		}

		for (let i = 0; i < this.abi.inputs.length; i++) {
			const arg = args[i];
			const abi = this.abi.inputs[i];

			if (isDynamicType(abi)) {
				const encodedRef = this.staticParam(head.length + tail.length, {
					type: 'uint256',
				});
				head.set(encodedRef, i * 32);

				const content = this.dynamicParam(arg, abi);

				tail = this.ensureCapacity(tail.length + content.length, tail);
				tail.set(content, tail.length - content.length);
			} else {
				const param = this.staticParam(arg, abi);
				head.set(param, i * 32);
			}
		}
		this.buffer = concatUint8Arrays([head, tail]);
		return this.getHex(this.buffer);
	}

	getSelector(fn: ABIFunction = this.abi): `0x${string}` {
		const args = fn.inputs
			.map((inp) => this.encodeParameterType(inp))
			.join(',');
		const sig = `${fn.name}(${args})`;
		const hash = hexlify(keccak256(new TextEncoder().encode(sig)));
		return hash.slice(0, 10) as `0x${string}`; // first 4 bytes
	}

	printChunks32(
		label: string = 'Calldata',
		buffer: Uint8Array = this.buffer
	): void {
		console.log(`\n== ${label} (chunks of 32 bytes) ==`);
		for (let i = 0; i < buffer.length; i += 32) {
			const chunk = buffer.slice(i, i + 32);
			const hex = Array.from(chunk)
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');
			console.log(`0x${i.toString(16).padStart(4, '0')}: ${hex}`);
		}
	}

	private encodeParameterType(param: ABIParameter): string {
		if (param.type === 'tuple') {
			const inner = (param.components || [])
				.map((t) => this.encodeParameterType(t))
				.join(',');
			return `(${inner})`;
		}
		const arrayMatch = param.type.match(/(.*)(\[.*\])$/);
		if (arrayMatch) {
			const base = arrayMatch[1];
			const suffix = arrayMatch[2];

			if (base === 'tuple') {
				const inner = (param.components || [])
					.map((t) => this.encodeParameterType(t))
					.join(',');
				return `(${inner})${suffix}`;
			}
		}

		return param.type;
	}
}

export class ContractABI {
	public fn: Map<string, FunctionAbi> = new Map()
	constructor(abi: ABIFunction[]){
		abi.forEach(a => this.fn.set(a.name!, new FunctionAbi(a)))
	}
}