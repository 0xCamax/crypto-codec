import { ChainlinkSmartAccount } from '../abis/ChainlinkSmartAccount.ts';
import { ContractABI, ABIFunction } from './utils/types.ts';
import { encodeFunctionData } from 'npm:viem';
import { FunctionAbi } from './Abi.ts';
import { hexToUint8Array } from '../../deps.ts';
import { encodeDynamic } from './utils/codec.ts';

export const directory: Record<number, ChainConfig> = {
	11155111: {
		registry: '0x86EFBD0b6736Bed994962f9797049422A3A8E8Ad',
		registrar: '0xb0E49c5D0d05cbc241d68c05BC5BA1d1B7B72976',
		linkToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
		weth: '0x097D90c9d3E0B50Ca60e1ae45F6A81010f9FB534',
		router: '0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59',
		selector: '16015286601757825753',
		CCIPToken: '0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05',
	},
	84532: {
		registry: '0x91D4a4C3D448c7f3CB477332B1c7D420a5810aC3',
		registrar: '0xf28D56F3A707E25B71Ce529a21AF388751E1CF2A',
		linkToken: '0xE4aB69C077896252FAFBD49EFD26B5D171A32410',
		weth: '0x4200000000000000000000000000000000000006',
		router: '0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93',
		selector: '10344971235874465080',
		CCIPToken: '0x88A2d74F47a237a62e7A51cdDa67270CE381555e',
	},
};

const account: ContractABI = ChainlinkSmartAccount as ContractABI;

const functions = account.filter((e) => e.type == 'function');

const lookup = functions.filter((fn) => fn.name == 'executeCCIP');

const fn = lookup[0];
const executeBatch = new FunctionAbi(fn as ABIFunction);

const extraArgs = [400000n, false];

const config = [
	directory[11155111].selector,
	'0x0000000000000000000000000000000000000000',
	[[directory[84532].CCIPToken, 1n]],
	extraArgs,
];

const args = [
	[
		['0xEC08EfF77496601BE56c11028A516366DbF03F13', 420, '0x4200'],
		['0xEC08EfF77496601BE56c11028A516366DbF03F13', 69, '0x69'],
	]
];

const ITERATIONS = 5;
let viemTotal = 0;
let mineTotal = 0;
let mismatchCount = 0;

for (let i = 0; i < ITERATIONS; i++) {
	// Medir tiempo viem
	const startViem = performance.now();
	const viemencode = encodeFunctionData({
		abi: functions,
		functionName: 'executeBatch',
		args,
	});
	const endViem = performance.now();
	viemTotal += endViem - startViem;

	// Medir tiempo custom
	const startMine = performance.now();
	const lookup = functions.filter((fn) => fn.name == 'executeBatch');
	const fn = lookup[0];
	const executeBatch = new FunctionAbi(fn as ABIFunction);
	const myencode = executeBatch.encodeWithSelector(args);
	const endMine = performance.now();
	mineTotal += endMine - startMine;

	// Validar igualdad
	if (viemencode !== myencode) {
		mismatchCount++;
		console.error(`❌ Mismatch en iteración ${i}`);
	}
}

console.log(`🔁 Iteraciones: ${ITERATIONS}`);
console.log(`✅ Coincidencias: ${ITERATIONS - mismatchCount}/${ITERATIONS}`);
console.log(
	`⏱️ Tiempo promedio viemencode: ${(viemTotal / ITERATIONS).toFixed(3)} ms`
);
console.log(
	`⏱️ Tiempo promedio myencode: ${(mineTotal / ITERATIONS).toFixed(3)} ms`
);
console.log(
	`⚡ Aceleración: ~${((viemTotal / mineTotal) * 100 - 100).toFixed(1)}%`
);
